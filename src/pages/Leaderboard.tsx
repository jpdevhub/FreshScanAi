import { useEffect, useState } from "react";

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

const BADGE: Record<Badge, { emoji: string; label: string; color: string }> = {
  gold:     { emoji: "🥇", label: "Gold",     color: "#f59e0b" },
  silver:   { emoji: "🥈", label: "Silver",   color: "#9ca3af" },
  bronze:   { emoji: "🥉", label: "Bronze",   color: "#f97316" },
  unranked: { emoji: "⚪", label: "Unranked", color: "#d1d5db" },
};

const TREND: Record<Trend, { icon: string; color: string; label: string }> = {
  up:     { icon: "↑", color: "#22c55e", label: "Improving" },
  down:   { icon: "↓", color: "#ef4444", label: "Declining" },
  stable: { icon: "→", color: "#9ca3af", label: "Stable"    },
};

export default function Leaderboard() {
  const [vendors, setVendors]   = useState<Vendor[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/vendors/leaderboard")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch leaderboard.");
        return r.json();
      })
      .then((data) => setVendors(data.leaderboard || []))
      .catch((e)   => setError(e.message))
      .finally(()  => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen text-gray-500">
      Loading leaderboard...
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center min-h-screen text-red-500">
      {error}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-1">🐟 Vendor Trust Leaderboard</h1>
      <p className="text-gray-500 mb-8 text-sm">
        Rankings based on anonymous freshness scans across markets.
      </p>

      {vendors.length === 0 ? (
        <p className="text-gray-400 text-center py-20">No vendor data yet.</p>
      ) : (
        <div className="space-y-3">
          {vendors.map((vendor, index) => {
            const badge = BADGE[vendor.trust_badge ?? "unranked"];
            const trend = TREND[vendor.trend ?? "stable"];
            return (
              <div
                key={vendor.id}
                className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                {/* Rank */}
                <span className="w-7 text-center text-lg font-bold text-gray-300">
                  {index + 1}
                </span>

                {/* Badge */}
                <span
                  className="text-2xl"
                  title={badge.label}
                  style={{ color: badge.color }}
                >
                  {badge.emoji}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{vendor.name}</p>
                  <p className="text-xs text-gray-400 truncate">{vendor.address}</p>
                </div>

                {/* Score */}
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-blue-600">
                    {(vendor.avg_freshness_score ?? 0).toFixed(1)}
                    <span className="text-xs font-normal text-gray-400">/100</span>
                  </p>
                  <p className="text-xs text-gray-400">{vendor.total_scans ?? 0} scans</p>
                </div>

                {/* Trend */}
                <span
                  className="text-xl font-bold shrink-0"
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