import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Droplets, Eye as EyeIcon, Fish, MoveHorizontal, Sparkles, Image as ImageIcon } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import StatusTerminal from '../components/StatusTerminal';
import { api } from '../lib/api';
import type { ScanResult } from '../lib/types';

const BIOMARKER_META = {
  gill_saturation:   { label: 'Gill Saturation',   icon: Droplets },
  corneal_clarity:   { label: 'Corneal Clarity',    icon: EyeIcon  },
  epidermal_tension: { label: 'Epidermal Tension',  icon: Fish     },
} as const;

type BiomarkerKey = keyof typeof BIOMARKER_META;

function gradeColor(grade: string) {
  if (grade === 'A+' || grade === 'A') return 'text-secondary';
  if (grade === 'B')                   return 'text-neon';
  return 'text-error';
}

// ── Fish Image Overlay Component with Grad-CAM support ────────────────────────

interface FishImageOverlayProps {
  photoUrl?: string | null;
  scanId: string;
}

function FishImageOverlay({ photoUrl, scanId }: FishImageOverlayProps) {
  const [originalSrc, setOriginalSrc] = useState<string | null>(null);
  const [heatmapSrc, setHeatmapSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'toggle' | 'slider'>('slider');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchHeatmap() {
      let imgSrc = photoUrl;
      const lastScanId = sessionStorage.getItem('lastScanId');
      const lastScanImage = sessionStorage.getItem('lastScanImage');
      if (lastScanId === scanId && lastScanImage) {
        imgSrc = lastScanImage;
      }

      if (!imgSrc) {
        return;
      }

      setOriginalSrc(imgSrc);
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(imgSrc);
        const blob = await response.blob();
        const res = await api.getGradcam(blob);
        setHeatmapSrc(res.gradcam_image);
      } catch (err: unknown) {
        console.error('Failed to load GradCAM overlay:', err);
        setError(err instanceof Error ? err.message : 'Failed to generate heatmap.');
      } finally {
        setLoading(false);
      }
    }

    fetchHeatmap();
  }, [photoUrl, scanId]);

  const onMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(percentage);
  }, []);

  const startDrag = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    if ('touches' in e && e.touches[0]) {
      onMove(e.touches[0].clientX);
    } else if ('clientX' in e) {
      onMove(e.clientX);
    }
  }, [onMove]);

  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent) => {
      if (isDragging) onMove(e.clientX);
    };
    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches[0]) onMove(e.touches[0].clientX);
    };
    const handleGlobalUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleGlobalMove);
      window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
      window.addEventListener('mouseup', handleGlobalUp);
      window.addEventListener('touchend', handleGlobalUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleGlobalMove);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('mouseup', handleGlobalUp);
      window.removeEventListener('touchend', handleGlobalUp);
    };
  }, [isDragging, onMove]);

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.slider-handle')) return;
    onMove(e.clientX);
  }, [onMove]);

  if (loading) {
    return (
      <GlassCard className="aspect-square flex flex-col items-center justify-center p-6 relative overflow-hidden" variant="tonal">
        <div className="absolute inset-0 bg-surface-lowest/40 pointer-events-none" />
        <div className="scan-line absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-neon to-transparent" />
        <div className="flex flex-col items-center gap-3 z-10">
          <Sparkles className="text-neon animate-pulse" size={24} />
          <StatusTerminal messages={['INIT_XAI_MODULE', 'GENERATING_HEATMAP', 'GRADIENTS_PASS']} />
        </div>
      </GlassCard>
    );
  }

  if (!originalSrc) {
    return (
      <GlassCard className="aspect-square flex flex-col items-center justify-center p-6" variant="tonal">
        <div className="flex flex-col items-center gap-3 text-center">
          <ImageIcon className="text-on-surface-variant opacity-40" size={32} />
          <p className="text-on-surface-variant font-[family-name:var(--font-mono)] text-xs tracking-widest uppercase">
            NO_IMAGE_AVAILABLE
          </p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-6 flex flex-col h-full" variant="tonal">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 border-b border-surface-highest pb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className={heatmapSrc ? 'text-neon animate-pulse' : 'text-on-surface-variant'} />
          <span className="font-[family-name:var(--font-mono)] text-xs font-bold tracking-widest text-on-surface">
            XAI_VISUALIZER
          </span>
          {error && (
            <span className="font-[family-name:var(--font-mono)] text-[0.625rem] text-error bg-error/10 px-2 py-0.5">
              GRAD_CAM_ERROR
            </span>
          )}
        </div>
        
        {heatmapSrc && (
          <div className="flex border border-surface-highest">
            <button
              onClick={() => setViewMode('slider')}
              className={`px-3 py-1 font-[family-name:var(--font-mono)] text-[0.625rem] tracking-wider cursor-pointer border-none transition-colors ${
                viewMode === 'slider'
                  ? 'bg-neon text-on-primary font-bold'
                  : 'bg-surface-mid text-on-surface-variant hover:text-on-surface'
              }`}
            >
              SPLIT
            </button>
            <button
              onClick={() => setViewMode('toggle')}
              className={`px-3 py-1 font-[family-name:var(--font-mono)] text-[0.625rem] tracking-wider cursor-pointer border-none transition-colors ${
                viewMode === 'toggle'
                  ? 'bg-neon text-on-primary font-bold'
                  : 'bg-surface-mid text-on-surface-variant hover:text-on-surface'
              }`}
            >
              FADE
            </button>
          </div>
        )}
      </div>

      {/* Viewport container */}
      <div 
        ref={containerRef}
        onMouseDown={heatmapSrc && viewMode === 'slider' ? handleContainerClick : undefined}
        className="relative flex-1 aspect-square bg-surface-lowest overflow-hidden cursor-crosshair select-none"
      >
        {/* Original (Always in background) */}
        <img
          src={originalSrc}
          alt="Original specimen scan"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />

        {/* Heatmap Overlay */}
        {heatmapSrc && (
          <img
            src={heatmapSrc}
            alt="Grad-CAM activation overlay"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-300"
            style={
              viewMode === 'slider'
                ? {
                    clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)`,
                    opacity: 1
                  }
                : {
                    opacity: showHeatmap ? 1 : 0
                  }
            }
          />
        )}

        {/* Slider Controls */}
        {heatmapSrc && viewMode === 'slider' && (
          <>
            {/* Slider bar */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-neon pointer-events-none z-20"
              style={{ left: `${sliderPos}%` }}
            />
            {/* Drag Handle */}
            <div
              onMouseDown={startDrag}
              onTouchStart={startDrag}
              className="slider-handle absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-surface-high border border-neon hover:bg-surface-bright flex items-center justify-center cursor-ew-resize z-30 shadow-lg shadow-black/50 select-none touch-none"
              style={{ left: `${sliderPos}%` }}
            >
              <MoveHorizontal size={14} className="text-neon" />
            </div>
          </>
        )}

        {/* Heatmap Legend */}
        {heatmapSrc && (viewMode === 'slider' || showHeatmap) && (
          <div className="absolute bottom-2 right-2 p-1.5 bg-black/60 flex items-center justify-center gap-1 z-20">
            {['#3b82f6', '#22c55e', '#eab308', '#ef4444'].map((c, i) => (
              <div key={i} className="w-5 h-1.5" style={{ background: c }} />
            ))}
            <span className="text-[0.45rem] text-white/70 font-[family-name:var(--font-mono)] ml-1">
              LOW → HIGH ATTN
            </span>
          </div>
        )}
      </div>

      {/* Footer controls */}
      {heatmapSrc ? (
        viewMode === 'toggle' ? (
          <div className="flex justify-center mt-4">
            <div className="flex border border-surface-highest">
              <button
                onClick={() => setShowHeatmap(false)}
                className={`px-4 py-1.5 font-[family-name:var(--font-mono)] text-[0.6875rem] tracking-widest cursor-pointer border-none transition-colors ${
                  !showHeatmap
                    ? 'bg-surface-highest text-neon font-bold'
                    : 'bg-surface-mid text-on-surface-variant hover:text-on-surface'
                }`}
              >
                ORIGINAL
              </button>
              <button
                onClick={() => setShowHeatmap(true)}
                className={`px-4 py-1.5 font-[family-name:var(--font-mono)] text-[0.6875rem] tracking-widest cursor-pointer border-none transition-colors ${
                  showHeatmap
                    ? 'bg-surface-highest text-neon font-bold'
                    : 'bg-surface-mid text-on-surface-variant hover:text-on-surface'
                }`}
              >
                HEATMAP
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center mt-4 font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest text-on-surface-variant">
            ← DRAG SLIDER HORIZONTALLY TO REVEAL NEURAL FOCUS →
          </div>
        )
      ) : (
        originalSrc && (
          <div className="text-center mt-4 font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest text-on-surface-variant">
            SPECIMEN SCAN CAPTURE
          </div>
        )
      )}
    </GlassCard>
  );
}


export default function AnalysisDashboard() {
  const [params] = useSearchParams();
  const [scan, setScan]         = useState<ScanResult | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const idParam  = params.get('id');
        const lastId   = sessionStorage.getItem('lastScanId');
        const targetId = idParam || lastId;

        const res = targetId
          ? await api.getScan(targetId)
          : await api.getLatestScan();

        setScan(res.scan);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load scan data.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params]);

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <StatusTerminal messages={['LOADING_ANALYSIS...', 'FETCHING_RESULT']} />
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (error || !scan) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center gap-6 px-6">
        <StatusTerminal messages={['LOAD_FAILED', 'NO_DATA']} />
        <p className="text-error font-[family-name:var(--font-mono)] text-xs tracking-widest text-center">
          {error || 'No scan data available. Run a scan first.'}
        </p>
        <Link
          to="/scanner"
          className="bg-neon text-on-primary px-8 py-4 font-[family-name:var(--font-display)] font-bold text-sm tracking-wider no-underline hover:bg-neon-dim transition-colors"
        >
          GO_TO_SCANNER
        </Link>
      </div>
    );
  }

  const { freshness_index, grade, confidence, classification, species, biomarkers, recommendations } = scan;
  const displayId = scan.scan_display_id;
  const alerts    = recommendations.alert_flags;

  return (
    <div className="min-h-[calc(100vh-4rem)] px-6 md:px-16 lg:px-24 py-8 md:py-12">
      <div className="max-w-4xl mx-auto">
        {/* Back */}
        <Link
          to="/scanner"
          className="inline-flex items-center gap-2 text-on-surface-variant hover:text-neon no-underline transition-colors mb-6 font-[family-name:var(--font-mono)] text-[0.6875rem] tracking-widest"
        >
          <ArrowLeft size={14} />
          BACK_TO_SCANNER
        </Link>

        {/* Terminal header */}
        <StatusTerminal
          messages={[
            'ANALYSIS_COMPLETE',
            `SPECIMEN: ${species.common_name.toUpperCase().replace(' ', '_')}`,
            `SCAN_ID: ${displayId}`,
          ]}
          className="mb-6"
        />

        {/* Main Content Grid: Image visualizer on left, metrics on right */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Left: Image Overlay visualizer */}
          <FishImageOverlay photoUrl={scan.photo_url} scanId={scan.scan_id} />

          {/* Right: Score and Species cards stacked */}
          <div className="flex flex-col gap-6">
            {/* Main score card */}
            <GlassCard className="p-6 relative overflow-hidden" variant="tonal">
              <div className="absolute top-4 right-4">
                <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest text-neon-text bg-surface-highest px-2 py-1">
                  GRADE_{grade}
                </span>
              </div>

              <span className="font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest text-on-surface-variant uppercase block mb-2">
                Freshness_Index
              </span>

              <div className="flex items-baseline gap-2 mb-4">
                <span className="font-[family-name:var(--font-display)] text-7xl md:text-8xl font-bold text-neon leading-none">
                  {freshness_index}
                </span>
                <span className="font-[family-name:var(--font-display)] text-xl text-on-surface-variant font-bold">
                  /100
                </span>
              </div>

              <div className="h-2 bg-surface-highest w-full mb-4">
                <div
                  className="h-full bg-gradient-to-r from-neon-dim to-neon"
                  style={{ width: `${freshness_index}%` }}
                />
              </div>

              <div className="flex items-center gap-4">
                <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] text-secondary tracking-widest">
                  CLASSIFICATION: {classification}
                </span>
                <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] text-on-surface-variant tracking-widest">
                  CONFIDENCE: {confidence}%
                </span>
              </div>
            </GlassCard>

            {/* Species panel */}
            <GlassCard className="p-6" variant="glass">
              <span className="font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest text-on-surface-variant uppercase block mb-4">
                Detected_Specimen
              </span>

              <div className="flex flex-wrap gap-2 mb-4">
                {species.tags.map(tag => (
                  <span
                    key={tag}
                    className="bg-surface-highest/40 text-on-surface-variant font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest px-3 py-1.5"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant font-[family-name:var(--font-mono)] text-[0.625rem]">WEIGHT_EST</span>
                  <span className={`font-[family-name:var(--font-display)] font-semibold ${gradeColor(grade)}`}>
                    ~{species.weight_estimate_kg} kg
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant font-[family-name:var(--font-mono)] text-[0.625rem]">CATCH_AGE</span>
                  <span className={`font-[family-name:var(--font-display)] font-semibold ${gradeColor(grade)}`}>
                    ~{species.catch_age_hours} hrs
                  </span>
                </div>
                {scan.market_name && (
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant font-[family-name:var(--font-mono)] text-[0.625rem]">MARKET</span>
                    <span className={`font-[family-name:var(--font-display)] font-semibold ${gradeColor(grade)}`}>
                      {scan.market_name}
                    </span>
                  </div>
                )}
              </div>
            </GlassCard>
          </div>
        </div>

        {/* Biomarkers — 3 model-native streams */}
        <div className="mb-8">
          <span className="status-terminal block mb-4">BIOMARKER_ANALYSIS</span>

          <div className="space-y-3">
            {(Object.keys(BIOMARKER_META) as BiomarkerKey[]).map(key => {
              const meta = BIOMARKER_META[key];
              const bm   = biomarkers[key];
              const Icon = meta.icon;
              const isAlert = bm.status === 'CAUTION';

              return (
                <GlassCard
                  key={key}
                  className={`p-5 ${isAlert ? 'freshness-bar-spoiled' : 'freshness-bar-fresh'}`}
                  variant="tonal"
                  hover
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-surface-highest flex items-center justify-center shrink-0">
                      <Icon size={18} className={isAlert ? 'text-error' : 'text-secondary'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-[family-name:var(--font-display)] text-sm font-bold">
                          {meta.label}
                        </h4>
                        <div className="flex items-center gap-3">
                          <span className={`font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest ${isAlert ? 'text-error' : 'text-neon-text'}`}>
                            {isAlert && <AlertTriangle size={10} className="inline mr-1" />}
                            {bm.status}
                          </span>
                          <span className="font-[family-name:var(--font-display)] text-lg font-bold text-neon">
                            {bm.score}
                          </span>
                        </div>
                      </div>
                      <p className="text-on-surface-variant text-xs leading-relaxed">
                        {bm.detail}
                      </p>
                      <div className="h-1 bg-surface-highest mt-3">
                        <div
                          className={`h-full ${isAlert ? 'bg-error' : 'bg-secondary'}`}
                          style={{ width: `${bm.score}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </div>

        {/* Recommendations */}
        <div className="mb-8">
          <span className="status-terminal block mb-4">STORAGE_RECOMMENDATIONS</span>
          <div className={`grid gap-3 ${alerts.length > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <GlassCard className="p-4 text-center" variant="tonal">
              <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest text-on-surface-variant block mb-2">
                CONSUME_WITHIN
              </span>
              <span className="font-[family-name:var(--font-display)] text-lg font-bold text-neon">
                {recommendations.consume_within_hours > 0
                  ? `${recommendations.consume_within_hours} HRS`
                  : 'DISCARD'}
              </span>
            </GlassCard>

            <GlassCard className="p-4 text-center" variant="tonal">
              <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest text-on-surface-variant block mb-2">
                STORAGE_TEMP
              </span>
              <span className="font-[family-name:var(--font-display)] text-lg font-bold text-neon">
                {recommendations.storage_temp}
              </span>
            </GlassCard>

            {alerts.length > 0 && (
              <GlassCard className="p-4 text-center" variant="void">
                <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest text-on-surface-variant block mb-2">
                  ALERT
                </span>
                <span className="font-[family-name:var(--font-display)] text-sm font-bold text-error">
                  {alerts[0]}
                </span>
              </GlassCard>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/scanner"
            className="flex-1 bg-neon text-on-primary py-4 font-[family-name:var(--font-display)] font-bold text-sm tracking-wider no-underline text-center transition-all duration-200 hover:bg-neon-dim"
          >
            NEW_SCAN
          </Link>
          <Link
            to="/results"
            className="flex-1 bg-surface-mid text-on-surface py-4 font-[family-name:var(--font-display)] font-bold text-sm tracking-wider no-underline text-center transition-all duration-200 hover:bg-surface-high ghost-border"
          >
            VIEW_HISTORY
          </Link>
        </div>
      </div>
    </div>
  );
}
