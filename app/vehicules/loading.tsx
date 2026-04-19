export default function VehiculesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <div className="h-7 w-36 bg-gray-200 dark:bg-gray-800 rounded-lg" />
          <div className="h-4 w-44 bg-gray-100 dark:bg-gray-800/60 rounded" />
        </div>
        <div className="h-10 w-44 bg-gray-200 dark:bg-gray-800 rounded-xl" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 h-24" />
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] h-56" />
        ))}
      </div>
    </div>
  )
}
