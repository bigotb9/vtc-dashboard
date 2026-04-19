export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-7 w-36 bg-gray-200 dark:bg-gray-800 rounded-lg" />
          <div className="h-4 w-52 bg-gray-100 dark:bg-gray-800/60 rounded" />
        </div>
        <div className="h-8 w-36 bg-gray-100 dark:bg-gray-800/60 rounded-xl" />
      </div>

      {/* KPI — ligne 1 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 h-24" />
        ))}
      </div>

      {/* KPI — ligne 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 h-20" />
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 h-64" />

      {/* Table */}
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 h-72" />
    </div>
  )
}
