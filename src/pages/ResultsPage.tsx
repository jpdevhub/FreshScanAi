import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import StatusTerminal from '../components/StatusTerminal';

const history = [
  { id: 'FS-0871', species: 'Rohu Carp', score: 87, grade: 'A', time: '14:22', date: '04 Apr 2026', market: 'Howrah', fresh: true },
  { id: 'FS-0870', species: 'Hilsa', score: 94, grade: 'A+', time: '13:45', date: '04 Apr 2026', market: 'Gariahat', fresh: true },
  { id: 'FS-0869', species: 'Katla', score: 61, grade: 'C', time: '11:30', date: '04 Apr 2026', market: 'New Market', fresh: false },
  { id: 'FS-0868', species: 'Pomfret', score: 78, grade: 'B', time: '09:15', date: '03 Apr 2026', market: 'Lake Market', fresh: true },
  { id: 'FS-0867', species: 'Tilapia', score: 42, grade: 'D', time: '16:50', date: '03 Apr 2026', market: 'Maniktala', fresh: false },
  { id: 'FS-0866', species: 'Bhetki', score: 91, grade: 'A+', time: '08:20', date: '03 Apr 2026', market: 'Howrah', fresh: true },
];

export default function ResultsPage() {
  const totalScans = history.length;
  const avgScore = Math.round(history.reduce((a, h) => a + h.score, 0) / totalScans);
  const freshCount = history.filter((h) => h.fresh).length;

  return (
    <div className="min-h-[calc(100vh-4rem)] px-6 md:px-16 lg:px-24 py-8 md:py-12">
      <div className="max-w-4xl mx-auto">
        <StatusTerminal messages={['SCAN_HISTORY', `TOTAL: ${totalScans}`, `AVG_SCORE: ${avgScore}`]} className="mb-6" />
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-8 font-[family-name:var(--font-display)]">
          Scan <span className="text-neon">Results</span>
        </h1>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3 mb-10">
          <GlassCard className="p-4 text-center" variant="tonal">
            <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest text-on-surface-variant block mb-1">TOTAL_SCANS</span>
            <span className="font-[family-name:var(--font-display)] text-2xl font-bold text-neon">{totalScans}</span>
          </GlassCard>
          <GlassCard className="p-4 text-center" variant="tonal">
            <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest text-on-surface-variant block mb-1">AVG_FRESHNESS</span>
            <span className="font-[family-name:var(--font-display)] text-2xl font-bold text-neon">{avgScore}</span>
          </GlassCard>
          <GlassCard className="p-4 text-center" variant="tonal">
            <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest text-on-surface-variant block mb-1">FRESH_RATE</span>
            <span className="font-[family-name:var(--font-display)] text-2xl font-bold text-secondary">{Math.round((freshCount / totalScans) * 100)}%</span>
          </GlassCard>
        </div>

        {/* History List */}
        <div className="space-y-4">
          {history.map((h) => (
            <Link key={h.id} to="/analysis" className="block no-underline group">
              <GlassCard
                className={`p-5 transition-all duration-200 group-hover:bg-surface-high ${h.fresh ? 'freshness-bar-fresh' : 'freshness-bar-spoiled'}`}
                variant="tonal"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-[family-name:var(--font-display)] text-base font-bold">{h.species}</h3>
                      <span className="font-[family-name:var(--font-mono)] text-[0.5rem] tracking-widest text-neon-text bg-surface-highest px-2 py-0.5">{h.grade}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest text-on-surface-variant">{h.id}</span>
                      <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest text-on-surface-variant">{h.market}</span>
                      <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest text-on-surface-variant">{h.date} {h.time}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`font-[family-name:var(--font-display)] text-2xl font-bold ${h.fresh ? 'text-secondary' : 'text-error'}`}>{h.score}</span>
                    <ArrowRight size={16} className="text-on-surface-variant group-hover:text-neon transition-colors" />
                  </div>
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
