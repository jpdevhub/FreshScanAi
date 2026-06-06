// @ts-nocheck
/**
 * Fish Freshness Fusion Inference Engine
 * Mirrors backend/fusion.py logic in JavaScript using ONNX Runtime Web
 *
 * Stream A: MobileNetV2 (Global Body) → 3 classes [C1=Fresh, C2=Moderate, C3=Spoiled]
 * Stream B: Custom CNN (Micro-crops)  → 4 classes [Fresh_Eyes, Fresh_Gills, Nonfresh_Eyes, Nonfresh_Gills]
 *
 * Pipeline:
 *   1. Run Stream A on body image
 *   2. Run Stream B on eye crop  → evaluate indices [0, 2] only
 *   3. Run Stream B on gill crop → evaluate indices [1, 3] only
 *   4. Fuse: (0.5 × Body) + (0.25 × Eye) + (0.25 × Gill)
 *
 * Usage:
 *   import { FishFreshnessInference } from './fusionInference.js';
 *   const engine = new FishFreshnessInference();
 *   await engine.loadModels();
 *   const result = await engine.predict(bodyImageElement, eyeImageElement, gillImageElement);
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STREAM_A_CLASSES = ['C1 (Fresh)', 'C2 (Moderate)', 'C3 (Spoiled)'];
const STREAM_B_CLASSES = ['Fresh_Eyes', 'Fresh_Gills', 'Nonfresh_Eyes', 'Nonfresh_Gills'];

const STREAM_A_INPUT_SIZE = { width: 224, height: 224 };
const STREAM_B_INPUT_SIZE = { width: 224, height: 224 };

// ImageNet normalization (standard for MobileNetV2 and similar CNNs)
const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD  = [0.229, 0.224, 0.225];

// Temperature scaling factors (mirror fusion.py — update if your .pt calibration differs)
const TEMPERATURE_A = 1.5;
const TEMPERATURE_B = 1.5;

// Fusion weights: (0.5 * Body) + (0.25 * Eye) + (0.25 * Gill)
const WEIGHT_BODY = 0.5;
const WEIGHT_EYE  = 0.25;
const WEIGHT_GILL = 0.25;

// Freshness score thresholds → final label
// Score is the probability of C1 (Fresh) after fusion
const THRESHOLD_FRESH    = 0.6;  // score >= 0.6 → Fresh
const THRESHOLD_MODERATE = 0.35; // score >= 0.35 → Moderate, else Spoiled

// If Stream A max-class probability falls below this after temperature scaling,
// the image is unlikely to be a fish (all-class uncertainty).
// Note: the ONNX model was trained only on fish, so non-fish images may still
// score above this — treat as a best-effort guard, not a hard detector.
const NOT_A_FISH_THRESHOLD = 0.36;

// Default model paths (relative to Vite public/ folder)
const DEFAULT_MODEL_PATHS = {
  streamA: '/models/stream_a_mobilenetv2.onnx',
  streamB: '/models/stream_b_custom_cnn.onnx',
};


// ---------------------------------------------------------------------------
// Math helpers (no external deps)
// ---------------------------------------------------------------------------

/**
 * Numerically stable softmax over a Float32Array or plain array.
 * @param {number[]} logits
 * @returns {number[]} probabilities summing to 1
 */
function softmax(logits) {
  const max = Math.max(...logits);
  const exps = logits.map(x => Math.exp(x - max));
  const sum  = exps.reduce((a, b) => a + b, 0);
  return exps.map(e => e / sum);
}

/**
 * Apply temperature scaling: divide each logit by T before softmax.
 * @param {number[]} logits
 * @param {number} temperature
 * @returns {number[]} calibrated probabilities
 */
function temperatureScale(logits, temperature) {
  const scaled = logits.map(l => l / temperature);
  return softmax(scaled);
}

/**
 * Element-wise weighted sum of probability arrays.
 * @param {Array<{probs: number[], weight: number}>} streams
 * @returns {number[]} fused probability vector
 */
function weightedFuse(streams) {
  const len = streams[0].probs.length;
  const out = new Array(len).fill(0);
  for (const { probs, weight } of streams) {
    for (let i = 0; i < len; i++) {
      out[i] += probs[i] * weight;
    }
  }
  return out;
}

/**
 * Map an argmax index to a human-readable label and confidence.
 * @param {number[]} probs
 * @param {string[]} labels
 * @returns {{ label: string, confidence: number, index: number }}
 */
function topPrediction(probs, labels) {
  const index = probs.reduce((best, p, i) => p > probs[best] ? i : best, 0);
  return { index, label: labels[index], confidence: probs[index] };
}


// ---------------------------------------------------------------------------
// Image preprocessing
// ---------------------------------------------------------------------------

/**
 * Resize and normalize an HTMLImageElement / HTMLCanvasElement / ImageBitmap
 * into a Float32Array in NCHW format [1, 3, H, W] with ImageNet normalization.
 *
 * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap} source
 * @param {{ width: number, height: number }} targetSize
 * @returns {Float32Array}
 */
function preprocessImage(source, targetSize = { width: 224, height: 224 }) {
  const { width, height } = targetSize;

  // Draw to an offscreen canvas at target resolution
  const canvas  = document.createElement('canvas');
  canvas.width  = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height).data; // Uint8ClampedArray [R,G,B,A, ...]

  // Convert to Float32 NCHW [1, C, H, W]
  const tensor = new Float32Array(1 * 3 * height * width);
  const channelSize = height * width;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIdx  = (y * width + x) * 4; // RGBA offset
      const tensorIdx = y * width + x;        // spatial offset within channel

      const r = imageData[pixelIdx]     / 255.0;
      const g = imageData[pixelIdx + 1] / 255.0;
      const b = imageData[pixelIdx + 2] / 255.0;

      tensor[0 * channelSize + tensorIdx] = (r - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
      tensor[1 * channelSize + tensorIdx] = (g - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
      tensor[2 * channelSize + tensorIdx] = (b - IMAGENET_MEAN[2]) / IMAGENET_STD[2];
    }
  }

  return tensor;
}


// ---------------------------------------------------------------------------
// ONNX session helpers
// ---------------------------------------------------------------------------

/**
 * Run a single ONNX inference session.
 * @param {ort.InferenceSession} session
 * @param {Float32Array} inputData
 * @param {[number, number, number, number]} inputShape  e.g. [1,3,224,224]
 * @returns {Promise<Float32Array>} raw logits from the first output tensor
 */
async function runOnnxSession(session, inputData, inputShape) {
  // ort = window.ort (loaded via <script> tag in index.html or via npm import)
  const ort = window.ort || (await import('onnxruntime-web')).default;

  const tensor = new ort.Tensor('float32', inputData, inputShape);

  // Use the model's first input name dynamically
  const inputName  = session.inputNames[0];
  const outputName = session.outputNames[0];

  const feeds  = { [inputName]: tensor };
  const result = await session.run(feeds);

  return Array.from(result[outputName].data); // Float32Array → regular Array
}


// ---------------------------------------------------------------------------
// Eye / Gill score extraction from Stream B logits
// ---------------------------------------------------------------------------

/**
 * From Stream B logits (4 values), extract a 2-class fresh/nonfresh score
 * for the eye crop using only indices [0, 2].
 *
 * @param {number[]} logitsB  raw 4-element logit vector
 * @param {number} temperature
 * @returns {{ freshScore: number, nonfreshScore: number, probs: number[] }}
 */
function extractEyeScore(logitsB, temperature) {
  // Slice relevant logits: [Fresh_Eyes, Nonfresh_Eyes]
  const eyeLogits = [logitsB[0], logitsB[2]];
  const probs     = temperatureScale(eyeLogits, temperature);
  return {
    freshScore:    probs[0],  // P(Fresh_Eyes)
    nonfreshScore: probs[1],  // P(Nonfresh_Eyes)
    probs,
  };
}

/**
 * From Stream B logits (4 values), extract a 2-class fresh/nonfresh score
 * for the gill crop using only indices [1, 3].
 *
 * @param {number[]} logitsB  raw 4-element logit vector
 * @param {number} temperature
 * @returns {{ freshScore: number, nonfreshScore: number, probs: number[] }}
 */
function extractGillScore(logitsB, temperature) {
  // Slice relevant logits: [Fresh_Gills, Nonfresh_Gills]
  const gillLogits = [logitsB[1], logitsB[3]];
  const probs      = temperatureScale(gillLogits, temperature);
  return {
    freshScore:    probs[0],  // P(Fresh_Gills)
    nonfreshScore: probs[1],  // P(Nonfresh_Gills)
    probs,
  };
}


// ---------------------------------------------------------------------------
// Fusion logic (mirrors fusion.py: process_and_fuse)
// ---------------------------------------------------------------------------

/**
 * Fuse three calibrated probability vectors into a final freshness score.
 *
 * Body probs shape:  [P(C1), P(C2), P(C3)]
 * Eye/Gill probs:   [P(Fresh), P(Nonfresh)]
 *
 * Strategy: map everything to a unified "freshness" scalar [0, 1]:
 *   - bodyFreshScore  = P(C1)  from Stream A  (C1 = Fresh)
 *   - eyeFreshScore   = P(Fresh_Eyes) from Stream B eye pass
 *   - gillFreshScore  = P(Fresh_Gills) from Stream B gill pass
 *
 * fusedScore = (0.5 × body) + (0.25 × eye) + (0.25 × gill)
 *
 * @param {number[]} bodyProbs   [P(C1), P(C2), P(C3)] after temperature scaling
 * @param {number[]} eyeProbs    [P(Fresh_Eyes), P(Nonfresh_Eyes)]
 * @param {number[]} gillProbs   [P(Fresh_Gills), P(Nonfresh_Gills)]
 * @returns {{ fusedScore: number, label: string, confidence: string }}
 */
function processAndFuse(bodyProbs, eyeProbs, gillProbs) {
  const bodyFresh = bodyProbs[0];   // P(C1 = Fresh)
  const eyeFresh  = eyeProbs[0];    // P(Fresh_Eyes)
  const gillFresh = gillProbs[0];   // P(Fresh_Gills)

  const fusedScore = (WEIGHT_BODY * bodyFresh)
                   + (WEIGHT_EYE  * eyeFresh)
                   + (WEIGHT_GILL * gillFresh);

  let label;
  if (fusedScore >= THRESHOLD_FRESH) {
    label = 'Fresh';
  } else if (fusedScore >= THRESHOLD_MODERATE) {
    label = 'Moderate';
  } else {
    label = 'Spoiled';
  }

  return {
    fusedScore,
    label,
    confidence: (fusedScore * 100).toFixed(1) + '%',
  };
}


// ---------------------------------------------------------------------------
// Main inference engine class
// ---------------------------------------------------------------------------

export class FishFreshnessInference {
  /**
   * @param {{ streamA?: string, streamB?: string }} modelPaths
   *   Paths to the ONNX files, relative to the app origin.
   *   Defaults to DEFAULT_MODEL_PATHS (public/models/).
   */
  constructor(modelPaths = {}) {
    this.paths = {
      streamA: modelPaths.streamA ?? DEFAULT_MODEL_PATHS.streamA,
      streamB: modelPaths.streamB ?? DEFAULT_MODEL_PATHS.streamB,
    };
    this.sessionA = null;
    this.sessionB = null;
    this._loaded  = false;
  }

  /**
   * Load and warm up both ONNX sessions.
   * Call once before any predict() calls.
   * @returns {Promise<void>}
   */
  async loadModels() {
    const ort = window.ort || (await import('onnxruntime-web')).default;

    console.log('[FishFreshness] Loading Stream A (MobileNetV2)…');
    this.sessionA = await ort.InferenceSession.create(this.paths.streamA, {
      executionProviders: ['wasm'],   // fallback: ['webgl', 'wasm']
      graphOptimizationLevel: 'all',
    });

    console.log('[FishFreshness] Loading Stream B (Custom CNN)…');
    this.sessionB = await ort.InferenceSession.create(this.paths.streamB, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });

    this._loaded = true;
    console.log('[FishFreshness] Models loaded. Input names:',
      this.sessionA.inputNames, this.sessionB.inputNames);
  }

  /**
   * Run full fusion pipeline on three images.
   *
   * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap} bodyImage
   * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap} eyeImage
   * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap} gillImage
   * @returns {Promise<FusionResult>}
   */
  async predict(bodyImage, eyeImage, gillImage) {
    if (!this._loaded) throw new Error('Call loadModels() before predict().');

    // ── Stream A: body ──────────────────────────────────────────────────────
    const bodyTensor = preprocessImage(bodyImage, STREAM_A_INPUT_SIZE);
    const bodyLogits = await runOnnxSession(
      this.sessionA, bodyTensor, [1, 3, STREAM_A_INPUT_SIZE.height, STREAM_A_INPUT_SIZE.width]
    );
    const bodyProbs = temperatureScale(bodyLogits, TEMPERATURE_A); // [P(C1), P(C2), P(C3)]

    // ── Fish confidence guard ────────────────────────────────────────────────
    // If no class exceeds the threshold the image is likely not a fish.
    if (Math.max(...bodyProbs) < NOT_A_FISH_THRESHOLD) {
      throw new Error('NOT_A_FISH');
    }

    // ── Stream B (eye pass) ─────────────────────────────────────────────────
    const eyeTensor  = preprocessImage(eyeImage, STREAM_B_INPUT_SIZE);
    const eyeLogitsB = await runOnnxSession(
      this.sessionB, eyeTensor, [1, 3, STREAM_B_INPUT_SIZE.height, STREAM_B_INPUT_SIZE.width]
    );
    const { probs: eyeProbs, freshScore: eyeFresh } = extractEyeScore(eyeLogitsB, TEMPERATURE_B);

    // ── Stream B (gill pass) ────────────────────────────────────────────────
    const gillTensor  = preprocessImage(gillImage, STREAM_B_INPUT_SIZE);
    const gillLogitsB = await runOnnxSession(
      this.sessionB, gillTensor, [1, 3, STREAM_B_INPUT_SIZE.height, STREAM_B_INPUT_SIZE.width]
    );
    const { probs: gillProbs, freshScore: gillFresh } = extractGillScore(gillLogitsB, TEMPERATURE_B);

    // ── Fusion ──────────────────────────────────────────────────────────────
    const fusion = processAndFuse(bodyProbs, eyeProbs, gillProbs);

    /** @type {FusionResult} */
    const result = {
      // Final decision
      label:      fusion.label,
      fusedScore: fusion.fusedScore,
      confidence: fusion.confidence,

      // Per-stream details (useful for debugging / UI)
      streamA: {
        logits:     bodyLogits,
        probs:      bodyProbs,
        prediction: topPrediction(bodyProbs, STREAM_A_CLASSES),
      },
      streamB_eye: {
        logits:     eyeLogitsB,
        freshScore: eyeFresh,
        probs:      eyeProbs,
      },
      streamB_gill: {
        logits:     gillLogitsB,
        freshScore: gillFresh,
        probs:      gillProbs,
      },
    };

    return result;
  }

  /**
   * Run full fusion pipeline on a SINGLE image — mirrors the HF backend
   * `scan_auto` endpoint which passes the same image to all three streams:
   *   body_logits = predict_stream_a(img)
   *   eye_logits  = predict_stream_b(img)   ← same image
   *   gill_logits = predict_stream_b(img)   ← same image
   *
   * Throws Error('NOT_A_FISH') if the image is likely not a fish.
   *
   * @param {HTMLImageElement|HTMLCanvasElement|ImageBitmap} image
   * @returns {Promise<FusionResult>}
   */
  async predictSingle(image) {
    if (!this._loaded) throw new Error('Call loadModels() before predictSingle().');
    return this.predict(image, image, image);
  }

  /**
   * Release ONNX session resources (call when inference is done).
   */
  async dispose() {
    if (this.sessionA) { await this.sessionA.release?.(); this.sessionA = null; }
    if (this.sessionB) { await this.sessionB.release?.(); this.sessionB = null; }
    this._loaded = false;
  }
}


// ---------------------------------------------------------------------------
// Standalone helper: test with raw logits (no ONNX required)
// Useful for unit tests and verifying the fusion math offline.
// ---------------------------------------------------------------------------

/**
 * Run the fusion math directly from raw logit arrays.
 * Mirrors fusion.py: process_and_fuse(body_logits, eye_logits, gill_logits)
 *
 * @param {number[]} bodyLogits   3-element array from Stream A
 * @param {number[]} eyeLogitsB   4-element array from Stream B (eye pass)
 * @param {number[]} gillLogitsB  4-element array from Stream B (gill pass)
 * @param {{ tempA?: number, tempB?: number }} opts  override temperatures
 * @returns {FusionResult}
 */
export function fuseFromLogits(bodyLogits, eyeLogitsB, gillLogitsB, opts = {}) {
  const tempA = opts.tempA ?? TEMPERATURE_A;
  const tempB = opts.tempB ?? TEMPERATURE_B;

  const bodyProbs = temperatureScale(bodyLogits, tempA);
  const { probs: eyeProbs, freshScore: eyeFresh }   = extractEyeScore(eyeLogitsB, tempB);
  const { probs: gillProbs, freshScore: gillFresh }  = extractGillScore(gillLogitsB, tempB);
  const fusion = processAndFuse(bodyProbs, eyeProbs, gillProbs);

  return {
    label:      fusion.label,
    fusedScore: fusion.fusedScore,
    confidence: fusion.confidence,
    streamA:      { logits: bodyLogits,  probs: bodyProbs,  prediction: topPrediction(bodyProbs, STREAM_A_CLASSES) },
    streamB_eye:  { logits: eyeLogitsB,  freshScore: eyeFresh,  probs: eyeProbs  },
    streamB_gill: { logits: gillLogitsB, freshScore: gillFresh, probs: gillProbs },
  };
}


// ---------------------------------------------------------------------------
// Quick smoke-test (runs in browser console: import then call smokeTest())
// ---------------------------------------------------------------------------

export function smokeTest() {
  console.group('[FishFreshness] Smoke test — fusion math');

  // Scenario 1: very fresh fish (high C1, high eye/gill fresh)
  const r1 = fuseFromLogits(
    [3.5, 0.2, -1.0],    // body: strongly C1 (Fresh)
    [2.1, 0.5, -0.8, 0.1], // eye pass: Fresh_Eyes wins index 0
    [0.3, 2.5, -0.3, -0.5] // gill pass: Fresh_Gills wins index 1
  );
  console.log('Scenario 1 (should be Fresh):', r1.label, r1.confidence);

  // Scenario 2: moderate fish
  const r2 = fuseFromLogits(
    [0.5, 1.2, 0.3],
    [0.8, 0.4, 0.9, 0.2],
    [0.3, 0.8, 0.4, 0.6]
  );
  console.log('Scenario 2 (should be Moderate):', r2.label, r2.confidence);

  // Scenario 3: spoiled fish
  const r3 = fuseFromLogits(
    [-2.0, 0.1, 4.0],
    [-1.5, 0.2, 3.0, 0.1],
    [0.1, -2.0, 0.0, 3.5]
  );
  console.log('Scenario 3 (should be Spoiled):', r3.label, r3.confidence);

  console.groupEnd();
  return { r1, r2, r3 };
}


// ---------------------------------------------------------------------------
// JSDoc type definition (for IDE autocompletion)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} FusionResult
 * @property {'Fresh'|'Moderate'|'Spoiled'} label   Final freshness category
 * @property {number}   fusedScore   Scalar in [0,1] — higher = fresher
 * @property {string}   confidence   Human-readable e.g. "78.3%"
 * @property {{ logits: number[], probs: number[], prediction: { label: string, confidence: number, index: number } }} streamA
 * @property {{ logits: number[], freshScore: number, probs: number[] }} streamB_eye
 * @property {{ logits: number[], freshScore: number, probs: number[] }} streamB_gill
 */
