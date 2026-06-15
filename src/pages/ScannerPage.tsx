import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Camera,
  Zap,
  RotateCcw,
  FlashlightOff,
  Flashlight,
  SwitchCamera,
  Upload,
} from "lucide-react";
import StatusTerminal from "../components/StatusTerminal";
import { api, isAuthenticated } from "../lib/api";
import { FishFreshnessInference } from "../fusionInference.js";
import type { ScanResult } from "../lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ScanPhase = "idle" | "processing" | "done" | "error";
type InferenceMode = "cloud" | "edge" | null;

/** Normalised result — maps both HF backend and ONNX outputs to one shape. */
interface DisplayResult {
  label: "Fresh" | "Moderate" | "Spoiled";
  freshness: number; // 0–100 integer
  grade: string; // A+, A, B, C, D (cloud) or derived (edge)
  confidence: string; // formatted percentage string
}

// ─────────────────────────────────────────────────────────────────────────────
// Grade derivation (mirrors backend _derive_grade)
// ─────────────────────────────────────────────────────────────────────────────

function deriveGrade(freshness: number): string {
  if (freshness >= 92) return "A+";
  if (freshness >= 80) return "A";
  if (freshness >= 65) return "B";
  if (freshness >= 50) return "C";
  return "D";
}

function labelColor(label: string) {
  if (label === "Fresh") return "text-neon";
  if (label === "Moderate") return "text-secondary";
  return "text-error";
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton ONNX engine (pre-warmed on mount)
// ─────────────────────────────────────────────────────────────────────────────

let engineInstance: FishFreshnessInference | null = null;
let engineReady = false;
let engineLoading = false;

async function getEngine(): Promise<FishFreshnessInference> {
  if (engineReady && engineInstance) return engineInstance;
  if (engineLoading) {
    await new Promise<void>((resolve) => {
      const poll = setInterval(() => {
        if (engineReady) {
          clearInterval(poll);
          resolve();
        }
      }, 100);
    });
    return engineInstance!;
  }
  engineLoading = true;
  engineInstance = new FishFreshnessInference();
  await engineInstance.loadModels();
  engineReady = true;
  engineLoading = false;
  return engineInstance;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function captureVideoBlob(video: HTMLVideoElement): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  canvas.getContext("2d")?.drawImage(video, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
}

async function blobToImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ScannerPage() {
  const navigate = useNavigate();

  // ── State ──────────────────────────────────────────────────────────────────
  const [scanPhase, setScanPhase] = useState<ScanPhase>("idle");
  const [inferenceMode, setInferenceMode] = useState<InferenceMode>(null);
  const [result, setResult] = useState<DisplayResult | null>(null);
  const [error, setError] = useState("");
  const [flashOn, setFlashOn] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment",
  );
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Pre-warm ONNX engine on mount (runs in background) ────────────────────
  useEffect(() => {
    getEngine().catch(console.error);
  }, []);

  // ── Camera stream ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (scanPhase !== "idle") return;
    let cancelled = false;
    const currentVideo = videoRef.current;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        setCameraError(null);
        streamRef.current = stream;

        if (currentVideo) {
          currentVideo.srcObject = stream;
        }
      })
      .catch((err) => {
        if (cancelled) return;

        console.error("Camera error:", err);

        if (err instanceof DOMException) {
          if (err.name === "NotAllowedError") {
            setCameraError("Camera permission was denied");
          } else if (err.name === "NotFoundError") {
            setCameraError(
              "No camera was found on this device. Please connect a camera and try again.",
            );
          } else {
            setCameraError(
              "Unable to access the camera. Please check your browser permissions and try again.",
            );
          }
        } else {
          setCameraError("Something went wrong while accessing the camera.");
        }
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      if (currentVideo) {
        currentVideo.srcObject = null;
      }
    };
  }, [facingMode, scanPhase]);

  // ── Progress bar animation ─────────────────────────────────────────────────
  const startProgress = useCallback(() => {
    setProgress(0);
    progressRef.current = setInterval(() => {
      setProgress((prev) => (prev >= 90 ? prev : prev + Math.random() * 5 + 1));
    }, 120);
  }, []);

  const stopProgress = useCallback((final: number) => {
    if (progressRef.current) clearInterval(progressRef.current);
    setProgress(final);
  }, []);

  // ── Stop camera ────────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // ── Core: run hybrid inference on a single blob ────────────────────────────
  const runScan = useCallback(
    async (blob: Blob) => {
      setScanPhase("processing");
      startProgress();
      setError("");
      setInferenceMode(null);
      sessionStorage.removeItem("lastScanId");

      // Store preview
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      stopCamera();

      try {
        // ── Path A: online — try HF backend first ─────────────────────────────
        const online = await api.scanOnline(blob);

        if (online) {
          // Cloud inference succeeded — use typed ScanResult fields directly
          const s: ScanResult = online.scan;
          const freshness = s.freshness_index;
          stopProgress(100);
          setInferenceMode("cloud");
          setResult({
            label: s.is_fresh
              ? freshness >= 80
                ? "Fresh"
                : "Moderate"
              : "Spoiled",
            freshness,
            grade: s.grade,
            confidence: `${Math.round((s.confidence ?? 0.9) * 100)}%`,
          });

          if (s.scan_id) {
            sessionStorage.setItem("lastScanId", s.scan_id);
          }
          setScanPhase("done");
          setTimeout(() => navigate("/analysis"), 1800);
          return;
        }

        // ── Path B: offline — fall back to ONNX ───────────────────────────────
        setInferenceMode("edge");
        const imgEl = await blobToImageElement(blob);
        const engine = await getEngine();
        const fusion = await engine.predictSingle(imgEl);

        stopProgress(100);
        const freshness = Math.round(fusion.fusedScore * 100);
        setResult({
          label: fusion.label,
          freshness,
          grade: deriveGrade(freshness),
          confidence: fusion.confidence,
        });
        setScanPhase("done");

        // Best-effort backend save (non-blocking, offline-safe)
        const canvas = document.createElement("canvas");
        canvas.width = 224;
        canvas.height = 224;
        canvas.getContext("2d")?.drawImage(imgEl, 0, 0, 224, 224);
        canvas.toBlob(
          async (saveBlob) => {
            if (!saveBlob) return;
            try {
              const saved = await api.submitScan(
                saveBlob,
                {
                  freshness_label: fusion.label,
                  fused_score: fusion.fusedScore,
                  source: "edge_onnx",
                },
                { silent: true },
              );
              if (saved?.scan?.scan_id) {
                sessionStorage.setItem("lastScanId", saved.scan.scan_id);
              }
            } catch {
              /* offline or backend down — result still shown locally */
            }
          },
          "image/jpeg",
          0.85,
        );

        setTimeout(() => navigate("/analysis"), 1800);
      } catch (err) {
        stopProgress(0);
        const msg = err instanceof Error ? err.message : "Inference failed.";
        const isNotFish =
          msg.includes("NOT_A_FISH") ||
          msg.includes("not appear to contain a fish");
        setError(
          isNotFish
            ? "NOT_A_FISH: No fish detected. Please photograph a fish."
            : msg,
        );
        setScanPhase("error");
      }
    },
    [startProgress, stopProgress, stopCamera, navigate],
  );

  // ── Camera capture ─────────────────────────────────────────────────────────
  const captureFrame = useCallback(async () => {
    if (!isAuthenticated()) {
      navigate("/auth");
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    const blob = await captureVideoBlob(video);
    if (!blob) {
      setError("Failed to capture frame.");
      return;
    }
    await runScan(blob);
  }, [runScan, navigate]);

  // ── File upload ────────────────────────────────────────────────────────────
  const handleUploadClick = useCallback(() => {
    if (!isAuthenticated()) {
      navigate("/auth");
      return;
    }
    fileInputRef.current?.click();
  }, [navigate]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (fileInputRef.current) fileInputRef.current.value = "";
      await runScan(file);
    },
    [runScan],
  );

  // ── Reset ──────────────────────────────────────────────────────────────────
  const resetScan = useCallback(() => {
    setScanPhase("idle");
    setResult(null);
    setError("");
    setInferenceMode(null);
    setProgress(0);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [previewUrl]);

  const toggleCamera = useCallback(() => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const isScanning = scanPhase === "processing";
  const scanComplete = scanPhase === "done";
  const freshness = result?.freshness ?? null;

  const terminalMessages = (() => {
    if (isScanning && inferenceMode === "edge")
      return ["MODE: EDGE_ONNX", "RUNNING_LOCAL_INFERENCE..."];
    if (isScanning && inferenceMode === "cloud")
      return ["MODE: CLOUD_API", "CONNECTING_TO_HF..."];
    if (isScanning) return ["DETECTING_MODEL...", "PLEASE_WAIT"];
    if (scanComplete && inferenceMode === "edge")
      return ["MODEL: EDGE_ONNX", "DEVICE: ON_DEVICE", "LATENCY: <50ms"];
    if (scanComplete && inferenceMode === "cloud")
      return ["MODEL: CLOUD_API", "DEVICE: HF_INFERENCE"];
    if (scanPhase === "error") return ["SCAN_SEQ: FAILED", "CHECK_SPECIMEN"];
    return ["SYSTEM: READY", "POINT_CAMERA_AT_FISH"];
  })();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      <div className="relative flex-1 flex flex-col">
        {/* ── Viewport ──────────────────────────────────────────────────── */}
        <div className="relative flex-1 bg-surface-lowest flex items-center justify-center min-h-[60vh] overflow-hidden">
          {/* Preview or live camera */}
          {previewUrl && !isScanning ? (
            <img
              src={previewUrl}
              alt="Captured"
              className="absolute inset-0 w-full h-full object-contain z-0 bg-surface-lowest"
            />
          ) : cameraError ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black px-6 text-center text-white">
              <div className="max-w-sm">
                <h3 className="mb-2 text-lg font-semibold">
                  Camera Access Needed
                </h3>

                <p className="text-sm text-gray-300">{cameraError}</p>

                <p className="mt-3 text-xs text-gray-400">
                  Click the camera icon in your browser's address bar, allow
                  camera access, and refresh the page.
                </p>
              </div>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`absolute inset-0 w-full h-full object-cover z-0 ${
                facingMode === "user" ? "scale-x-[-1]" : ""
              }`}
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
              backgroundSize: "40px 40px",
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
              {scanPhase === "idle" && (
                <>
                  {!cameraError && (
                    <span className="font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest text-on-surface-variant">
                      POINT_AT_FISH
                    </span>
                  )}
                </>
              )}
              {isScanning && (
                <span className="font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest text-neon data-stream">
                  ANALYZING_BIOMARKERS
                </span>
              )}
              {scanComplete && result && (
                <div className="text-center animate-in">
                  <span
                    className={`font-[family-name:var(--font-display)] text-4xl font-bold block ${labelColor(result.label)}`}
                  >
                    {result.label.toUpperCase()}
                  </span>
                  <span className="font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest text-secondary block mt-1">
                    {result.confidence} · GRADE {result.grade}
                  </span>
                </div>
              )}
              {scanPhase === "error" && (
                <span className="font-[family-name:var(--font-mono)] text-[0.55rem] tracking-widest text-error text-center px-6">
                  {error}
                </span>
              )}
            </div>
          </div>

          {/* Status terminal — top-left */}
          <div className="absolute top-4 left-4 z-20 pointer-events-none">
            <StatusTerminal messages={terminalMessages} />
          </div>

          {/* Mode badge — top-right */}
          {inferenceMode && (
            <div className="absolute top-4 right-4 z-20">
              <span
                className={`font-[family-name:var(--font-mono)] text-[0.45rem] tracking-widest px-2 py-1 border ${
                  inferenceMode === "edge"
                    ? "border-neon text-neon bg-neon/10"
                    : "border-secondary text-secondary bg-secondary/10"
                }`}
              >
                {inferenceMode === "edge" ? "EDGE_ONNX" : "CLOUD_API"}
              </span>
            </div>
          )}

          {/* Flash toggle — only in idle */}
          {scanPhase === "idle" && (
            <div className="absolute top-4 right-4 flex gap-2 z-20">
              <button
                onClick={() => setFlashOn(!flashOn)}
                className="w-10 h-10 bg-surface-mid/80 flex items-center justify-center text-on-surface-variant hover:text-neon transition-colors cursor-pointer border-none"
              >
                {flashOn ? (
                  <Flashlight size={16} />
                ) : (
                  <FlashlightOff size={16} />
                )}
              </button>
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
            {/* Idle: capture buttons */}
            {scanPhase === "idle" && (
              <div className="flex flex-col gap-3 mb-4">
                <div className="flex gap-3">
                  <button
                    id="capture-btn"
                    onClick={captureFrame}
                    className="flex-1 py-4 bg-neon text-on-primary font-[family-name:var(--font-display)] font-bold text-sm tracking-wider cursor-pointer border-none flex items-center justify-center gap-3 hover:bg-neon-dim pulse-glow transition-all duration-200"
                  >
                    <Camera size={18} />
                    CAPTURE_FISH
                  </button>
                  <button
                    onClick={toggleCamera}
                    className="w-14 bg-surface-high flex items-center justify-center text-on-surface-variant hover:text-neon transition-colors cursor-pointer border-none"
                    aria-label="Switch camera"
                  >
                    <SwitchCamera size={18} />
                  </button>
                </div>

                <button
                  id="upload-btn"
                  onClick={handleUploadClick}
                  className="w-full py-3 bg-surface-mid text-on-surface font-[family-name:var(--font-display)] font-bold text-sm tracking-wider cursor-pointer border border-on-surface-variant/30 hover:border-neon hover:text-neon flex items-center justify-center gap-3 transition-all duration-200"
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
            {isScanning && (
              <div className="flex items-center justify-center py-4 mb-4 gap-3">
                <Zap size={18} className="text-neon animate-pulse" />
                <span className="font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest text-neon">
                  {inferenceMode === "edge"
                    ? "RUNNING_EDGE_INFERENCE..."
                    : "RUNNING_CLOUD_INFERENCE..."}
                </span>
              </div>
            )}

            {/* Done: result + actions */}
            {scanComplete && result && (
              <div className="flex flex-col gap-3 mb-4">
                {/* Freshness score bar */}
                <div className="bg-surface-mid border border-on-surface-variant/20 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-[family-name:var(--font-mono)] text-[0.55rem] tracking-widest text-on-surface-variant">
                      FRESHNESS_INDEX
                    </span>
                    <span
                      className={`font-[family-name:var(--font-display)] text-lg font-bold ${labelColor(result.label)}`}
                    >
                      {result.freshness}
                    </span>
                  </div>
                  <div className="h-1.5 bg-surface-high">
                    <div
                      className={`h-full transition-all duration-700 ${result.freshness >= 65 ? "bg-neon" : result.freshness >= 35 ? "bg-secondary" : "bg-error"}`}
                      style={{ width: `${result.freshness}%` }}
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => navigate("/analysis")}
                    className="flex-1 py-3 bg-neon text-on-primary font-[family-name:var(--font-display)] font-bold text-xs tracking-wider border-none cursor-pointer flex items-center justify-center hover:bg-neon-dim transition-all duration-200"
                  >
                    VIEW_ANALYSIS
                  </button>
                  <button
                    onClick={resetScan}
                    className="w-14 bg-surface-high flex items-center justify-center text-on-surface-variant hover:text-neon transition-colors cursor-pointer border-none"
                  >
                    <RotateCcw size={18} />
                  </button>
                </div>

                {/* Grade-A shareable report — only when backend scan ID available */}
                {freshness !== null && freshness >= 85 && (
                  <button
                    onClick={() => {
                      const scanId = sessionStorage.getItem("lastScanId");
                      if (scanId) {
                        navigator.clipboard.writeText(
                          `${window.location.origin}/report/${scanId}`,
                        );
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }
                    }}
                    className="w-full py-3 bg-secondary text-on-primary font-[family-name:var(--font-display)] font-bold text-sm tracking-wider cursor-pointer border-none transition-colors hover:brightness-110 flex items-center justify-center gap-2"
                  >
                    {copied ? "COPIED TO CLIPBOARD" : "SHARE GRADE-A REPORT"}
                  </button>
                )}
              </div>
            )}

            {/* Error state */}
            {scanPhase === "error" && (
              <div className="flex gap-3 mb-4">
                <span className="flex-1 font-[family-name:var(--font-mono)] text-[0.55rem] tracking-widest text-error self-center">
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

            <StatusTerminal
              messages={terminalMessages}
              className="justify-center"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
