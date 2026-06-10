export interface StreamAResult {
  logits: number[];
  probs: number[];
  prediction: { label: string; confidence: number; index: number };
}

export interface StreamBResult {
  logits: number[];
  freshScore: number;
  probs: number[];
}

export interface FusionResult {
  label: 'Fresh' | 'Moderate' | 'Spoiled';
  fusedScore: number;
  confidence: string;
  streamA: StreamAResult;
  streamB_eye: StreamBResult;
  streamB_gill: StreamBResult;
}

export interface SmokeTestResult {
  r1: FusionResult;
  r2: FusionResult;
  r3: FusionResult;
}

export class FishFreshnessInference {
  constructor(modelPaths?: { streamA?: string; streamB?: string });
  loadModels(): Promise<void>;
  /** Three separate images — full 3-step capture flow. */
  predict(
    body: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
    eye:  HTMLImageElement | HTMLCanvasElement | ImageBitmap,
    gill: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  ): Promise<FusionResult>;
  /**
   * Single-image flow — mirrors HF backend scan_auto: the same image is used
   * for body, eye, and gill streams. Throws Error('NOT_A_FISH') if the image
   * confidence is below the fish detection threshold.
   */
  predictSingle(
    image: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  ): Promise<FusionResult>;
  dispose(): Promise<void>;
}


export function fuseFromLogits(
  bodyLogits: number[],
  eyeLogitsB: number[],
  gillLogitsB: number[],
  opts?: { tempA?: number; tempB?: number }
): FusionResult;

export function smokeTest(): SmokeTestResult;
