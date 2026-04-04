import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Zap, RotateCcw, FlashlightOff, Flashlight, SwitchCamera, Upload } from 'lucide-react';
import StatusTerminal from '../components/StatusTerminal';
import { api, isAuthenticated } from '../lib/api';

export default function ScannerPage() {
  const navigate = useNavigate();

  const [scanPhase, setScanPhase] = useState<'idle' | 'capturing' | 'processing' | 'done' | 'error'>('idle');
  const [progress, setProgress]   = useState(0);
  const [freshness, setFreshness] = useState<number | null>(null);
  const [error, setError]         = useState('');
  const [flashOn, setFlashOn]     = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  // Controls whether the camera stream is active
  const [cameraActive, setCameraActive] = useState(true);

  const videoRef      = useRef<HTMLVideoElement>(null);
  const progressRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const streamRef     = useRef<MediaStream | null>(null);

  // ── Camera stream — only runs when cameraActive and no upload preview ────
  useEffect(() => {
    if (!cameraActive || uploadPreviewUrl) return;

    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        if (!cancelled) console.error('Camera error:', err);
      }
    }

    startCamera();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [facingMode, cameraActive, uploadPreviewUrl]);

  // ── Progress bar ───────────────────────────────────────────────────────────
  const startProgressBar = useCallback(() => {
    setProgress(0);
    progressRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 4 + 1;
      });
    }, 100);
  }, []);

  const stopProgressBar = useCallback((final: number) => {
    if (progressRef.current) clearInterval(progressRef.current);
    setProgress(final);
  }, []);

  // ── Shared: submit blob to API then navigate ───────────────────────────────
  const submitAndNavigate = useCallback(async (blob: Blob) => {
    setScanPhase('processing');
    startProgressBar();

    try {
      const result = await api.submitScan(blob);
      stopProgressBar(100);
      sessionStorage.setItem('lastScanId', result.scan.scan_id);
      setFreshness(result.scan.freshness_index);
      setScanPhase('done');
      // Auto-navigate to analysis after a short "done" flash
      setTimeout(() => navigate('/analysis'), 1200);
    } catch (err) {
      stopProgressBar(0);
      const msg = err instanceof Error ? err.message : 'Scan failed.';
      setError(msg);
      setScanPhase('error');
      // Restart camera & clear preview so user can try again immediately
      setUploadPreviewUrl(null);
      setCameraActive(true);
    }
  }, [startProgressBar, stopProgressBar, navigate]);

  // ── Camera scan ────────────────────────────────────────────────────────────
  const captureFrame = useCallback((): Promise<Blob | null> => {
    return new Promise(resolve => {
      const video = videoRef.current;
      if (!video) return resolve(null);
      const canvas = document.createElement('canvas');
      canvas.width  = video.videoWidth  || 640;
      canvas.height = video.videoHeight || 480;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.92);
    });
  }, []);

  const startScan = useCallback(async () => {
    if (!isAuthenticated()) { navigate('/auth'); return; }
    setScanPhase('capturing');
    setError('');

    // Stop camera immediately after capture — restarts on reset
    const blob = await captureFrame();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    if (!blob) {
      setError('Failed to capture camera frame.');
      setScanPhase('error');
      setCameraActive(true); // restart camera so user can try again
      return;
    }
    await submitAndNavigate(blob);
  }, [captureFrame, submitAndNavigate, navigate]);

  // ── Photo upload ───────────────────────────────────────────────────────────
  const handleUploadClick = useCallback(() => {
    if (!isAuthenticated()) { navigate('/auth'); return; }
    fileInputRef.current?.click();
  }, [navigate]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview & stop camera
    const url = URL.createObjectURL(file);
    setUploadPreviewUrl(url);
    setError('');

    await submitAndNavigate(file);

    // Cleanup object URL after use
    URL.revokeObjectURL(url);
  }, [submitAndNavigate]);

  const resetScan = useCallback(() => {
    setScanPhase('idle');
    setProgress(0);
    setFreshness(null);
    setError('');
    setUploadPreviewUrl(null);
    setCameraActive(true);          // restart camera on reset
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const toggleCamera = useCallback(() => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  }, []);

  const isScanning   = scanPhase === 'capturing' || scanPhase === 'processing';
  const scanComplete = scanPhase === 'done';

  const terminalMessages = (() => {
    if (scanPhase === 'capturing')  return ['SCAN_SEQ: ACTIVE', 'CAPTURING_FRAME'];
    if (scanPhase === 'processing') return ['SCAN_SEQ: ACTIVE', `PROGRESS: ${Math.min(Math.round(progress), 100)}%`];
    if (scanComplete)               return ['SCAN_SEQ: COMPLETE', `FRESHNESS: ${freshness}`];
    if (scanPhase === 'error')      return ['SCAN_SEQ: FAILED', 'CHECK_SPECIMEN'];
    return ['SCAN_SEQ: STANDBY', 'AWAITING_INPUT'];
  })();

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      <div className="relative flex-1 flex flex-col">

        {/* Camera / Upload preview viewport */}
        <div className="relative flex-1 bg-surface-lowest flex items-center justify-center min-h-[60vh] overflow-hidden">

          {uploadPreviewUrl ? (
            /* Uploaded image preview */
            <img
              src={uploadPreviewUrl}
              alt="Upload preview"
              className="absolute inset-0 w-full h-full object-contain z-0 bg-surface-lowest"
            />
          ) : (
            /* Live camera feed */
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
                linear-gradient(rgba(195, 244, 0, 0.3) 1px, transparent 1px),
                linear-gradient(90deg, rgba(195, 244, 0, 0.3) 1px, transparent 1px)
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
              {scanPhase === 'idle' && !uploadPreviewUrl && (
                <>
                  <Camera size={32} className="text-on-surface-variant" />
                  <span className="font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest text-on-surface-variant">
                    POSITION_SPECIMEN
                  </span>
                </>
              )}
              {scanPhase === 'idle' && uploadPreviewUrl && (
                <span className="font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest text-neon">
                  IMAGE_LOADED
                </span>
              )}
              {isScanning && (
                <span className="font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest text-neon data-stream">
                  ANALYZING_BIOMARKERS
                </span>
              )}
              {scanComplete && freshness !== null && (
                <div className="text-center animate-in">
                  <span className="font-[family-name:var(--font-display)] text-5xl font-bold text-neon block">
                    {freshness}
                  </span>
                  <span className="font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest text-secondary">
                    FRESHNESS_INDEX
                  </span>
                </div>
              )}
              {scanPhase === 'error' && (
                <span className="font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest text-error text-center px-4">
                  {error || 'SCAN_FAILED'}
                </span>
              )}
            </div>
          </div>

          {/* Status top-left */}
          <div className="absolute top-4 left-4 z-20 pointer-events-none">
            <StatusTerminal messages={terminalMessages} />
          </div>

          {/* Camera controls top-right — hide when showing upload preview */}
          {!uploadPreviewUrl && (
            <div className="absolute top-4 right-4 flex gap-2 z-20">
              <button
                onClick={() => setFlashOn(!flashOn)}
                className="w-10 h-10 bg-surface-mid/80 flex items-center justify-center text-on-surface-variant hover:text-neon transition-colors cursor-pointer border-none"
              >
                {flashOn ? <Flashlight size={16} /> : <FlashlightOff size={16} />}
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

        {/* Controls panel */}
        <div className="bg-surface-low px-6 py-6">
          <div className="max-w-lg mx-auto">

            {!scanComplete ? (
              <div className="flex flex-col gap-3 mb-4">
                {/* Row 1: INITIATE_SCAN + camera toggle */}
                <div className="flex gap-3">
                  <button
                    onClick={startScan}
                    disabled={isScanning || !!uploadPreviewUrl}
                    className={`flex-1 py-4 font-[family-name:var(--font-display)] font-bold text-sm tracking-wider cursor-pointer transition-all duration-200 border-none flex items-center justify-center gap-3 ${
                      isScanning || uploadPreviewUrl
                        ? 'bg-surface-high text-on-surface-variant cursor-not-allowed opacity-50'
                        : 'bg-neon text-on-primary hover:bg-neon-dim pulse-glow'
                    }`}
                  >
                    <Zap size={18} />
                    {isScanning ? 'PROCESSING...' : 'INITIATE_SCAN'}
                  </button>
                  <button
                    onClick={toggleCamera}
                    disabled={isScanning || !!uploadPreviewUrl}
                    className="w-14 bg-surface-high flex items-center justify-center text-on-surface-variant hover:text-neon transition-colors cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Switch Camera"
                  >
                    <SwitchCamera size={18} />
                  </button>
                </div>

                {/* Row 2: UPLOAD_PHOTO */}
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

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            ) : (
              <div className="flex gap-3 w-full mb-4">
                <button
                  onClick={() => navigate('/analysis')}
                  className="flex-1 bg-neon text-on-primary py-4 font-[family-name:var(--font-display)] font-bold text-sm tracking-wider text-center transition-all duration-200 hover:bg-neon-dim border-none cursor-pointer"
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
            )}

            <StatusTerminal
              messages={['MODEL: STREAM_DUAL', 'DEVICE: ON_EDGE', 'LATENCY: <50ms']}
              className="justify-center"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
