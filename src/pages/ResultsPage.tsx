import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import StatusTerminal from '../components/StatusTerminal';
import { api } from '../lib/api';
import type { HistoryScan, HistoryStats } from '../lib/types';
import { useComparison } from '../context/ComparisonContext';

export default function ResultsPage() {
  const navigate = useNavigate();
  const { selectedScanIds, toggleScanSelection, isComparisonReady } = useComparison();
  
  const [scans, setScans] = useState<HistoryScan[]>([]);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await api.getScanHistory(20, 0);
        setScans(res.scans);
        setStats(res.stats);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load history.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <StatusTerminal messages={['LOADING_HISTORY...', 'QUERYING_DB']} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center gap-4 px-6">
        <StatusTerminal messages={['HISTORY_LOAD_FAILED']} />
        <p className="text-error font-[family-name:var(--font-mono)] text-xs tracking-widest">
          {error}
        </p>
        <Link
          to="/auth"
          className="text-neon font-[family-name:var(--font-mono)] text-xs tracking-widest no-underline hover:underline"
        >
          SIGN_IN_REQUIRED
        </Link>
      </div>
    );
  }

  const totalScans = stats?.total_scans ?? scans.length;
  const avgScore = stats?.avg_freshness_index ?? 0;
  const freshRate = stats?.fresh_rate_percent ?? 0;

  return (
    <div className="min-h-[calc(100vh-4rem)] px-6 md:px-16 lg:px-24 py-8 md:py-12 pb-28">
      <div className="max-w-4xl mx-auto">
        <StatusTerminal
          messages={[
            'SCAN_HISTORY',
            `TOTAL: ${totalScans}`,
            `AVG_SCORE: ${avgScore}`,
          ]}
          className="mb-6"
        />
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-8 font-[family-name:var(--font-display)]">
          Scan <span className="text-neon">Results</span>
        </h1>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mb-10">
          <GlassCard className="p-4 text-center" variant="tonal">
            <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest text-on-surface-variant block mb-1">
              TOTAL_SCANS
            </span>
            <span className="font-[family-name:var(--font-display)] text-2xl font-bold text-neon">
              {totalScans}
            </span>
          </GlassCard>
          <GlassCard className="p-4 text-center" variant="tonal">
            <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest text-on-surface-variant block mb-1">
              AVG_FRESHNESS
            </span>
            <span className="font-[family-name:var(--font-display)] text-2xl font-bold text-neon">
              {avgScore}
            </span>
          </GlassCard>
          <GlassCard className="p-4 text-center" variant="tonal">
            <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest text-on-surface-variant block mb-1">
              FRESH_RATE
            </span>
            <span className="font-[family-name:var(--font-display)] text-2xl font-bold text-secondary">
              {freshRate}%
            </span>
          </GlassCard>
        </div>

        {/* History list */}
        {scans.length === 0 ? (
          <div className="text-center py-16">
            <StatusTerminal messages={['NO_SCANS_FOUND', 'RUN_FIRST_SCAN']} className="justify-center mb-4" />
            <Link
              to="/scanner"
              className="bg-neon text-on-primary px-8 py-4 font-[family-name:var(--font-display)] font-bold text-sm tracking-wider no-underline hover:bg-neon-dim transition-colors inline-block"
            >
              INITIATE_FIRST_SCAN
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {scans.map(h => {
              const isChecked = selectedScanIds.includes(h.id);
              
              return (
                <div key={h.id} className="flex items-center gap-4">
                  {/* REQUIREMENT 1 & 2: Checkbox toggle placed side-by-side with scan card */}
                  <div className="flex items-center justify-center shrink-0 p-1">
                    <input
                      type="checkbox"
                      id={`compare-${h.id}`}
                      checked={isChecked}
                      onChange={() => toggleScanSelection(h.id)}
                      className="w-5 h-5 accent-neon cursor-pointer bg-surface-mid border-on-surface-variant/30 rounded focus:ring-0"
                    />
                  </div>

                  <Link
                    to={`/analysis?id=${h.id}`}
                    className="block no-underline group flex-1 min-w-0"
                  >
                    <GlassCard
                      className={`p-5 transition-all duration-200 group-hover:bg-surface-high ${
                        isChecked 
                          ? 'border-neon ring-1 ring-neon/30' 
                          : h.is_fresh ? 'freshness-bar-fresh' : 'freshness-bar-spoiled'
                      }`}
                      variant="tonal"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          {/* Thumbnail */}
                          {h.photo_url && (
                            <img
                              src={h.photo_url}
                              alt={h.species_detected}
                              className="w-12 h-12 object-cover shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
                            />
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="font-[family-name:var(--font-display)] text-base font-bold">
                                {h.species_detected}
                              </h3>
                              <span className="font-[family-name:var(--font-mono)] text-[0.5rem] tracking-widest text-neon-text bg-surface-highest px-2 py-0.5">
                                {h.grade}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                              <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest text-on-surface-variant">
                                {h.scan_display_id}
                              </span>
                              <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest text-on-surface-variant">
                                {h.market_name}
                              </span>
                              {h.timestamp && (
                                <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest text-on-surface-variant">
                                  {new Date(h.timestamp).toLocaleString('en-IN', {
                                    day: '2-digit', month: 'short', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit',
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <span className={`font-[family-name:var(--font-display)] text-2xl font-bold ${h.is_fresh ? 'text-secondary' : 'text-error'}`}>
                            {h.freshness_index}
                          </span>
                          <ArrowRight size={16} className="text-on-surface-variant group-hover:text-neon transition-colors" />
                        </div>
                      </div>
                    </GlassCard>
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {/* REQUIREMENT 3 & 4: Floating action bar to maintain selection state & conditionally enable action */}
        {selectedScanIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 bg-surface-mid border border-on-surface-variant/20 shadow-2xl rounded-xl p-4 flex items-center justify-between gap-6 max-w-md w-11/12 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <span className="font-[family-name:var(--font-mono)] text-xs tracking-widest text-on-surface">
              SELECTED: <span className="text-neon font-bold">{selectedScanIds.length}</span>/4_SCANS
            </span>
            
            <button
              disabled={!isComparisonReady}
              onClick={() => navigate(`/analysis?compare=${selectedScanIds.join(',')}`)}
              className={`px-5 py-3 font-[family-name:var(--font-display)] font-bold text-xs tracking-wider transition-all duration-150 ${
                isComparisonReady
                  ? 'bg-neon text-on-primary hover:bg-neon-dim shadow-md active:scale-[0.98] cursor-pointer'
                  : 'bg-surface-highest text-on-surface-variant/40 cursor-not-allowed border border-on-surface-variant/10'
              }`}
            >
              COMPARE_SELECTED
            </button>
          </div>
        )}
      </div>
    </div>
  );
}