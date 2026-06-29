import { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ScanLine, Layers, MapPin, Brain, Upload, X, Loader2, AlertTriangle } from 'lucide-react';
import StatusTerminal from '../components/StatusTerminal';
import GlassCard from '../components/GlassCard';
import { api } from '../lib/api';
import type { GradcamResponse } from '../lib/api';
import { useTranslation } from 'react-i18next';

// ── Mode Cards data ────────────────────────────────────────────────────────────

const modes = [
  {
    icon: ScanLine,
    titleKey: 'modeSelect.individual.title',
    codeKey: 'modeSelect.individual.code',
    descKey: 'modeSelect.individual.desc',
    statKey: 'modeSelect.individual.stat',
    to: '/scanner',
  },
  {
    icon: Layers,
    titleKey: 'modeSelect.batch.title',
    codeKey: 'modeSelect.batch.code',
    descKey: 'modeSelect.batch.desc',
    statKey: 'modeSelect.batch.stat',
    to: '/scanner',
  },
  {
    icon: MapPin,
    titleKey: 'modeSelect.survey.title',
    codeKey: 'modeSelect.survey.code',
    descKey: 'modeSelect.survey.desc',
    statKey: 'modeSelect.survey.stat',
    to: '/map',
  },
];

// ── Grad-CAM class colours ────────────────────────────────────────────────────

const CLASS_META: Record<number, { labelKey: string; colour: string; bg: string }> = {
  0: { labelKey: 'modeSelect.classificationFresh', colour: '#39ff14', bg: 'rgba(57,255,20,0.12)' },
  1: { labelKey: 'modeSelect.classificationModerate', colour: '#f5a623', bg: 'rgba(245,166,35,0.12)' },
  2: { labelKey: 'modeSelect.classificationSpoiled', colour: '#ff4040', bg: 'rgba(255,64,64,0.12)' },
};

// ── Grad-CAM Viewer component ─────────────────────────────────────────────────

function GradCamViewer() {
  const { t } = useTranslation();
  const [originalSrc, setOriginalSrc] = useState<string | null>(null);
  const [result, setResult] = useState<GradcamResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [notAFish, setNotAFish] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Process a File object — show preview & call API
  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorKey('gradcam.invalidFileError');
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => setOriginalSrc(e.target?.result as string);
    reader.readAsDataURL(file);

    setLoading(true);
    setErrorKey(null);
    setResult(null);
    setNotAFish(false);

    try {
      const blob = new Blob([await file.arrayBuffer()], { type: file.type });
      const res = await api.getGradcam(blob);
      setResult(res);
    } catch (err: unknown) {
      // Centralized and robust error handling.
      // We determine the correct translation key first, then translate and set the error.
      let errorKey = 'error.unknown';
      let shouldSetError = true;

      if (err instanceof Error) {
        const msg = err.message;

        if (msg.startsWith('error.')) {
          // Ideal path: The API layer provided a specific translation key.
          errorKey = msg;
        } else if (msg.toLowerCase().includes('failed to fetch')) {
          // Fallback for raw network errors that weren't caught by the API layer.
          errorKey = 'error.network.connection';
        } else if (msg.startsWith('NOT_A_FISH')) {
          setNotAFish(true);
          shouldSetError = false; // Don't show a generic error for this specific case.
        }
      } else {
        // This handles non-Error exceptions.
        errorKey = 'gradcam.generationFailedError';
        console.error('Grad-CAM processing non-error thrown:', err);
      }

      if (shouldSetError) {
        setErrorKey(errorKey);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Drag-and-drop handlers
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const reset = () => {
    setOriginalSrc(null);
    setResult(null);
    setErrorKey(null);
    setNotAFish(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const classMeta = result ? (CLASS_META[result.class_index] ?? CLASS_META[0]) : null;

  return (
    <GlassCard className="p-6 md:p-8" variant="tonal">
      {/* Header row */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 bg-surface-highest flex items-center justify-center shrink-0">
          <Brain size={24} className="text-neon" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-lg font-bold font-[family-name:var(--font-display)]">
              {t('modeSelect.gradcamViewerTitle')}
            </h3>
            <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest text-neon-text bg-surface-highest px-2 py-0.5">
              {t('modeSelect.xaiModule')}
            </span>
          </div>
          <p className="text-on-surface-variant text-sm leading-relaxed">
            {t('modeSelect.gradcamDescription')}
          </p>
        </div>
      </div>

      {/* Drop zone (shown when no image selected) */}
      {!originalSrc && (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative flex flex-col items-center justify-center gap-3 py-10 px-6
            border-2 border-dashed cursor-pointer transition-all duration-200
            ${dragging
              ? 'border-neon bg-neon/5 scale-[1.01]'
              : 'border-surface-highest hover:border-neon/50 hover:bg-surface-high'
            }
          `}
        >
          <Upload size={32} className={`transition-colors duration-200 ${dragging ? 'text-neon' : 'text-on-surface-variant'}`} />
          <p className="text-sm text-on-surface-variant text-center">
            <span className="text-neon font-semibold">{t('modeSelect.clickToUpload')}</span> {t('modeSelect.orDragDrop')}
          </p>
          <p className="text-xs text-on-surface-variant/60 font-[family-name:var(--font-mono)]">
            {t('modeSelect.acceptedFormats')}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFileChange}
            id="gradcam-file-input"
          />
        </div>
      )}

      {/* Loading spinner */}
      {loading && (
        <div className="flex flex-col items-center justify-center gap-3 py-10">
          <Loader2 size={32} className="text-neon animate-spin" />
          <StatusTerminal messages={[t('gradcam.runningForwardPass'), t('gradcam.computingGradients'), t('gradcam.renderingHeatmap')]} />
        </div>
      )}

      {/* Not-a-fish state */}
      {notAFish && !loading && (
        <div className="space-y-4">
          {/* Preview of rejected image */}
          {originalSrc && (
            <div className="overflow-hidden" style={{ maxHeight: '180px' }}>
              <img
                src={originalSrc!}
                alt={t('gradcam.rejectedUploadAlt', 'Rejected upload')}
                className="w-full object-cover opacity-40 grayscale"
                style={{ maxHeight: '180px' }}
              />
            </div>
          )}
          {/* Rejection banner */}
          <div className="flex items-start gap-3 p-4 border border-amber-500/40 bg-amber-500/10">
            <span className="text-2xl leading-none select-none" aria-hidden></span>
            <div className="flex-1 min-w-0">
              <p className="text-amber-400 font-bold text-sm font-[family-name:var(--font-display)] mb-1">
                {t('gradcam.notAFishDetected')}
              </p>
              <p className="text-on-surface-variant text-sm">
                {t('gradcam.notAFishText')}
              </p>
            </div>
            <button
              onClick={reset}
              className="text-on-surface-variant hover:text-neon transition-colors mt-0.5"
              title={t('common.tryAgain', 'Try Again')}
            >
              <X size={16} />
            </button>
          </div>
          {/* Retry prompt */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-neon/70 hover:text-neon transition-colors font-[family-name:var(--font-mono)] tracking-wide flex items-center gap-1.5"
          >
            <Upload size={11} /> {t('gradcam.uploadDifferentImage')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFileChange}
          />
        </div>
      )}

      {/* Generic error state */}
      {errorKey && !loading && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 mt-2">
          <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-red-400 text-sm font-[family-name:var(--font-mono)]">{t(errorKey)}</p>
          </div>
          <button
            onClick={reset}
            className="text-on-surface-variant hover:text-neon transition-colors"
            title={t('common.reset', 'Reset')}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Result panel */}
      {result && !loading && (
        <div className="space-y-4">
          {/* Class badge + meta */}
          <div
            className="flex flex-wrap items-center justify-between gap-3 p-3 border"
            style={{ borderColor: classMeta!.colour + '40', background: classMeta!.bg }}
          >
            <div className="flex items-center gap-3">
              <span
                className="font-[family-name:var(--font-mono)] text-xs font-bold px-2 py-0.5"
                style={{ color: classMeta!.colour, background: classMeta!.colour + '20' }}
              >
                {t(classMeta!.labelKey)}
              </span>
              <span className="text-sm text-on-surface-variant font-[family-name:var(--font-mono)]">
                {result.predicted_class}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {result.mode === 'demo' && (
                <span className="text-[0.5625rem] font-[family-name:var(--font-mono)] tracking-widest text-on-surface-variant bg-surface-highest px-2 py-0.5">
                  {t('modeSelect.demoMode')}
                </span>
              )}
              <button
                onClick={reset}
                className="text-on-surface-variant hover:text-neon transition-colors p-1"
                title={t('common.reset', 'Reset')}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Side-by-side images */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Original */}
            <div className="space-y-1.5">
                <p className="text-[0.6rem] tracking-[0.15em] text-on-surface-variant font-[family-name:var(--font-mono)]">
                  {t('gradcam.originalInput')}
                </p>
              <div className="bg-surface-highest overflow-hidden aspect-square">
                <img
                  src={originalSrc!}
                  alt={t('gradcam.originalImageAlt', 'Original uploaded image')}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Grad-CAM overlay */}
            <div className="space-y-1.5">
              <p className="text-[0.6rem] tracking-[0.15em] text-neon font-[family-name:var(--font-mono)]">
                {t('gradcam.activationMap')} {result.mode === 'real' ? `· ${t('gradcam.streamA')}` : `· ${t('gradcam.synthetic')}`}
              </p>
              <div className="bg-surface-highest overflow-hidden aspect-square relative">
                <img
                  src={result.gradcam_image}
                  alt={t('gradcam.heatmapAlt', 'Grad-CAM heatmap overlay')}
                  className="w-full h-full object-cover"
                />
                {/* Legend overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-black/60 flex items-center justify-center gap-1">
                  {['#3b82f6', '#22c55e', '#eab308', '#ef4444'].map((c, i) => (
                    <div key={i} className="w-6 h-2" style={{ background: c }} />
                  ))}
                  <span className="text-[0.5rem] text-white/60 font-[family-name:var(--font-mono)] ml-1">
                    {t('gradcam.lowToHigh')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Try another */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-neon/70 hover:text-neon transition-colors font-[family-name:var(--font-mono)] tracking-wide flex items-center gap-1.5"
          >
            <Upload size={11} /> {t('gradcam.uploadNewImage')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFileChange}
          />
        </div>
      )}
    </GlassCard>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ModeSelectPage() {
  const { t } = useTranslation();

      return (
    <div className="min-h-[calc(100vh-4rem)] px-6 md:px-16 lg:px-24 py-12 md:py-20">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <StatusTerminal
          messages={[t('modeSelect.operationMode'), t('modeSelect.selectProtocol'), t('modeSelect.awaitingInput')]}
          className="mb-6"
        />
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 font-[family-name:var(--font-display)]">
          {t('modeSelect.selectOperation')}
          <br />
          <span className="text-neon">{t('modeSelect.mode')}</span>
        </h1>
        <p className="text-on-surface-variant mb-12 max-w-lg text-sm">
          {t('modeSelect.description')}
        </p>

        {/* Mode Cards */}
        <div className="space-y-4 mb-12">
          {modes.map((mode, i) => (
            <Link key={i} to={mode.to} className="block no-underline group">
              <GlassCard
                className="p-6 md:p-8 transition-all duration-200 group-hover:bg-surface-high"
                variant="tonal"
              >
                <div className="flex items-start gap-6">
                  {/* Icon */}
                  <div className="w-14 h-14 bg-surface-highest flex items-center justify-center shrink-0 group-hover:bg-neon/10 transition-colors duration-200">
                    <mode.icon size={24} className="text-neon" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold font-[family-name:var(--font-display)]">
                        {t(mode.titleKey)}
                      </h3>
                      <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest text-neon-text bg-surface-highest px-2 py-0.5">
                        {t(mode.codeKey)}
                      </span>
                    </div>
                    <p className="text-on-surface-variant text-sm leading-relaxed mb-3">
                      {t(mode.descKey)}
                    </p>
                    <StatusTerminal messages={[t(mode.statKey)]} />
                  </div>

                  {/* Arrow */}
                  <div className="hidden md:flex items-center justify-center w-10 h-10 text-on-surface-variant group-hover:text-neon transition-colors duration-200">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>

        {/* ── Grad-CAM Viewer ───────────────────────────────────────────────── */}
        <div className="mb-6">
          <StatusTerminal
            messages={[t('modeSelect.xaiModule'), t('modeSelect.gradcamTitle'), t('gradcam.streamA')]}
            className="mb-4"
          />
          <h2 className="text-xl font-bold tracking-tight mb-2 font-[family-name:var(--font-display)]">
            {t('modeSelect.explainability', 'Explainability')} <span className="text-neon">{t('modeSelect.toolkit', 'Toolkit')}</span>
          </h2>
          <p className="text-on-surface-variant text-sm mb-6 max-w-lg">
            {t('modeSelect.gradcamSectionDescription',
              'Understand what the model sees. Upload any fish photo to generate a Gradient-weighted Class Activation Map (Grad-CAM) heatmap.')}
          </p>
          <GradCamViewer />
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center">
          <StatusTerminal
            messages={[t('scanner.systemReady'), t('modeSelect.allModulesLoaded'), t('modeSelect.gpuAccelOn')]}
            className="justify-center"
          />
        </div>
      </div>
    </div>
  );
}
