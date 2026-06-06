import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera, Zap, RotateCcw, FlashlightOff, Flashlight,
  SwitchCamera, Upload, Eye, Fish,
} from 'lucide-react';
import StatusTerminal from '../components/StatusTerminal';
import { api, isAuthenticated } from '../lib/api';
import { FishFreshnessInference } from '../fusionInference.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ScanPhase =
  | 'idle'           // waiting for body capture
  | 'body_captured'  // body done, waiting for eye crop
  | 'eye_captured'   // eye done, waiting for gill crop
  | 'processing'     // running ONNX inference + fusion
  | 'done'           // result ready
  | 'error';

interface CapturedImages {
  body:  HTMLImageElement | null;
  eye:   HTMLImageElement | null;
  gill:  HTMLImageElement | null;
}

interface FusionResult {
  label:      'Fresh' | 'Moderate' | 'Spoiled';
  fusedScore: number;
  confidence: string;
  streamA:      { probs: number[]; prediction: { label: string; confidence: number } };
  streamB_eye:  { freshScore: number; probs: number[] };
  streamB_gill: { freshScore: number; probs: number[] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton engine (load once, reuse across renders)
// ─────────────────────────────────────────────────────────────────────────────

let engineInstance: FishFreshnessInference | null = null;
let engineLoading = false;
let engineReady   = false;

async function getEngine(): Promise<FishFreshnessInference> {
  if (engineReady && engineInstance) return engineInstance;
  if (engineLoading) {
    // Wait until the in-flight load finishes
    await new Promise<void>(resolve => {
      const poll = setInterval(() => {
        if (engineReady) { clearInterval(poll); resolve(); }
      }, 100);
    });
    return engineInstance!;
  }
  engineLoading = true;
  engineInstance = new FishFreshnessInference();
  await engineInstance.loadModels();
  engineReady  = true;
  engineLoading = false;
  return engineInstance;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Capture current video frame as a Blob (JPEG) */
function captureVideoBlob(video: HTMLVideoElement): Promise<Blob | null> {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob(resolve, 'image/jpeg', 0.92);
  });
}

/** Convert a Blob / File to an HTMLImageElement (needed by ONNX preprocessor) */
function blobToImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img  = new Image();
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

/** Map fused score to a CSS colour class matching the app's design tokens */
function labelColor(label: string): string {
  if (label === 'Fresh')    return 'text-secondary';
  if (label === 'Moderate') return 'text-neon';
  return 'text-error';
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase metadata (drives UI copy + icons)
// ─────────────────────────────────────────────────────────────────────────────

const PHASE_META: Record<string, { icon: React.ReactNode; instruction: string; terminal: string[] }> = {
  idle: {
    icon:        <Fish size={32} className="text-on-surface-variant" />,
    instruction: 'CAPTURE_BODY',
    terminal:    ['STEP_1_OF_3', 'FRAME_WHOLE_FISH'],
  },
  body_captured: {
    icon:        <Eye size={32} className="text-on-surface-variant" />,
    instruction: 'CAPTURE_EYE_CROP',
    terminal:    ['STEP_2_OF_3', 'FRAME_EYE_CLOSEUP'],
  },
  eye_captured: {
    icon:        <Camera size={32} className="text-on-surface-variant" />,
    instruction: 'CAPTURE_GILL_CROP',
    terminal:    ['STEP_3_OF_3', 'FRAME_GILL_AREA'],
  },
  processing: {
    icon:        <Zap size={32} className="text-neon" />,
    instruction: 'RUNNING_INFERENCE',
    terminal:    ['FUSION_PIPELINE: ACTIVE', 'STREAM_A + STREAM_B'],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ScannerPage() {
  const navigate = useNavigate();

  // ── State ──────────────────────────────────────────────────────────────────
  const [scanPhase,  setScanPhase]  = useState<ScanPhase>('idle');
  const [progress,   setProgress]   = useState(0);
  const [result,     setResult]     = useState<FusionResult | null>(null);
  const [error,      setError]      = useState('');
  const [flashOn,    setFlashOn]    = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraActive, setCameraActive] = useState(true);
  const [copied,       setCopied]       = useState(false);

  // Preview URLs for the three captured frames (body, eye, gill)
  const [previewBody, setPreviewBody] = useState<string | null>(null);
  const [previewEye,  setPreviewEye]  = useState<string | null>(null);
  const [previewGill, setPreviewGill] = useState<string | null>(null);

  // HTMLImageElement references for ONNX inference
  const capturedRef = useRef<CapturedImages>({ body: null, eye: null, gill: null });


  // ── Refs ───────────────────────────────────────────────────────────────────
  const videoRef     = useRef<HTMLVideoElement>(null);
  const progressRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef    = useRef<MediaStream | null>(null);

  // ── Pre-warm the ONNX engine on mount ─────────────────────────────────────
  useEffect(() => { getEngine().catch(console.error); }, []);

  // ── Camera stream ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!cameraActive) return;
    // Don't restart camera when we're in a "between captures" preview phase
    const showingPreview = previewBody && scanPhase === 'body_captured'
                        || previewEye  && scanPhase === 'eye_captured';
    if (showingPreview) return;

    let cancelled = false;
    const currentVideo = videoRef.current;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (currentVideo) currentVideo.srcObject = stream;
      } catch (err) {
        if (!cancelled) console.error('Camera error:', err);
      }
    }

    startCamera();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      if (currentVideo) currentVideo.srcObject = null;
    };
  }, [facingMode, cameraActive, scanPhase, previewBody, previewEye]);

  // ── Progress bar ───────────────────────────────────────────────────────────
  const startProgressBar = useCallback(() => {
    setProgress(0);
    progressRef.current = setInterval(() => {
      setProgress(prev => (prev >= 90 ? prev : prev + Math.random() * 4 + 1));
    }, 100);
  }, []);

  const stopProgressBar = useCallback((final: number) => {
    if (progressRef.current) clearInterval(progressRef.current);
    setProgress(final);
  }, []);

  // ── Stop camera helper ─────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  // ── Core: store one captured image and advance the phase ───────────────────
  const storeCapture = useCallback(async (blob: Blob, phase: ScanPhase) => {
    const imgEl = await blobToImageElement(blob);
    const url   = URL.createObjectURL(blob);

    if (phase === 'idle') {
      capturedRef.current.body = imgEl;
      setPreviewBody(url);
      setScanPhase('body_captured');
      // Restart camera for eye crop
      setCameraActive(true);
    } else if (phase === 'body_captured') {
      capturedRef.current.eye = imgEl;
      setPreviewEye(url);
      setScanPhase('eye_captured');
      setCameraActive(true);
    } else if (phase === 'eye_captured') {
      capturedRef.current.gill = imgEl;
      setPreviewGill(url);
      // All three captured — run inference
      stopCamera();
      await runInference(imgEl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopCamera]);

  // ── Run ONNX fusion inference ──────────────────────────────────────────────
  const runInference = useCallback(async (gillImg: HTMLImageElement) => {
    setScanPhase('processing');
    startProgressBar();
    setError('');

    try {
      const engine = await getEngine();
      const { body, eye } = capturedRef.current;
      if (!body || !eye) throw new Error('Missing captured images.');

      const fusionResult = await engine.predict(body, eye, gillImg) as FusionResult;

      stopProgressBar(100);
      setResult(fusionResult);
      setScanPhase('done');

      // ── Save to backend (non-blocking, offline-safe) ──────────────────────
      // Build a single representative blob from the body image canvas
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 224; canvas.height = 224;
        canvas.getContext('2d')?.drawImage(body, 0, 0, 224, 224);
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          try {
            const saved = await api.submitScan(blob, {
              freshness_label: fusionResult.label,
              fused_score:     fusionResult.fusedScore,
              source:          'edge_onnx',
            });
            if (saved?.scan?.scan_id) {
              sessionStorage.setItem('lastScanId', saved.scan.scan_id);
            }
          } catch {
            // Offline or backend down — result is still shown locally
            console.warn('[FreshScan] Backend save skipped (offline or error).');
          }
        }, 'image/jpeg', 0.85);
      } catch {
        // Non-critical — local result is still valid
      }

      setTimeout(() => navigate('/analysis'), 1800);

    } catch (err) {
      stopProgressBar(0);
      const msg = err instanceof Error ? err.message : 'Inference failed.';
      setError(msg);
      setScanPhase('error');
    }
  }, [startProgressBar, stopProgressBar, navigate]);

  // ── Camera capture ─────────────────────────────────────────────────────────
  const captureFrame = useCallback(async () => {
    if (!isAuthenticated()) { navigate('/auth'); return; }
    const video = videoRef.current;
    if (!video) return;

    const blob = await captureVideoBlob(video);
    if (!blob) { setError('Failed to capture frame.'); return; }

    await storeCapture(blob, scanPhase as ScanPhase);
  }, [scanPhase, storeCapture, navigate]);

  // ── File upload ────────────────────────────────────────────────────────────
  const handleUploadClick = useCallback(() => {
    if (!isAuthenticated()) { navigate('/auth'); return; }
    fileInputRef.current?.click();
  }, [navigate]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';
    await storeCapture(file, scanPhase as ScanPhase);
  }, [scanPhase, storeCapture]);

  // ── Reset ──────────────────────────────────────────────────────────────────
  const resetScan = useCallback(() => {
    setScanPhase('idle');
    setProgress(0);
    setResult(null);
    setError('');
  
    // Revoke object URLs to free memory
    if (previewBody) URL.revokeObjectURL(previewBody);
    if (previewEye)  URL.revokeObjectURL(previewEye);
    if (previewGill) URL.revokeObjectURL(previewGill);
    setPreviewBody(null);
    setPreviewEye(null);
    setPreviewGill(null);

    capturedRef.current = { body: null, eye: null, gill: null };
    setCameraActive(true);
  }, [previewBody, previewEye, previewGill]);

  const toggleCamera = useCallback(() => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const isScanning   = scanPhase === 'processing';
  const scanComplete = scanPhase === 'done';
  const isCapturing  = ['idle', 'body_captured', 'eye_captured'].includes(scanPhase);
  const phaseMeta    = PHASE_META[scanPhase] ?? PHASE_META['processing'];

  // Map ONNX fused score (0–1) to a 0–100 integer — compatible with the
  // Grade-A shareable report feature that expects `freshness >= 85`.
  const freshness = result ? Math.round(result.fusedScore * 100) : null;

  // Step indicator: which step are we on (1, 2, 3)
  const stepIndex = { idle: 1, body_captured: 2, eye_captured: 3 }[scanPhase as string] ?? 0;

  // Active preview to show in viewport
  const activePreview = (() => {
    if (scanPhase === 'body_captured') return previewBody;
    if (scanPhase === 'eye_captured')  return previewEye;
    if (scanPhase === 'done')          return previewBody;
    return null;
  })();

  const terminalMessages = (() => {
    if (scanPhase === 'processing') return ['FUSION_PIPELINE: ACTIVE', `PROGRESS: ${Math.min(Math.round(progress), 100)}%`];
    if (scanComplete && result)     return ['SCAN_SEQ: COMPLETE', `LABEL: ${result.label.toUpperCase()}`, `SCORE: ${(result.fusedScore * 100).toFixed(1)}%`];
    if (scanPhase === 'error')      return ['SCAN_SEQ: FAILED', 'CHECK_SPECIMEN'];
    return phaseMeta.terminal;
  })();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      <div className="relative flex-1 flex flex-col">

        {/* ── Viewport ──────────────────────────────────────────────────── */}
        <div className="relative flex-1 bg-surface-lowest flex items-center justify-center min-h-[60vh] overflow-hidden">

          {/* Live camera or captured preview */}
          {activePreview && !isCapturing ? (
            <img
              src={activePreview}
              alt="Captured preview"
              className="absolute inset-0 w-full h-full object-contain z-0 bg-surface-lowest"
            />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`absolute inset-0 w-full h-full object-cover z-0 ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            />
          )}

          {/* Grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.2] mix-blend-screen pointer-events-none z-10"
            style={{
              backgroundImage: `
                linear-gradient(rgba(195,244,0,0.3) 1px, transparent 1px),
                linear-gradient(90deg, rgba(195,244,0,0.3) 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px',
            }}
          />

          {/* Viewfinder */}
          <div className="relative w-64 h-64 md:w-80 md:h-80 z-20 pointer-events-none">
            <div className="viewfinder-corner top-left" />
            <div className="viewfinder-corner top-right" />
            <div className="viewfinder-corner bottom-left" />
            <div className="viewfinder-corner bottom-right" />

            {isScanning && (
              <div className="absolute inset-x-0 overflow-hidden h-full">
                <div className="scan-line w-full h-0.5 bg-gradient-to-r from-transparent via-neon to-transparent" />
              </div>
            )}

            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              {isCapturing && (
                <>
                  {phaseMeta.icon}
                  <span className="font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest text-on-surface-variant">
                    {phaseMeta.instruction}
                  </span>
                </>
              )}
              {isScanning && (
                <span className="font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest text-neon data-stream">
                  ANALYZING_BIOMARKERS
                </span>
              )}
              {scanComplete && result && (
                <div className="text-center animate-in">
                  <span className={`font-[family-name:var(--font-display)] text-4xl font-bold block ${labelColor(result.label)}`}>
                    {result.label.toUpperCase()}
                  </span>
                  <span className="font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest text-secondary block mt-1">
                    {result.confidence}
                  </span>
                </div>
              )}
              {scanPhase === 'error' && (
                <span className="font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest text-error text-center px-4">
                  {error || 'INFERENCE_FAILED'}
                </span>
              )}
            </div>
          </div>

          {/* Status terminal — top-left */}
          <div className="absolute top-4 left-4 z-20 pointer-events-none">
            <StatusTerminal messages={terminalMessages} />
          </div>

          {/* Step indicator — top-right */}
          {isCapturing && (
            <div className="absolute top-4 right-4 z-20 flex gap-1.5">
              {[1, 2, 3].map(n => (
                <div
                  key={n}
                  className={`w-6 h-1.5 transition-all duration-300 ${
                    n < stepIndex  ? 'bg-neon opacity-100' :
                    n === stepIndex ? 'bg-neon opacity-100 animate-pulse' :
                    'bg-surface-high opacity-40'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Camera controls — hide during processing / done */}
          {isCapturing && !activePreview && (
            <div className="absolute top-4 right-4 flex gap-2 z-20" style={{ top: '2.5rem' }}>
              <button
                onClick={() => setFlashOn(!flashOn)}
                className="w-10 h-10 bg-surface-mid/80 flex items-center justify-center text-on-surface-variant hover:text-neon transition-colors cursor-pointer border-none"
              >
                {flashOn ? <Flashlight size={16} /> : <FlashlightOff size={16} />}
              </button>
            </div>
          )}

          {/* Thumbnail strip — bottom of viewport */}
          {(previewBody || previewEye || previewGill) && (
            <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center gap-2 pointer-events-none">
              {[
                { url: previewBody, label: 'BODY' },
                { url: previewEye,  label: 'EYE'  },
                { url: previewGill, label: 'GILL' },
              ].map(({ url, label }) => (
                <div key={label} className="flex flex-col items-center gap-1">
                  <div className={`w-12 h-12 border ${url ? 'border-neon' : 'border-surface-high opacity-30'} overflow-hidden`}>
                    {url && <img src={url} alt={label} className="w-full h-full object-cover" />}
                  </div>
                  <span className="font-[family-name:var(--font-mono)] text-[0.4rem] tracking-widest text-on-surface-variant">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-surface-low">
          <div
            className="h-full bg-neon transition-all duration-100 ease-out"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>

        {/* ── Controls panel ────────────────────────────────────────────── */}
        <div className="bg-surface-low px-6 py-6">
          <div className="max-w-lg mx-auto">

            {/* Step label */}
            {isCapturing && (
              <p className="font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest text-on-surface-variant mb-3 text-center">
                {stepIndex === 1 && 'STEP 1/3 — PHOTOGRAPH THE WHOLE FISH'}
                {stepIndex === 2 && 'STEP 2/3 — CLOSE-UP OF THE EYE'}
                {stepIndex === 3 && 'STEP 3/3 — CLOSE-UP OF THE GILLS'}
              </p>
            )}

            {!scanComplete && scanPhase !== 'processing' && (
              <div className="flex flex-col gap-3 mb-4">
                {/* Capture / next button */}
                <div className="flex gap-3">
                  <button
                    onClick={captureFrame}
                    disabled={isScanning}
                    className={`flex-1 py-4 font-[family-name:var(--font-display)] font-bold text-sm tracking-wider cursor-pointer transition-all duration-200 border-none flex items-center justify-center gap-3 ${
                      isScanning
                        ? 'bg-surface-high text-on-surface-variant cursor-not-allowed opacity-50'
                        : 'bg-neon text-on-primary hover:bg-neon-dim pulse-glow'
                    }`}
                  >
                    <Camera size={18} />
                    {isCapturing ? phaseMeta.instruction : 'PROCESSING...'}
                  </button>
                  <button
                    onClick={toggleCamera}
                    disabled={isScanning}
                    className="w-14 bg-surface-high flex items-center justify-center text-on-surface-variant hover:text-neon transition-colors cursor-pointer border-none disabled:opacity-50"
                    aria-label="Switch camera"
                  >
                    <SwitchCamera size={18} />
                  </button>
                </div>

                {/* Upload button */}
                <button
                  onClick={handleUploadClick}
                  disabled={isScanning}
                  className={`w-full py-3 font-[family-name:var(--font-display)] font-bold text-sm tracking-wider cursor-pointer transition-all duration-200 border border-on-surface-variant/30 flex items-center justify-center gap-3 ${
                    isScanning
                      ? 'bg-surface-mid text-on-surface-variant cursor-not-allowed opacity-50'
                      : 'bg-surface-mid text-on-surface hover:border-neon hover:text-neon'
                  }`}
                >
                  <Upload size={16} />
                  UPLOAD_PHOTO
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            )}

            {/* Processing state */}
            {scanPhase === 'processing' && (
              <div className="flex items-center justify-center py-4 mb-4 gap-3">
                <Zap size={18} className="text-neon animate-pulse" />
                <span className="font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest text-neon">
                  RUNNING_EDGE_INFERENCE...
                </span>
              </div>
            )}

            {/* Result actions */}
            {scanComplete && result && (
              <div className="flex gap-3 w-full mb-4">
                {/* Score breakdown */}
                <div className="flex-1 bg-surface-mid border border-on-surface-variant/20 p-3">
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {[
                      { label: 'BODY',  val: (result.streamA.probs[0] * 100).toFixed(0) + '%' },
                      { label: 'EYE',   val: (result.streamB_eye.freshScore  * 100).toFixed(0) + '%' },
                      { label: 'GILL',  val: (result.streamB_gill.freshScore * 100).toFixed(0) + '%' },
                    ].map(({ label, val }) => (
                      <div key={label} className="text-center">
                        <span className="font-[family-name:var(--font-mono)] text-[0.45rem] tracking-widest text-on-surface-variant block">
                          {label}
                        </span>
                        <span className="font-[family-name:var(--font-display)] text-sm font-bold text-neon">
                          {val}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="h-px bg-on-surface-variant/20 my-2" />
                  <div className="text-center">
                    <span className="font-[family-name:var(--font-mono)] text-[0.45rem] tracking-widest text-on-surface-variant block">
                      FUSED_SCORE
                    </span>
                    <span className={`font-[family-name:var(--font-display)] text-lg font-bold ${labelColor(result.label)}`}>
                      {result.confidence}
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => navigate('/analysis')}
                    className="flex-1 bg-neon text-on-primary px-4 font-[family-name:var(--font-display)] font-bold text-xs tracking-wider text-center transition-all duration-200 hover:bg-neon-dim border-none cursor-pointer flex items-center justify-center"
                  >
                    VIEW_ANALYSIS
                  </button>
                  <button
                    onClick={resetScan}
                    className="w-14 h-10 bg-surface-high flex items-center justify-center text-on-surface-variant hover:text-neon transition-colors cursor-pointer border-none"
                  >
                    <RotateCcw size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* Error state */}
            {scanPhase === 'error' && (
              <div className="flex gap-3 mb-4">
                <span className="flex-1 font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest text-error self-center">
                  {error}
                </span>
                <button
                  onClick={resetScan}
                  className="w-14 h-10 bg-surface-high flex items-center justify-center text-on-surface-variant hover:text-neon transition-colors cursor-pointer border-none"
                >
                  <RotateCcw size={18} />
                </button>
              </div>
            )}

            {/* Grade-A shareable report */}
            {scanComplete && freshness !== null && freshness >= 85 && (
              <div className="flex flex-col gap-3 mt-1 mb-4">
                <button
                  onClick={() => {
                    const scanId = sessionStorage.getItem('lastScanId');
                    if (scanId) {
                      navigator.clipboard.writeText(`${window.location.origin}/report/${scanId}`);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }
                  }}
                  className="w-full py-3 bg-secondary text-on-primary font-[family-name:var(--font-display)] font-bold text-sm tracking-wider cursor-pointer border-none transition-colors hover:brightness-110 flex items-center justify-center gap-2"
                >
                  {copied ? 'COPIED TO CLIPBOARD' : 'SHARE GRADE-A REPORT'}
                </button>
              </div>
            )}

            <StatusTerminal
              messages={['MODEL: EDGE_ONNX', 'DEVICE: ON_DEVICE', 'LATENCY: <50ms']}
              className="justify-center"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
