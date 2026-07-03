import { useEffect, useState } from "react";
import { useTranslation } from 'react-i18next';
import { X, MessageSquare, Star } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import Skeleton from "../components/Skeleton";

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

export default function Leaderboard() {
  const { t } = useTranslation();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!selectedVendor) return;
    setReviewsLoading(true);
    fetch(`${API_BASE}/api/v1/vendors/${selectedVendor.id}/reviews`)
      .then(r => r.json())
      .then(data => setReviews(data.reviews || []))
      .catch(console.error)
      .finally(() => setReviewsLoading(false));
  }, [selectedVendor]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendor || !newComment.trim()) return;
    setSubmitting(true);
    try {
      const token = localStorage.getItem('supabase.auth.token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`${API_BASE}/api/v1/vendors/${selectedVendor.id}/reviews`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ rating: newRating, comment: newComment })
      });
      const data = await res.json();
      if (data.success) {
        setReviews(prev => [data.review, ...prev]);
        setNewComment("");
        setNewRating(5);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

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
                onClick={() => setSelectedVendor(vendor)}
                className="flex items-center gap-4 p-4 border border-outline-variant/30 bg-surface-low cursor-pointer hover:border-neon transition-colors"
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

      {/* Vendor Details slide-over panel */}
      {selectedVendor && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-end animate-in">
          <div className="w-full max-w-lg bg-surface-lowest h-full border-l border-outline-variant p-6 overflow-y-auto flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <span className="font-mono text-[0.625rem] tracking-widest text-on-surface-variant uppercase">
                  {t('leaderboard.vendorDetailsHeader', 'Vendor Reputation Details')}
                </span>
                <button 
                  onClick={() => setSelectedVendor(null)}
                  className="text-on-surface-variant hover:text-neon cursor-pointer bg-transparent border-none"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Vendor stats summary */}
              <h2 className="text-xl font-bold font-display uppercase mb-1">{selectedVendor.name}</h2>
              <p className="text-xs text-on-surface-variant font-mono tracking-widest mb-6">{selectedVendor.address}</p>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <GlassCard className="p-4 text-center" variant="tonal">
                  <span className="font-mono text-[0.5625rem] tracking-widest text-on-surface-variant block mb-1">
                    {t('leaderboard.trustIndex', 'Trust Index')}
                  </span>
                  <span className="font-mono text-lg font-bold text-neon">
                    {selectedVendor.avg_freshness_score.toFixed(1)}/100
                  </span>
                </GlassCard>

                <GlassCard className="p-4 text-center" variant="tonal">
                  <span className="font-mono text-[0.5625rem] tracking-widest text-on-surface-variant block mb-1">
                    {t('leaderboard.scansRecorded', 'Scans Recorded')}
                  </span>
                  <span className="font-mono text-lg font-bold text-secondary">
                    {selectedVendor.total_scans}
                  </span>
                </GlassCard>
              </div>

              {/* Submit report form */}
              <GlassCard className="p-4 mb-6" variant="glass">
                <h4 className="font-display font-bold text-xs uppercase mb-3 flex items-center gap-1.5">
                  <MessageSquare size={14} className="text-neon" />
                  {t('leaderboard.reportDiscrepancy', 'File Freshness Report')}
                </h4>
                <form onSubmit={handleSubmitReview} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] text-on-surface-variant">Rating:</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setNewRating(star)}
                          className="cursor-pointer bg-transparent border-none"
                        >
                          <Star 
                            size={16} 
                            fill={star <= newRating ? 'var(--color-neon-yellow, #f59e0b)' : 'none'} 
                            stroke={star <= newRating ? 'var(--color-neon-yellow, #f59e0b)' : 'var(--color-outline-variant)'} 
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={t('leaderboard.reportPlaceholder', 'Enter details of the fish freshness bought, or any dispute...')}
                    className="w-full bg-surface-low border border-outline-variant p-2 text-xs font-mono placeholder:text-on-surface-variant/40 text-on-surface outline-none focus:border-neon h-20 resize-none"
                    required
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-neon text-on-primary font-display font-bold text-xs tracking-wider py-2.5 cursor-pointer border-none hover:bg-neon-dim transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'SUBMITTING...' : 'SUBMIT REPORT'}
                  </button>
                </form>
              </GlassCard>

              {/* Feed of reports */}
              <div className="space-y-3">
                <h4 className="font-display font-bold text-xs uppercase text-on-surface-variant mb-2">
                  {t('leaderboard.recentReports', 'Verified Consumer Feed')}
                </h4>
                {reviewsLoading ? (
                  <div className="font-mono text-[10px] text-on-surface-variant text-center py-6">LOADING REPORTS...</div>
                ) : reviews.length === 0 ? (
                  <div className="font-mono text-[10px] text-on-surface-variant text-center py-6">NO VERIFIED REPORTS YET</div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {reviews.map((r) => (
                      <div key={r.id} className="p-3 bg-surface-low border border-outline-variant text-[10px] font-mono">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-on-surface">{r.author}</span>
                          <div className="flex gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <Star 
                                key={i} 
                                size={10} 
                                fill={i < r.rating ? 'var(--color-neon-yellow, #f59e0b)' : 'none'} 
                                stroke={i < r.rating ? 'var(--color-neon-yellow, #f59e0b)' : 'var(--color-outline-variant)'} 
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-on-surface-variant leading-normal">{r.comment}</p>
                        <span className="text-[8px] text-on-surface-variant/40 block mt-1.5">
                          {new Date(r.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
