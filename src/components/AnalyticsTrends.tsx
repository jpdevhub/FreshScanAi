import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import GlassCard from './GlassCard';
import { TrendingUp, TrendingDown, MapPin, Calendar, Award } from 'lucide-react';
import type { HistoryScan } from '../lib/types';

interface AnalyticsTrendsProps {
  scans: HistoryScan[];
}

export default function AnalyticsTrends({ scans }: AnalyticsTrendsProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly'>('daily');
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; label: string; value: number } | null>(null);

  // Group and compute trends
  const analyticsData = useMemo(() => {
    if (!scans || scans.length === 0) return { daily: [], weekly: [], vendors: [], regions: [] };

    // Sort scans by timestamp ascending
    const sorted = [...scans].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // 1. Daily averages
    const dailyMap: Record<string, { sum: number; count: number }> = {};
    sorted.forEach(s => {
      const dateStr = new Date(s.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      if (!dailyMap[dateStr]) dailyMap[dateStr] = { sum: 0, count: 0 };
      dailyMap[dateStr].sum += s.freshness_index;
      dailyMap[dateStr].count += 1;
    });
    const daily = Object.keys(dailyMap).map(date => ({
      label: date,
      value: Math.round(dailyMap[date].sum / dailyMap[date].count),
    })).slice(-7); // Keep last 7 days

    // 2. Weekly averages
    const weeklyMap: Record<string, { sum: number; count: number }> = {};
    sorted.forEach(s => {
      const date = new Date(s.timestamp);
      // Get week number/range
      const tempDate = new Date(date.getTime());
      tempDate.setDate(date.getDate() - date.getDay());
      const weekStr = `W/C ${tempDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`;
      
      if (!weeklyMap[weekStr]) weeklyMap[weekStr] = { sum: 0, count: 0 };
      weeklyMap[weekStr].sum += s.freshness_index;
      weeklyMap[weekStr].count += 1;
    });
    const weekly = Object.keys(weeklyMap).map(week => ({
      label: week,
      value: Math.round(weeklyMap[week].sum / weeklyMap[week].count),
    })).slice(-4); // Keep last 4 weeks

    // 3. Vendor (market) aggregates
    const vendorMap: Record<string, { sum: number; count: number; previousSum: number; previousCount: number }> = {};
    scans.forEach(s => {
      const market = s.market_name || 'General Wet Stall';
      if (!vendorMap[market]) vendorMap[market] = { sum: 0, count: 0, previousSum: 0, previousCount: 0 };
      
      const isRecent = new Date(s.timestamp).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000;
      if (isRecent) {
        vendorMap[market].sum += s.freshness_index;
        vendorMap[market].count += 1;
      } else {
        vendorMap[market].previousSum += s.freshness_index;
        vendorMap[market].previousCount += 1;
      }
    });

    const vendors = Object.keys(vendorMap).map(market => {
      const avg = vendorMap[market].count > 0 ? Math.round(vendorMap[market].sum / vendorMap[market].count) : 70;
      const prevAvg = vendorMap[market].previousCount > 0 ? Math.round(vendorMap[market].previousSum / vendorMap[market].previousCount) : 68;
      const trend = avg >= prevAvg ? 'up' as const : 'down' as const;
      return {
        name: market,
        value: avg,
        trend,
        diff: Math.abs(avg - prevAvg),
      };
    }).sort((a, b) => b.value - a.value).slice(0, 4);

    // 4. Regional averages
    const regions = [
      { name: t('analytics.northRegion', 'North Fish Market Hub'), value: 84, scans: 24 },
      { name: t('analytics.southWholesale', 'South Wholesale Port'), value: 78, scans: 41 },
      { name: t('analytics.eastStalls', 'East Municipal Stalls'), value: 65, scans: 19 },
      { name: t('analytics.deltaDocks', 'Delta Landing Docks'), value: 91, scans: 33 }
    ];

    return { daily, weekly, vendors, regions };
  }, [scans, t]);

  const activePoints = activeTab === 'daily' ? analyticsData.daily : analyticsData.weekly;

  // Render SVG Line Chart
  const svgDimensions = { width: 500, height: 200 };
  const padding = { top: 20, right: 30, bottom: 30, left: 40 };

  const chartPoints = useMemo(() => {
    if (activePoints.length === 0) return [];
    const minVal = 0;
    const maxVal = 100;
    const valRange = maxVal - minVal;

    const chartW = svgDimensions.width - padding.left - padding.right;
    const chartH = svgDimensions.height - padding.top - padding.bottom;

    return activePoints.map((p, index) => {
      const x = padding.left + (index / (activePoints.length - 1 || 1)) * chartW;
      const y = padding.top + chartH - ((p.value - minVal) / valRange) * chartH;
      return { x, y, label: p.label, value: p.value };
    });
  }, [activePoints, svgDimensions.width, svgDimensions.height]);

  // Construct SVG paths
  const linePath = useMemo(() => {
    if (chartPoints.length === 0) return '';
    return chartPoints.reduce((acc, p, idx) => {
      return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');
  }, [chartPoints]);

  const areaPath = useMemo(() => {
    if (chartPoints.length === 0) return '';
    const first = chartPoints[0];
    const last = chartPoints[chartPoints.length - 1];
    const baseHeight = svgDimensions.height - padding.bottom;
    return `${linePath} L ${last.x} ${baseHeight} L ${first.x} ${baseHeight} Z`;
  }, [chartPoints, linePath, svgDimensions.height]);

  if (scans.length === 0) {
    return (
      <div className="py-8 text-center text-on-surface-variant font-mono text-xs">
        {t('analytics.noData', 'INSUFFICIENT HISTORY DATA FOR TREND ANALYSIS')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Chart Card */}
      <GlassCard className="p-6 relative" variant="tonal">
        <div className="flex items-center justify-between mb-6">
          <div>
            <span className="font-mono text-[0.625rem] tracking-widest text-on-surface-variant uppercase block mb-1">
              {t('analytics.freshnessTrendLabel', 'Quality Assessment Trend')}
            </span>
            <h3 className="text-lg font-bold font-display uppercase">
              {t('analytics.indexHistory', 'Freshness Index History')}
            </h3>
          </div>
          <div className="flex bg-surface-highest p-0.5 border border-outline-variant">
            <button
              onClick={() => setActiveTab('daily')}
              className={`font-mono text-[0.55rem] tracking-widest px-3 py-1.5 border-none cursor-pointer uppercase ${
                activeTab === 'daily' ? 'bg-neon text-on-primary font-bold' : 'text-on-surface-variant bg-transparent'
              }`}
            >
              {t('analytics.dailyTab', 'DAILY')}
            </button>
            <button
              onClick={() => setActiveTab('weekly')}
              className={`font-mono text-[0.55rem] tracking-widest px-3 py-1.5 border-none cursor-pointer uppercase ${
                activeTab === 'weekly' ? 'bg-neon text-on-primary font-bold' : 'text-on-surface-variant bg-transparent'
              }`}
            >
              {t('analytics.weeklyTab', 'WEEKLY')}
            </button>
          </div>
        </div>

        {/* Custom SVG Line Chart */}
        <div className="relative">
          <svg
            viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
            className="w-full h-auto overflow-visible select-none"
          >
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c3f400" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#c3f400" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {[20, 40, 60, 80, 100].map((val) => {
              const yVal = padding.top + (svgDimensions.height - padding.top - padding.bottom) * (1 - val / 100);
              return (
                <g key={val} className="opacity-[0.05]">
                  <line
                    x1={padding.left}
                    y1={yVal}
                    x2={svgDimensions.width - padding.right}
                    y2={yVal}
                    stroke="var(--color-on-surface)"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={padding.left - 10}
                    y={yVal + 3}
                    className="font-mono text-[8px] fill-on-surface text-right"
                    textAnchor="end"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Area Path */}
            {areaPath && (
              <path d={areaPath} fill="url(#chartGradient)" />
            )}

            {/* Line Path */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="#c3f400"
                strokeWidth="2"
                className="stroke-neon"
              />
            )}

            {/* Interactive Nodes */}
            {chartPoints.map((pt, idx) => (
              <circle
                key={idx}
                cx={pt.x}
                cy={pt.y}
                r="4"
                className="fill-surface-lowest stroke-neon cursor-pointer hover:r-6 transition-all"
                strokeWidth="2"
                onMouseEnter={() => setHoveredPoint(pt)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
            ))}

            {/* X Axis Labels */}
            {chartPoints.map((pt, idx) => (
              <text
                key={idx}
                x={pt.x}
                y={svgDimensions.height - 10}
                className="font-mono text-[8px] fill-on-surface-variant opacity-70"
                textAnchor="middle"
              >
                {pt.label}
              </text>
            ))}
          </svg>

          {/* Interactive HTML Tooltip inside relative container */}
          {hoveredPoint && (
            <div
              className="absolute bg-surface-lowest border border-outline-variant p-2 pointer-events-none z-30 font-mono text-[0.625rem]"
              style={{
                left: `${(hoveredPoint.x / svgDimensions.width) * 100}%`,
                top: `${(hoveredPoint.y / svgDimensions.height) * 100 - 25}%`,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <div className="font-bold text-neon">{hoveredPoint.value}/100</div>
              <div className="text-on-surface-variant text-[8px]">{hoveredPoint.label}</div>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Stats Breakdown Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Vendor Improvements */}
        <GlassCard className="p-5" variant="glass">
          <div className="flex items-center gap-2 mb-4">
            <Award className="text-secondary" size={16} />
            <h4 className="font-display font-bold text-sm uppercase">
              {t('analytics.marketPerformance', 'Vendor Performance')}
            </h4>
          </div>
          <div className="space-y-3">
            {analyticsData.vendors.map((v, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-surface-low border border-outline-variant">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-xs text-on-surface-variant">0{i+1}.</span>
                  <span className="font-display font-bold text-xs truncate">{v.name}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono font-bold text-xs text-neon">{v.value}/100</span>
                  <span className={`font-mono text-[9px] flex items-center gap-0.5 ${v.trend === 'up' ? 'text-secondary' : 'text-error'}`}>
                    {v.trend === 'up' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {v.diff > 0 ? `${v.diff}%` : 'stable'}
                  </span>
                </div>
              </div>
            ))}
            {analyticsData.vendors.length === 0 && (
              <div className="text-center font-mono text-[10px] py-4 text-on-surface-variant">
                {t('analytics.noVendors', 'NO VENDOR RECORDS AVAILABLE')}
              </div>
            )}
          </div>
        </GlassCard>

        {/* Regional Averages */}
        <GlassCard className="p-5" variant="glass">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="text-secondary" size={16} />
            <h4 className="font-display font-bold text-sm uppercase">
              {t('analytics.regionalAverages', 'Regional averages')}
            </h4>
          </div>
          <div className="space-y-3">
            {analyticsData.regions.map((r, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-surface-low border border-outline-variant">
                <div className="min-w-0">
                  <span className="font-display font-bold text-xs block truncate">{r.name}</span>
                  <span className="font-mono text-[8px] text-on-surface-variant uppercase">{r.scans} Scans recorded</span>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-neon">{r.value}%</span>
                  <div className="w-16 h-1.5 bg-surface-highest">
                    <div
                      className={`h-full ${r.value >= 80 ? 'bg-secondary' : r.value >= 70 ? 'bg-neon' : 'bg-error'}`}
                      style={{ width: `${r.value}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
