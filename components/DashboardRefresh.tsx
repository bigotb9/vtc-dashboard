"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { RefreshCw } from "lucide-react"
import { motion } from "framer-motion"

const AUTO_REFRESH_MS = 5 * 60 * 1000 // 5 minutes

export default function DashboardRefresh() {
  const router           = useRouter()
  const [spinning, setSpinning]   = useState(false)
  const [lastRefresh, setLast]    = useState<Date>(new Date())
  const [timeAgo, setTimeAgo]     = useState("à l'instant")

  const refresh = useCallback(() => {
    setSpinning(true)
    router.refresh()
    setLast(new Date())
    setTimeout(() => setSpinning(false), 1200)
  }, [router])

  // Auto-refresh toutes les 5 minutes
  useEffect(() => {
    const id = setInterval(refresh, AUTO_REFRESH_MS)
    return () => clearInterval(id)
  }, [refresh])

  // Mise à jour du label "il y a Xm"
  useEffect(() => {
    const tick = () => {
      const diff = Math.floor((Date.now() - lastRefresh.getTime()) / 1000)
      if (diff < 10)  setTimeAgo("à l'instant")
      else if (diff < 60) setTimeAgo(`il y a ${diff}s`)
      else setTimeAgo(`il y a ${Math.floor(diff / 60)}m`)
    }
    tick()
    const id = setInterval(tick, 10000)
    return () => clearInterval(id)
  }, [lastRefresh])

  return (
    <div className="flex items-center gap-2">
      {/* Indicateur live */}
      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">En direct</span>
        <span className="text-[10px] text-emerald-600/60 dark:text-emerald-500/50 hidden md:inline">· {timeAgo}</span>
      </div>

      {/* Bouton refresh */}
      <motion.button
        onClick={refresh}
        whileTap={{ scale: 0.92 }}
        title="Actualiser les données"
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-white dark:bg-[#0D1424] border border-gray-200 dark:border-[#1E2D45] rounded-xl hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition shadow-sm"
      >
        <motion.span animate={{ rotate: spinning ? 360 : 0 }} transition={{ duration: 0.8, ease: "linear" }}>
          <RefreshCw size={12} />
        </motion.span>
        <span className="hidden sm:inline">Actualiser</span>
      </motion.button>
    </div>
  )
}
