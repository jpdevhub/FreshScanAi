import { Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Thermometer, Droplets, Eye as EyeIcon, Fish } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import StatusTerminal from '../components/StatusTerminal';

const biomarkers = [
  {
    label: 'Gill Saturation',
    icon: Droplets,
    score: 91,
    status: 'NOMINAL',
    detail: 'Hemoglobin oxidation within healthy range. Bright red coloration detected.',
  },
  {
    label: 'Corneal Clarity',
    icon: EyeIcon,
    score: 84,
    status: 'NOMINAL',
    detail: 'Slight cloudiness at periphery. Core pupil reflex intact.',
  },
  {
    label: 'Epidermal Tension',
    icon: Fish,
    score: 88,
    status: 'NOMINAL',
    detail: 'Scale adhesion strong. Mucus layer viscosity within normal parameters.',
  },
  {
    label: 'Internal Temp',
    icon: Thermometer,
    score: 72,
    status: 'CAUTION',
    detail: 'Surface temperature 8.2°C. Recommend immediate cold storage.',
  },
];

const recommendations = [
  { label: 'Consume Within', value: '18 HRS', urgent: false },
  { label: 'Storage Temp', value: '0-4°C', urgent: false },
  { label: 'Alert', value: 'TEMP_ELEVATED', urgent: true },
];

export default function AnalysisDashboard() {
  const overallScore = 87;
  const grade = 'A';

  return (
    <div className="min-h-[calc(100vh-4rem)] px-6 md:px-16 lg:px-24 py-8 md:py-12">
      <div className="max-w-4xl mx-auto">
        {/* Back Link */}
        <Link
          to="/scanner"
          className="inline-flex items-center gap-2 text-on-surface-variant hover:text-neon no-underline transition-colors mb-6 font-[family-name:var(--font-mono)] text-[0.6875rem] tracking-widest"
        >
          <ArrowLeft size={14} />
          BACK_TO_SCANNER
        </Link>

        {/* Header */}
        <StatusTerminal
          messages={['ANALYSIS_COMPLETE', 'SPECIMEN: ROHU_CARP', 'SCAN_ID: FS-2026-0404-0871']}
          className="mb-6"
        />

        {/* Score Section */}
        <div className="flex flex-col md:flex-row gap-6 mb-8">
          {/* Main Score */}
          <GlassCard className="flex-1 p-8 relative overflow-hidden" variant="tonal">
            <div className="absolute top-4 right-4">
              <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest text-neon-text bg-surface-highest px-2 py-1">
                GRADE_{grade}
              </span>
            </div>

            <span className="font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest text-on-surface-variant uppercase block mb-2">
              Freshness_Index
            </span>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="font-[family-name:var(--font-display)] text-8xl md:text-9xl font-bold text-neon leading-none">
                {overallScore}
              </span>
              <span className="font-[family-name:var(--font-display)] text-2xl text-on-surface-variant font-bold">
                /100
              </span>
            </div>

            {/* Score Bar */}
            <div className="h-2 bg-surface-highest w-full mb-4">
              <div
                className="h-full bg-gradient-to-r from-neon-dim to-neon"
                style={{ width: `${overallScore}%` }}
              />
            </div>

            <div className="flex items-center gap-4">
              <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] text-secondary tracking-widest">
                CLASSIFICATION: FRESH
              </span>
              <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] text-on-surface-variant tracking-widest">
                CONFIDENCE: 97.3%
              </span>
            </div>
          </GlassCard>

          {/* Species Info */}
          <GlassCard className="md:w-72 p-6" variant="glass">
            <span className="font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest text-on-surface-variant uppercase block mb-4">
              Detected_Specimen
            </span>

            {/* Species floating pills */}
            <div className="flex flex-wrap gap-2 mb-4">
              {['ROHU CARP', 'LABEO ROHITA', 'FRESHWATER'].map((tag) => (
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
                <span className="text-tertiary font-[family-name:var(--font-display)] font-semibold">~1.2 kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant font-[family-name:var(--font-mono)] text-[0.625rem]">CATCH_AGE</span>
                <span className="text-tertiary font-[family-name:var(--font-display)] font-semibold">~6 hrs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant font-[family-name:var(--font-mono)] text-[0.625rem]">MARKET</span>
                <span className="text-tertiary font-[family-name:var(--font-display)] font-semibold">Howrah</span>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Biomarker Breakdown */}
        <div className="mb-8">
          <span className="status-terminal block mb-4">BIOMARKER_ANALYSIS</span>

          <div className="space-y-3">
            {biomarkers.map((bm, i) => (
              <GlassCard
                key={i}
                className={`p-5 ${bm.status === 'CAUTION' ? 'freshness-bar-spoiled' : 'freshness-bar-fresh'}`}
                variant="tonal"
                hover
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-surface-highest flex items-center justify-center shrink-0">
                    <bm.icon size={18} className={bm.status === 'CAUTION' ? 'text-error' : 'text-secondary'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-[family-name:var(--font-display)] text-sm font-bold">
                        {bm.label}
                      </h4>
                      <div className="flex items-center gap-3">
                        <span className={`font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest ${
                          bm.status === 'CAUTION' ? 'text-error' : 'text-neon-text'
                        }`}>
                          {bm.status === 'CAUTION' && <AlertTriangle size={10} className="inline mr-1" />}
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
                    {/* Score bar */}
                    <div className="h-1 bg-surface-highest mt-3">
                      <div
                        className={`h-full ${bm.status === 'CAUTION' ? 'bg-error' : 'bg-secondary'}`}
                        style={{ width: `${bm.score}%` }}
                      />
                    </div>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        <div className="mb-8">
          <span className="status-terminal block mb-4">STORAGE_RECOMMENDATIONS</span>
          <div className="grid grid-cols-3 gap-3">
            {recommendations.map((rec, i) => (
              <GlassCard key={i} className="p-4 text-center" variant={rec.urgent ? 'void' : 'tonal'}>
                <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest text-on-surface-variant block mb-2">
                  {rec.label.toUpperCase().replace(' ', '_')}
                </span>
                <span className={`font-[family-name:var(--font-display)] text-lg font-bold ${
                  rec.urgent ? 'text-error' : 'text-neon'
                }`}>
                  {rec.value}
                </span>
              </GlassCard>
            ))}
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
