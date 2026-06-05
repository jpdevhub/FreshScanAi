import { useEffect, useState } from "react";

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
}

const BADGE: Record<Badge, { label: string; color: string }> = {
  gold:     { label: "[ GOLD ]",     color: "var(--color-neon-yellow, #f59e0b)" },
  silver:   { label: "[ SILVER ]",   color: "var(--color-on-surface, #9ca3af)" },
  bronze:   { label: "[ BRONZE ]",   color: "var(--color-neon-orange, #f97316)" },
  unranked: { label: "[ UNRANKED ]", color: "var(--color-outline-variant, #6b7280)" },
};

const TREND: Record<Trend, { icon: string; color: string; label: string }> = {
  up:     { icon: "^", color: "var(--color-neon-green, #22c55e)",  label: "Improving" },
  down:   { icon: "v", color: "var(--color-error, #ef4444)",       label: "Declining" },
  stable: { icon: "-", color: "var(--color-on-surface, #9ca3af)", label: "Stable"    },
};

export default function Leaderboard() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/vendors/leaderboard`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch leaderboard.");
        return r.json();
      })
      .then((data) => setVendors(data.leaderboard || []))
      .catch((e)   => setError(e.message))
      .finally(()  => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen text-on-surface">
      LOADING...
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center min-h-screen text-error">
      {error}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-1 font-[family-name:var(--font-display)] text-on-surface">
        VENDOR TRUST LEADERBOARD
      </h1>
      <p className="mb-8 text-sm font-[family-name:var(--font-mono)] tracking-widest text-on-surface/60">
        RANKINGS BASED ON ANONYMOUS FRESHNESS SCANS ACROSS MARKETS
      </p>

      {vendors.length === 0 ? (
        <p className="text-on-surface/40 text-center py-20 font-[family-name:var(--font-mono)]">
          NO VENDOR DATA YET.
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
                <span className="w-7 text-center font-[family-name:var(--font-mono)] tracking-widest text-on-surface/40">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span
                  className="text-xs font-[family-name:var(--font-mono)] tracking-widest shrink-0"
                  style={{ color: badge.color }}
                >
                  {badge.label}
                </span>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-on-surface truncate font-[family-name:var(--font-display)]">
                    {vendor.name}
                  </p>
                  <p className="text-xs text-on-surface/50 truncate font-[family-name:var(--font-mono)] tracking-widest">
                    {vendor.address}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-neon font-[family-name:var(--font-mono)]">
                    {(vendor.avg_freshness_score ?? 0).toFixed(1)}
                    <span className="text-xs font-normal text-on-surface/40">/100</span>
                  </p>
                  <p className="text-xs text-on-surface/40 font-[family-name:var(--font-mono)] tracking-widest">
                    {vendor.total_scans ?? 0} SCANS
                  </p>
                </div>

                <span
                  className="text-lg font-bold shrink-0 font-[family-name:var(--font-mono)]"
                  title={trend.label}
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