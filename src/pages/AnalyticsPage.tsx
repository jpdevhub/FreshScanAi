import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, BarChart3, TrendingUp, PieChart as PieIcon } from 'lucide-react';
import {
  PieChart, Pie, Cell, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import GlassCard from '../components/GlassCard';
import StatusTerminal from '../components/StatusTerminal';
import { api } from '../lib/api';
import type { HistoryScan } from '../lib/types';

type TimeRange = '7d' | '30d' | 'all';

const GRADE_COLORS: Record<string, string> = {
  'A+': '#22c55e',
  A: '#22c55e',
  B: '#00e5ff',
  C: '#f59e0b',
  D: '#ef4444',
  F: '#ef4444',
};

const PIE_COLORS = ['#22c55e', '#00e5ff', '#f59e0b', '#ef4444'];

const tooltipStyle = {
  background: 'var(--color-surface-mid)',
  border: '1px solid var(--ghost-border-color)',
  borderRadius: 0,
  fontFamily: 'var(--font-mono)',
  fontSize: '0.625rem',
  color: 'var(--color-on-surface)',
};

const axisTickStyle = {
  fill: 'var(--color-on-surface-variant)',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
};

const axisLineStyle = {
  stroke: 'var(--ghost-border-color)',
};

function formatDate(ts: string) {
  const d = new Date(ts);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const [scans, setScans] = useState<HistoryScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRange>('all');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await api.getScanHistory(100, 0);
        setScans(res.scans);
      } catch (err) {
        if (err instanceof Error && err.message.startsWith('error.')) {
          setErrorKey(err.message);
        } else {
          setErrorKey('results.failedToLoadHistory');
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredScans = useMemo(() => {
    if (timeRange === 'all') return scans;
    const now = Date.now();
    const days = timeRange === '7d' ? 7 : 30;
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    return scans.filter(s => s.timestamp && new Date(s.timestamp).getTime() >= cutoff);
  }, [scans, timeRange]);

  // Grade distribution for pie chart
  const gradeData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredScans.forEach(s => {
      const g = s.grade || 'C';
      counts[g] = (counts[g] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredScans]);

  // Freshness over time for line chart
  const freshnessData = useMemo(() => {
    const byDate: Record<string, { sum: number; count: number }> = {};
    filteredScans.forEach(s => {
      if (!s.timestamp) return;
      const key = formatDate(s.timestamp);
      if (!byDate[key]) byDate[key] = { sum: 0, count: 0 };
      byDate[key].sum += s.freshness_index;
      byDate[key].count += 1;
    });
    return Object.entries(byDate)
      .map(([date, { sum, count }]) => ({
        date,
        avgFreshness: Math.round(sum / count),
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .reverse();
  }, [filteredScans]);

  // Scan volume per day for bar chart
  const volumeData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredScans.forEach(s => {
      if (!s.timestamp) return;
      const key = formatDate(s.timestamp);
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([date, scans]) => ({ date, scans }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .reverse();
  }, [filteredScans]);

  const totalScans = filteredScans.length;
  const avgScore = totalScans
    ? Math.round(filteredScans.reduce((a, s) => a + s.freshness_index, 0) / totalScans)
    : 0;
  const freshRate = totalScans
    ? Math.round((filteredScans.filter(s => s.is_fresh).length / totalScans) * 100)
    : 0;

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <StatusTerminal messages={[t('analytics.loadingAnalytics'), t('analytics.crunchingData')]} />
      </div>
    );
  }

  if (errorKey) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center gap-4 px-6">
        <StatusTerminal messages={[t('analytics.failedToLoad')]} />
        <p className="text-error font-[family-name:var(--font-mono)] text-xs tracking-widest">
          {t(errorKey)}
        </p>
        <Link
          to="/results"
          className="text-neon font-[family-name:var(--font-mono)] text-xs tracking-widest no-underline hover:underline"
        >
          {t('analytics.backToResults')}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] px-6 md:px-16 lg:px-24 py-8 md:py-12">
      <div className="max-w-6xl mx-auto">
        {/* Back */}
        <Link
          to="/results"
          className="inline-flex items-center gap-2 text-on-surface-variant hover:text-neon no-underline transition-colors mb-6 font-[family-name:var(--font-mono)] text-[0.6875rem] tracking-widest"
        >
          <ArrowLeft size={14} />
          {t('analytics.backToResults')}
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight font-[family-name:var(--font-display)]">
              Scan <span className="text-neon">Analytics</span>
            </h1>
            <p className="text-on-surface-variant font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest mt-2">
              Freshness trends and grade distribution across your scans
            </p>
          </div>

          {/* Time range filter */}
          <div className="flex gap-2">
            {([
              { key: '7d', label: t('analytics.days7') },
              { key: '30d', label: t('analytics.days30') },
              { key: 'all', label: t('analytics.allTime') },
            ] as const).map(opt => (
              <button
                key={opt.key}
                onClick={() => setTimeRange(opt.key)}
                className={`px-4 py-2 font-[family-name:var(--font-mono)] text-[0.625rem] tracking-widest transition-colors ${
                  timeRange === opt.key
                    ? 'bg-neon text-on-primary'
                    : 'bg-surface-mid text-on-surface-variant hover:bg-surface-high'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <GlassCard className="p-4 text-center" variant="tonal">
            <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest text-on-surface-variant block mb-1">
              {t('analytics.totalScans')}
            </span>
            <span className="font-[family-name:var(--font-display)] text-2xl font-bold text-neon">
              {totalScans}
            </span>
          </GlassCard>
          <GlassCard className="p-4 text-center" variant="tonal">
            <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest text-on-surface-variant block mb-1">
              {t('analytics.avgFreshness')}
            </span>
            <span className="font-[family-name:var(--font-display)] text-2xl font-bold text-neon">
              {avgScore}
            </span>
          </GlassCard>
          <GlassCard className="p-4 text-center" variant="tonal">
            <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] tracking-widest text-on-surface-variant block mb-1">
              {t('analytics.freshRate')}
            </span>
            <span className="font-[family-name:var(--font-display)] text-2xl font-bold text-secondary">
              {freshRate}%
            </span>
          </GlassCard>
        </div>

        {totalScans === 0 ? (
          <div className="text-center py-16">
            <StatusTerminal messages={[t('analytics.noScansInRange'), t('analytics.tryDifferentFilter')]} className="justify-center mb-4" />
            <Link
              to="/scanner"
              className="bg-neon text-on-primary px-8 py-4 font-[family-name:var(--font-display)] font-bold text-sm tracking-wider no-underline hover:bg-neon-dim transition-colors inline-block"
            >
              {t('analytics.runAScan')}
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Grade Distribution Pie Chart */}
            <GlassCard className="p-6" variant="tonal">
              <div className="flex items-center gap-2 mb-4">
                <PieIcon size={16} className="text-neon" />
                <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">
                  {t('analytics.gradeDistribution')}
                </h2>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={gradeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {gradeData.map((entry, idx) => (
                      <Cell
                        key={entry.name}
                        fill={GRADE_COLORS[entry.name] || PIE_COLORS[idx % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend
                    wrapperStyle={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.625rem',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </GlassCard>

            {/* Scan Volume Bar Chart */}
            <GlassCard className="p-6" variant="tonal">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={16} className="text-neon" />
                <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">
                  {t('analytics.scanVolume')}
                </h2>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={volumeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--ghost-border-color)" />
                  <XAxis
                    dataKey="date"
                    tick={axisTickStyle}
                    axisLine={axisLineStyle}
                  />
                  <YAxis
                    tick={axisTickStyle}
                    axisLine={axisLineStyle}
                    allowDecimals={false}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="scans" fill="#00e5ff" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </GlassCard>

            {/* Freshness Over Time — full width */}
            <GlassCard className="p-6 lg:col-span-2" variant="tonal">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={16} className="text-neon" />
                <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">
                  {t('analytics.freshnessTrend')}
                </h2>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={freshnessData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--ghost-border-color)" />
                  <XAxis
                    dataKey="date"
                    tick={axisTickStyle}
                    axisLine={axisLineStyle}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={axisTickStyle}
                    axisLine={axisLineStyle}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line
                    type="monotone"
                    dataKey="avgFreshness"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={{ fill: '#22c55e', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </GlassCard>
          </div>
        )}
      </div>
    </div>
  );
}
