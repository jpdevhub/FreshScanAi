import GlassCard from "../GlassCard";
export default function ScanSkeleton()  {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="flex flex-col md:flex-row gap-6">
        <GlassCard className="flex-1 p-8">
          <div className="h-4 w-32 skeleton-shimmer rounded mb-4"></div>
          <div className="h-16 w-40 skeleton-shimmer rounded mb-4"></div>
          <div className="h-2 w-full skeleton-shimmer rounded"></div>
        </GlassCard>

        <GlassCard className="md:w-72 p-6">
          <div className="h-4 w-24 skeleton-shimmer rounded mb-4"></div>
          <div className="h-8 w-full skeleton-shimmer rounded mb-3"></div>
          <div className="h-8 w-full skeleton-shimmer rounded"></div>
        </GlassCard>
      </div>

      <GlassCard className="p-6">
        <div className="h-5 w-40 skeleton-shimmer rounded mb-4"></div>
        <div className="space-y-3">
          <div className="h-16 skeleton-shimmer rounded"></div>
          <div className="h-16 skeleton-shimmer rounded"></div>
          <div className="h-16 skeleton-shimmer rounded"></div>
        </div>
      </GlassCard>

      <GlassCard className="p-4">
        <div className="h-12 skeleton-shimmer rounded"></div>
      </GlassCard>
    </div>
  );
}