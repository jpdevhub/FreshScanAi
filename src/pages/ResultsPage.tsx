import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, BarChart3, CheckSquare, Square, X } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import StatusTerminal from '../components/StatusTerminal';
import { api } from '../lib/api';
import type { HistoryScan, HistoryStats } from '../lib/types';

export default function ResultsPage() {
  const { t } = useTranslation();
  const [scans, setScans] = useState<HistoryScan[]>([]);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState('');

  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<{ scan1: any; scan2: any } | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      }
      if (prev.length >= 2) {
        return [prev[1], id];
      }
      return [...prev, id];
    });
  };

  const handleCompare = async () => {
    if (selectedIds.length !== 2) return;
    setComparisonLoading(true);
    try {
      const [res1, res2] = await Promise.all([
        api.getScan(selectedIds[0]),
        api.getScan(selectedIds[1])
      ]);
      setComparisonData({ scan1: res1.scan, scan2: res2.scan });
    } catch (err) {
      console.error("Comparison load error:", err);
    } finally {
      setComparisonLoading(false);
    }
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await api.getScanHistory(20, 0);
        setScans(res.scans);
        setStats(res.stats);
      } catch (err) {
        if (err instanceof Error && err.message.startsWith('error.')) {
          setErrorKey(err.message);
        } else {
          setErrorKey('results.failedToLoadHistory');
        }
        console.error('History fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <StatusTerminal messages={[t('results.loadingHistory'), t('results.queryingDb')]} />
      </div>
    );
  }

  if (errorKey) {
    const isAuthError = errorKey.includes('auth');
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center gap-4 px-6">
        <StatusTerminal messages={[t('results.historyLoadFailed')]} />
        <p className="text-error font-[family-name:var(--font-mono)] text-xs tracking-widest">
          {t(errorKey)}
        </p>
        {isAuthError ? (
          <Link
            to="/auth"
            className="text-neon font-[family-name:var(--font-mono)] text-xs tracking-widest no-underline hover:underline"
          >
            {t('results.signInRequired')}
          </Link>
        ) : (
          <button
            onClick={() => window.location.reload()}
            className="text-neon font-[family-name:var(--font-mono)] text-xs tracking-widest no-underline hover:underline bg-transparent border-none cursor-pointer"
          >{t('common.tryAgain')}</button>
        )}
      </div>
    );
  }

  const totalScans = stats?.total_scans ?? scans.length;
  const avgScore = stats?.avg_freshness_index ?? 0;
  const freshRate = stats?.fresh_rate_percent ?? 0;

  return (
    <div className="min-h-[calc(100vh-4rem)] px-6 md:px-16 lg:px-24 py-8 md:py-12">
      <div className="max-w-4xl mx-auto">
        <StatusTerminal
          messages={[
            t('results.scanHistoryTerminal'),
            `${t('results.totalPrefix')}${totalScans}`,
            `${t('results.avgScorePrefix')}${avgScore}`,
          ]}
          className="mb-6"
        />
        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight font-[family-name:var(--font-display)]">
            {t('results.scanTitle')}<span className="text-neon">{t('results.resultsTitle')}</span>
          </h1>
          {scans.length > 1 && (
            <button
              onClick={() => {
                setCompareMode(!compareMode);
                setSelectedIds([]);
              }}
              className={`font-mono text-xs tracking-wider px-4 py-2 border font-bold cursor-pointer transition-colors ${
                compareMode 
                  ? 'bg-neon text-on-primary border-neon hover:bg-neon-dim' 
                  : 'bg-transparent text-on-surface-variant border-outline-variant hover:text-on-surface'
              }`}
            >
              {compareMode ? t('results.exitCompare', 'CANCEL COMPARE') : t('results.enterCompare', 'COMPARE SCANS')}
            </button>
          )}
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mb-10">
          <GlassCard className="p-4 text-center" variant="tonal">
            <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest text-on-surface-variant block mb-1">
              {t('results.totalScans')}
            </span>
            <span className="font-[family-name:var(--font-display)] text-2xl font-bold text-neon">
              {totalScans}
            </span>
          </GlassCard>
          <GlassCard className="p-4 text-center" variant="tonal">
            <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest text-on-surface-variant block mb-1">
              {t('results.avgFreshness')}
            </span>
            <span className="font-[family-name:var(--font-display)] text-2xl font-bold text-neon">
              {avgScore}
            </span>
          </GlassCard>
          <GlassCard className="p-4 text-center" variant="tonal">
            <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest text-on-surface-variant block mb-1">
              {t('results.freshRate')}
            </span>
            <span className="font-[family-name:var(--font-display)] text-2xl font-bold text-secondary">
              {freshRate}%
            </span>
          </GlassCard>
        </div>

        {/* Analytics link */}
        {totalScans > 0 && (
          <Link
            to="/analytics"
            className="flex items-center justify-center gap-2 bg-surface-mid text-on-surface py-3 font-[family-name:var(--font-display)] font-bold text-sm tracking-wider no-underline text-center transition-all duration-200 hover:bg-surface-high ghost-border mb-10"
          >
            <BarChart3 size={16} />
            View Analytics Dashboard
          </Link>
        )}

        {/* History list */}
        {scans.length === 0 ? (
          <div className="text-center py-16">
            <StatusTerminal messages={[t('results.noScansFound'), t('results.runFirstScan')]} className="justify-center mb-4" />
            <Link
              to="/scanner"
              className="bg-neon text-on-primary px-8 py-4 font-[family-name:var(--font-display)] font-bold text-sm tracking-wider no-underline hover:bg-neon-dim transition-colors inline-block"
            >
              {t('results.initiateFirstScan')}
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {scans.map(h => {
              const isChecked = selectedIds.includes(h.id);
              const cardContent = (
                <GlassCard
                  className={`p-5 transition-all duration-200 group-hover:bg-surface-high ${h.is_fresh ? 'freshness-bar-fresh' : 'freshness-bar-spoiled'} ${compareMode && isChecked ? 'border-neon!' : ''}`}
                  variant="tonal"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {compareMode && (
                        <div className="shrink-0 text-neon">
                          {isChecked ? <CheckSquare size={18} /> : <Square size={18} className="text-on-surface-variant" />}
                        </div>
                      )}

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
                      {!compareMode && <ArrowRight size={16} className="text-on-surface-variant group-hover:text-neon transition-colors" />}
                    </div>
                  </div>
                </GlassCard>
              );

              if (compareMode) {
                return (
                  <button
                    key={h.id}
                    onClick={() => handleToggleSelect(h.id)}
                    className="w-full text-left bg-transparent border-none p-0 cursor-pointer block no-underline group"
                  >
                    {cardContent}
                  </button>
                );
              }

              return (
                <Link
                  key={h.id}
                  to={`/analysis?id=${h.id}`}
                  className="block no-underline group"
                >
                  {cardContent}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating comparison trigger bar */}
      {compareMode && selectedIds.length > 0 && (
        <div className="fixed bottom-6 inset-x-6 z-40 max-w-4xl mx-auto animate-in">
          <GlassCard className="p-4 border-l-4 border-neon! flex items-center justify-between" variant="tonal">
            <span className="font-mono text-xs text-on-surface uppercase">
              {selectedIds.length === 1 
                ? t('results.selectOneMore', 'SELECT 1 MORE SCAN TO COMPARE') 
                : t('results.readyToCompare', '2 SCANS SELECTED FOR COMPARISON')}
            </span>
            {selectedIds.length === 2 && (
              <button
                onClick={handleCompare}
                disabled={comparisonLoading}
                className="font-mono text-xs bg-neon text-on-primary px-6 py-2.5 font-bold border-none hover:bg-neon-dim transition-colors cursor-pointer disabled:opacity-50 pulse-glow"
              >
                {comparisonLoading ? 'LOADING...' : t('results.compareNow', 'COMPARE NOW')}
              </button>
            )}
          </GlassCard>
        </div>
      )}

      {/* Comparison Detail Overlay Modal */}
      {comparisonData && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 overflow-y-auto flex items-center justify-center p-6 animate-in">
          <div className="bg-surface-lowest border border-outline-variant max-w-3xl w-full p-6 relative">
            {/* Close */}
            <button 
              onClick={() => setComparisonData(null)}
              className="absolute top-4 right-4 text-on-surface-variant hover:text-neon cursor-pointer bg-transparent border-none"
            >
              <X size={18} />
            </button>

            <span className="font-mono text-[0.625rem] tracking-widest text-on-surface-variant uppercase block mb-2">
              {t('results.compareTitle', 'Biomarker Freshness Comparison')}
            </span>
            <h2 className="text-xl font-bold font-display uppercase mb-6">
              {t('results.sideBySide', 'Specimen Comparison Mode')}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Scan 1 Card */}
              <GlassCard className="p-4" variant="tonal">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-display font-bold text-sm text-neon">SPECIMEN A</h3>
                    <span className="font-mono text-[9px] text-on-surface-variant">{comparisonData.scan1.scan_display_id}</span>
                  </div>
                  <span className="font-mono text-[9px] text-on-surface-variant">
                    {new Date(comparisonData.scan1.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
                {comparisonData.scan1.photo_url && (
                  <img 
                    src={comparisonData.scan1.photo_url} 
                    alt="Specimen A" 
                    className="w-full h-32 object-cover border border-outline-variant mb-3 opacity-80" 
                  />
                )}
                <div className="flex justify-between items-baseline mb-4">
                  <span className="font-display font-bold text-lg">{comparisonData.scan1.species.common_name}</span>
                  <span className="font-mono font-bold text-lg text-secondary">{comparisonData.scan1.freshness_index}%</span>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-mono">
                    <div className="flex justify-between mb-1">
                      <span>GILLS</span>
                      <span>{comparisonData.scan1.biomarkers.gill_saturation.score}%</span>
                    </div>
                    <div className="w-full bg-surface-highest h-1">
                      <div className="bg-secondary h-full" style={{ width: `${comparisonData.scan1.biomarkers.gill_saturation.score}%` }} />
                    </div>
                  </div>
                  <div className="text-[10px] font-mono">
                    <div className="flex justify-between mb-1">
                      <span>EYES</span>
                      <span>{comparisonData.scan1.biomarkers.corneal_clarity.score}%</span>
                    </div>
                    <div className="w-full bg-surface-highest h-1">
                      <div className="bg-secondary h-full" style={{ width: `${comparisonData.scan1.biomarkers.corneal_clarity.score}%` }} />
                    </div>
                  </div>
                  <div className="text-[10px] font-mono">
                    <div className="flex justify-between mb-1">
                      <span>SCALES</span>
                      <span>{comparisonData.scan1.biomarkers.epidermal_tension.score}%</span>
                    </div>
                    <div className="w-full bg-surface-highest h-1">
                      <div className="bg-secondary h-full" style={{ width: `${comparisonData.scan1.biomarkers.epidermal_tension.score}%` }} />
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Scan 2 Card */}
              <GlassCard className="p-4" variant="tonal">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-display font-bold text-sm text-neon">SPECIMEN B</h3>
                    <span className="font-mono text-[9px] text-on-surface-variant">{comparisonData.scan2.scan_display_id}</span>
                  </div>
                  <span className="font-mono text-[9px] text-on-surface-variant">
                    {new Date(comparisonData.scan2.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
                {comparisonData.scan2.photo_url && (
                  <img 
                    src={comparisonData.scan2.photo_url} 
                    alt="Specimen B" 
                    className="w-full h-32 object-cover border border-outline-variant mb-3 opacity-80" 
                  />
                )}
                <div className="flex justify-between items-baseline mb-4">
                  <span className="font-display font-bold text-lg">{comparisonData.scan2.species.common_name}</span>
                  <span className="font-mono font-bold text-lg text-secondary">{comparisonData.scan2.freshness_index}%</span>
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] font-mono">
                    <div className="flex justify-between mb-1">
                      <span>GILLS</span>
                      <span>{comparisonData.scan2.biomarkers.gill_saturation.score}%</span>
                    </div>
                    <div className="w-full bg-surface-highest h-1">
                      <div className="bg-secondary h-full" style={{ width: `${comparisonData.scan2.biomarkers.gill_saturation.score}%` }} />
                    </div>
                  </div>
                  <div className="text-[10px] font-mono">
                    <div className="flex justify-between mb-1">
                      <span>EYES</span>
                      <span>{comparisonData.scan2.biomarkers.corneal_clarity.score}%</span>
                    </div>
                    <div className="w-full bg-surface-highest h-1">
                      <div className="bg-secondary h-full" style={{ width: `${comparisonData.scan2.biomarkers.corneal_clarity.score}%` }} />
                    </div>
                  </div>
                  <div className="text-[10px] font-mono">
                    <div className="flex justify-between mb-1">
                      <span>SCALES</span>
                      <span>{comparisonData.scan2.biomarkers.epidermal_tension.score}%</span>
                    </div>
                    <div className="w-full bg-surface-highest h-1">
                      <div className="bg-secondary h-full" style={{ width: `${comparisonData.scan2.biomarkers.epidermal_tension.score}%` }} />
                    </div>
                  </div>
                </div>
              </GlassCard>
            </div>

            {/* Delta calculation */}
            <GlassCard className="p-4 text-center font-mono text-xs" variant="glass">
              <span className="font-bold text-neon uppercase block mb-1">
                {t('results.varianceLabel', 'Variance & Decay Metrics')}
              </span>
              <p className="text-[10px] text-on-surface-variant">
                {comparisonData.scan1.freshness_index === comparisonData.scan2.freshness_index ? (
                  t('results.identicalFreshness', 'Specimens have identical freshness indices.')
                ) : (
                  `${t('results.specimenA', 'Specimen A')} is ${Math.abs(comparisonData.scan1.freshness_index - comparisonData.scan2.freshness_index)}% ${
                    comparisonData.scan1.freshness_index > comparisonData.scan2.freshness_index 
                      ? t('results.fresher', 'fresher') 
                      : t('results.moreDecayed', 'more decayed')
                  } ${t('results.thanSpecimenB', 'than Specimen B')}.`
                )}
              </p>
            </GlassCard>
          </div>
        </div>
      )}
    </div>
  );
}
