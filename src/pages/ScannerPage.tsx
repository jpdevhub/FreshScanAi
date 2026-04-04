import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Zap, RotateCcw, FlashlightOff, Flashlight, SwitchCamera } from 'lucide-react';
import StatusTerminal from '../components/StatusTerminal';

export default function ScannerPage() {
  const [progress, setProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let currentStream: MediaStream | null = null;
    
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode }
        });
        currentStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(console.error);
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
      }
    }

    startCamera();

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  const toggleCamera = useCallback(() => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  }, []);

  const startScan = useCallback(() => {
    setIsScanning(true);
    setScanComplete(false);
    setProgress(0);
  }, []);

  const resetScan = useCallback(() => {
    setIsScanning(false);
    setScanComplete(false);
    setProgress(0);
  }, []);

  useEffect(() => {
    if (!isScanning || scanComplete) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsScanning(false);
          setScanComplete(true);
          return 100;
        }
        return prev + Math.random() * 3 + 1;
      });
    }, 80);

    return () => clearInterval(interval);
  }, [isScanning, scanComplete]);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Scanner Viewport */}
      <div className="relative flex-1 flex flex-col">
        {/* Camera View Area */}
        <div className="relative flex-1 bg-surface-lowest flex items-center justify-center min-h-[60vh] overflow-hidden">
          {/* Live Camera Feed */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover z-0 ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
          />

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

            {/* Scan line */}
            {isScanning && (
              <div className="absolute inset-x-0 overflow-hidden h-full">
                <div className="scan-line w-full h-0.5 bg-gradient-to-r from-transparent via-neon to-transparent" />
              </div>
            )}

            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              {!isScanning && !scanComplete && (
                <>
                  <Camera size={32} className="text-on-surface-variant" />
                  <span className="font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest text-on-surface-variant">
                    POSITION_SPECIMEN
                  </span>
                </>
              )}
              {isScanning && (
                <span className="font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest text-neon data-stream">
                  ANALYZING_BIOMARKERS
                </span>
              )}
              {scanComplete && (
                <div className="text-center animate-in">
                  <span className="font-[family-name:var(--font-display)] text-5xl font-bold text-neon block">
                    87
                  </span>
                  <span className="font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest text-secondary">
                    FRESHNESS_INDEX
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Top-left Status */}
          <div className="absolute top-4 left-4 z-20 pointer-events-none">
            <StatusTerminal
              messages={
                isScanning
                  ? ['SCAN_SEQ: ACTIVE', `PROGRESS: ${Math.min(Math.round(progress), 100)}%`]
                  : scanComplete
                    ? ['SCAN_SEQ: COMPLETE', 'GRADE: A']
                    : ['SCAN_SEQ: STANDBY', 'AWAITING_INPUT']
              }
            />
          </div>

          {/* Top-right controls */}
          <div className="absolute top-4 right-4 flex gap-2 z-20">
            <button
              onClick={() => setFlashOn(!flashOn)}
              className="w-10 h-10 bg-surface-mid/80 flex items-center justify-center text-on-surface-variant hover:text-neon transition-colors cursor-pointer border-none"
            >
              {flashOn ? <Flashlight size={16} /> : <FlashlightOff size={16} />}
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-surface-low">
          <div
            className="h-full bg-neon transition-all duration-100 ease-out"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>

        {/* Controls Panel */}
        <div className="bg-surface-low px-6 py-6">
          <div className="max-w-lg mx-auto">
            {/* Main Action */}
            <div className="flex items-center justify-center gap-4 mb-4">
              {!scanComplete ? (
                <div className="flex gap-3 w-full">
                  <button
                    onClick={startScan}
                    disabled={isScanning}
                    className={`flex-1 py-4 font-[family-name:var(--font-display)] font-bold text-sm tracking-wider cursor-pointer transition-all duration-200 border-none flex items-center justify-center gap-3 ${
                      isScanning
                        ? 'bg-surface-high text-on-surface-variant cursor-not-allowed'
                        : 'bg-neon text-on-primary hover:bg-neon-dim pulse-glow'
                    }`}
                  >
                    <Zap size={18} />
                    {isScanning ? 'PROCESSING...' : 'INITIATE_SCAN'}
                  </button>
                  <button
                    onClick={toggleCamera}
                    disabled={isScanning}
                    className="w-14 bg-surface-high flex items-center justify-center text-on-surface-variant hover:text-neon transition-colors cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Switch Camera"
                  >
                    <SwitchCamera size={18} />
                  </button>
                </div>
              ) : (
                <div className="flex gap-3 w-full">
                  <Link
                    to="/analysis"
                    className="flex-1 bg-neon text-on-primary py-4 font-[family-name:var(--font-display)] font-bold text-sm tracking-wider no-underline text-center transition-all duration-200 hover:bg-neon-dim"
                  >
                    VIEW_ANALYSIS
                  </Link>
                  <button
                    onClick={resetScan}
                    className="w-14 bg-surface-high flex items-center justify-center text-on-surface-variant hover:text-neon transition-colors cursor-pointer border-none"
                  >
                    <RotateCcw size={18} />
                  </button>
                </div>
              )}
            </div>

            {/* Status Footer */}
            <StatusTerminal
              messages={['MODEL: TFLite_v4.2', 'DEVICE: ON_EDGE', 'LATENCY: 47ms']}
              className="justify-center"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
