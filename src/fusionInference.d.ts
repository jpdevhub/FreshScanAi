export class FishFreshnessInference {
  constructor(modelPaths?: { streamA?: string; streamB?: string });
  loadModels(): Promise<void>;
  predict(body: HTMLImageElement, eye: HTMLImageElement, gill: HTMLImageElement): Promise<any>;
  dispose(): Promise<void>;
}

export function fuseFromLogits(
  bodyLogits: number[],
  eyeLogitsB: number[],
  gillLogitsB: number[],
  opts?: { tempA?: number; tempB?: number }
): any;

export function smokeTest(): any;
