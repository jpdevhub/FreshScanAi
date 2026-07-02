import { useEffect, useState } from "react";
import { useTranslation } from 'react-i18next';
import { CalendarCheck, Crown, ShieldCheck, Zap } from "lucide-react";
import Skeleton from "../components/Skeleton";
import type { VendorAchievement } from "../lib/types";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

type Badge = "gold" | "silver" | "bronze" | "unranked";
type Trend = "up" | "down" | "stable";

interface Vendor {
  id: string;
  name: string;
  address: string;
  avg_freshness_score: number;
  total_scans: number;
  trust_badge: Badge;
  trend: Trend;
  achievements?: VendorAchievement[];
}

const BADGE: Record<Badge, { label: string; color: string }> = {
  gold: { label: "leaderboard.goldBadge", color: "var(--color-neon-yellow, #f59e0b)" },
  silver: { label: "leaderboard.silverBadge", color: "var(--color-on-surface, #9ca3af)" },
  bronze: { label: "leaderboard.bronzeBadge", color: "var(--color-neon-orange, #f97316)" },
  unranked: {
    label: "leaderboard.unrankedBadge",
    color: "var(--color-outline-variant, #6b7280)",
  },
};

const TREND: Record<Trend, { icon: string; color: string; label: string }> = {
  up: {
    icon: "^",
    color: "var(--color-neon-green, #22c55e)",
    label: "leaderboard.improving",
  },
  down: { icon: "v", color: "var(--color-error, #ef4444)", label: "leaderboard.declining" },
  stable: {
    icon: "-",
    color: "var(--color-on-surface, #9ca3af)",
    label: "leaderboard.stable",
  },
};

const ACHIEVEMENT_ICON = {
  bolt: Zap,
  calendar: CalendarCheck,
  crown: Crown,
  shield: ShieldCheck,
};

function AchievementBadges({ achievements = [] }: { achievements?: VendorAchievement[] }) {
  if (!achievements.length) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {achievements.slice(0, 4).map((achievement) => {
        const Icon =
          ACHIEVEMENT_ICON[achievement.icon as keyof typeof ACHIEVEMENT_ICON] ?? ShieldCheck;
        return (
          <span
            key={achievement.code}
            title={`${achievement.title}: ${achievement.description}`}
            className="inline-flex h-6 w-6 items-center justify-center border border-neon/50 bg-surface-lowest text-neon shadow-[0_0_14px_rgba(195,244,0,0.22)]"
            aria-label={achievement.title}
          >
            <Icon size={13} strokeWidth={2.4} />
          </span>
        );
      })}
    </div>
  );
}

export default function Leaderboard() {
  const { t } = useTranslation();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/vendors/leaderboard`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch leaderboard.");
        return r.json();
      })
      .then((data) => setVendors(data.leaderboard || []))
      .catch((e) => setError(e.message))
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

  if (error)
    return (
      <div className="flex items-center justify-center min-h-screen text-error">
        {error}
      </div>
    );

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-1 font-display text-on-surface">
        {t('leaderboard.vendorTrustLeaderboard')}
      </h1>
      <p className="mb-8 text-sm font-mono tracking-widest text-on-surface/60">
        {t('leaderboard.vendorSubtitle')}
      </p>

      {vendors.length === 0 ? (
        <p className="text-on-surface/40 text-center py-20 font-mono">
          {t('leaderboard.noVendorData')}
        </p>
      ) : (
        <div className="space-y-3">
          {vendors.map((vendor, index) => {
            const badge = BADGE[vendor.trust_badge ?? "unranked"];
            const trend = TREND[vendor.trend ?? "stable"];
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
                  {t(badge.label)}
                </span>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-on-surface truncate font-display">
                    {vendor.name}
                  </p>
                  <p className="text-xs text-on-surface/50 truncate font-mono tracking-widest">
                    {vendor.address}
                  </p>
                  <AchievementBadges achievements={vendor.achievements} />
                </div>

                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-neon font-mono">
                    {(vendor.avg_freshness_score ?? 0).toFixed(1)}
                    <span className="text-xs font-normal text-on-surface/40">
                      /100
                    </span>
                  </p>
                  <p className="text-xs text-on-surface/40 font-mono tracking-widest">
                    {vendor.total_scans ?? 0} {t('leaderboard.scans')}
                  </p>
                </div>

                <span
                  className="text-lg font-bold shrink-0 font-mono"
                  title={t(trend.label)}
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
