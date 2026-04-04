import { Link } from 'react-router-dom';
import { ScanLine, Layers, MapPin } from 'lucide-react';
import StatusTerminal from '../components/StatusTerminal';
import GlassCard from '../components/GlassCard';

const modes = [
  {
    icon: ScanLine,
    title: 'Individual Scan',
    code: 'MODE_SINGLE',
    desc: 'Point-and-analyze a single specimen. Optimal for retail consumers verifying individual purchase quality.',
    stat: 'AVG_TIME: 2.3s',
    to: '/scanner',
  },
  {
    icon: Layers,
    title: 'Batch Assessment',
    code: 'MODE_BATCH',
    desc: 'Multi-specimen sweep across a display. Designed for wholesale buyers processing 20+ units per session.',
    stat: 'THROUGHPUT: 12/min',
    to: '/scanner',
  },
  {
    icon: MapPin,
    title: 'Market Survey',
    code: 'MODE_SURVEY',
    desc: 'Contribute to the crowdsourced Trust Map. Survey an entire market stall and submit anonymized freshness data.',
    stat: 'DATA_POINTS: 47.2K',
    to: '/map',
  },
];

export default function ModeSelectPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] px-6 md:px-16 lg:px-24 py-12 md:py-20">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <StatusTerminal
          messages={['OPERATION_MODE', 'SELECT_PROTOCOL', 'AWAITING_INPUT']}
          className="mb-6"
        />
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 font-[family-name:var(--font-display)]">
          Select Operation
          <br />
          <span className="text-neon">Mode</span>
        </h1>
        <p className="text-on-surface-variant mb-12 max-w-lg text-sm">
          Choose your scanning protocol. Each mode is optimized for different 
          operational contexts and specimen volumes.
        </p>

        {/* Mode Cards */}
        <div className="space-y-4">
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
                        {mode.title}
                      </h3>
                      <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest text-neon-text bg-surface-highest px-2 py-0.5">
                        {mode.code}
                      </span>
                    </div>
                    <p className="text-on-surface-variant text-sm leading-relaxed mb-3">
                      {mode.desc}
                    </p>
                    <StatusTerminal messages={[mode.stat]} />
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

        {/* Footer Info */}
        <div className="mt-12 text-center">
          <StatusTerminal
            messages={['READY', 'ALL_MODULES_LOADED', 'GPU_ACCEL: ON']}
            className="justify-center"
          />
        </div>
      </div>
    </div>
  );
}
