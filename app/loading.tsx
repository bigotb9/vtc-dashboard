import Image from "next/image"

export default function Loading() {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="flex flex-col items-center gap-5">
        <div className="relative">
          <div className="w-20 h-20 rounded-full overflow-hidden animate-pulse">
            <Image src="/logo.png" alt="Boyah Group" width={80} height={80} className="object-cover" priority />
          </div>
          <div className="absolute inset-[-6px] rounded-full border-2 border-transparent border-t-indigo-500 border-r-indigo-500/30 animate-spin" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Boyah Group</p>
          <p className="text-xs text-gray-400 dark:text-gray-600">Chargement...</p>
        </div>
      </div>
    </div>
  )
}
