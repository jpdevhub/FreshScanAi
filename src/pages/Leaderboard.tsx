import { useEffect, useState } from "react";
import Skeleton from "../components/Skeleton";
import { useTranslation } from 'react-i18next';
import { api } from "../lib/api";

type Badge = "gold" | "silver" | "bronze" | "unranked";
type Trend = "up" | "down" | "stable";

interface Vendor {
  id: string;
  name: string;
  avg_freshness_score: number;
  total_scans: number;
  trust_score: number;
}

const BADGE: Record<Badge, { labelKey: string; color: string }> = {
  gold: { labelKey: 'leaderboard.badge.gold', color: "var(--color-neon-yellow, #f59e0b)" },
  silver: { labelKey: 'leaderboard.badge.silver', color: "var(--color-on-surface, #9ca3af)" },
  bronze: { labelKey: 'leaderboard.badge.bronze', color: "var(--color-neon-orange, #f97316)" },
  unranked: {
    labelKey: 'leaderboard.badge.unranked',
    color: "var(--color-outline-variant, #6b7280)",
  },
};

const TREND: Record<Trend, { icon: string; color: string; labelKey: string }> = {
  up: { icon: "^", color: "var(--color-neon-green, #22c55e)", labelKey: 'leaderboard.trend.improving' },
  down: { icon: "v", color: "var(--color-error, #ef4444)", labelKey: 'leaderboard.trend.declining' },
  stable: { icon: "-", color: "var(--color-on-surface, #9ca3af)", labelKey: 'leaderboard.trend.stable' },
};

export default function Leaderboard() {
  const { t } = useTranslation();

      const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const getBadgeFromScore = (score: number): Badge => {
    if (score >= 90) return 'gold';
    if (score >= 80) return 'silver';
    if (score >= 70) return 'bronze';
    return 'unranked';
  };

  useEffect(() => {
    setLoading(true);
    api.getLeaderboard()
      .then((data) => setVendors(data.leaderboard || []))
      .catch((err) => {
        if (err instanceof Error && err.message.startsWith('error.')) {
          setErrorKey(err.message);
        } else {
          setErrorKey('leaderboard.failedFetchLeaderboard');
        }
        console.error("Leaderboard fetch error:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Title & Subtitle Skeletons */}
        <Skeleton className="h-9 w-3/4 mb-1" />
        <Skeleton className="h-4 w-full mb-8 opacity-60" />

        {/* List Skeletons - Generating 5 placeholder rows */}
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 border border-outline-variant/30 bg-surface-low"
            >
              {/* Index Number */}
              <Skeleton className="w-7 h-5" />

              {/* Badge */}
              <Skeleton className="w-20 h-4 shrink-0" />

              {/* Name & Address */}
              <div className="flex-1 min-w-0 space-y-2">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>

              {/* Score & Scans */}
              <div className="text-right shrink-0 space-y-2 flex flex-col items-end">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>

              {/* Trend Icon */}
              <Skeleton className="w-4 h-6 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );

  if (errorKey)
    return (
      <div className="flex items-center justify-center min-h-screen text-error">
        {t(errorKey)}
      </div>
    );

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-1 font-display text-on-surface">
        {t('leaderboard.title')}
      </h1>
      <p className="mb-8 text-sm font-mono tracking-widest text-on-surface/60">
        {t('leaderboard.subtitle')}
      </p>

      {vendors.length === 0 ? (
        <p className="text-on-surface/40 text-center py-20 font-mono">
          {t('leaderboard.noVendorData')}
        </p>
      ) : (
        <div className="space-y-3">
          {vendors.map((vendor, index) => {
            const badgeType = getBadgeFromScore(vendor.trust_score ?? 0);
            const badge = BADGE[badgeType];
            const trend = TREND['stable']; // Trend data is not available from the API
            return (
              <div
                key={vendor.id}
                className="flex items-center gap-4 p-4 border border-outline-variant/30 bg-surface-low"
              >
                <span className="w-7 text-center font-mono tracking-widest text-on-surface/40">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span
                  className="text-xs font-mono tracking-widest shrink-0"
                  style={{ color: badge.color }}
                >
                  {t(badge.labelKey)}
                </span>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-on-surface truncate font-display">
                    {vendor.name}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-neon font-mono">
                    {(vendor.avg_freshness_score ?? 0).toFixed(1)}
                    <span className="text-xs font-normal text-on-surface/40">{t('ashboard.scorePercentage')}</span>
                  </p>
                  <p className="text-xs text-on-surface/40 font-mono tracking-widest">
                    {vendor.total_scans ?? 0} {t('leaderboard.scans')}
                  </p>
                </div>

                <span
                  className="text-lg font-bold shrink-0 font-mono"
                  title={t(trend.labelKey)}
                  style={{ color: trend.color }}
                >
                  {trend.icon}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
