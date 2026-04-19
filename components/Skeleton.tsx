"use client"

type SkeletonProps = {
  className?: string
  style?: React.CSSProperties
}

/** Simple shimmer skeleton with Tailwind animation */
function Skeleton({ className = "", style }: SkeletonProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-gray-200 dark:bg-[#1A2235] ${className}`}
      style={style}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent" />
    </div>
  )
}

/** KPI card skeleton */
export function SkeletonKpi() {
  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-36" />
      <Skeleton className="h-2 w-16" />
    </div>
  )
}

/** Chart area skeleton */
export function SkeletonChart() {
  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 space-y-4">
      <Skeleton className="h-4 w-40" />
      <div className="flex items-end gap-2 h-40">
        {[40, 65, 50, 80, 55, 70, 90, 60, 75, 85, 45, 95].map((h, i) => (
          <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  )
}

/** Table skeleton */
export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] overflow-hidden">
      <div className="p-4 border-b border-gray-100 dark:border-[#1E2D45]">
        <Skeleton className="h-4 w-48" />
      </div>
      {/* Header */}
      <div className="flex gap-4 px-4 py-3 bg-gray-50 dark:bg-[#080F1E]">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-t border-gray-50 dark:border-[#1E2D45]/50">
          {[1, 2, 3, 4].map(j => (
            <Skeleton key={j} className="h-3 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

export default Skeleton
