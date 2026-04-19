"use client"

import { motion } from "framer-motion"

type ChauffeurPerformance = { nom: string; ca: number }

const RANK_COLORS = [
  "from-amber-400 to-orange-500",    // 1er
  "from-gray-300 to-gray-400",       // 2e
  "from-orange-700 to-amber-800",    // 3e
  "from-indigo-400 to-violet-500",   // 4e+
]

export default function ChauffeursChart({ data }: { data: ChauffeurPerformance[] }) {
  const top10  = [...data].sort((a, b) => b.ca - a.ca).slice(0, 10)
  const maxCa  = top10[0]?.ca || 1
  const total  = top10.reduce((s, d) => s + d.ca, 0)

  return (
    <div className="space-y-2.5">
      {top10.map((chauffeur, i) => {
        const pct     = (chauffeur.ca / maxCa) * 100
        const share   = total > 0 ? ((chauffeur.ca / total) * 100).toFixed(1) : "0"
        const color   = RANK_COLORS[Math.min(i, RANK_COLORS.length - 1)]
        const isTop3  = i < 3

        return (
          <div key={chauffeur.nom} className="group">
            <div className="flex items-center gap-3 mb-1">
              {/* Rang */}
              <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black text-white flex-shrink-0
                bg-gradient-to-br ${color} ${isTop3 ? "shadow-sm" : "opacity-70"}`}>
                {i + 1}
              </div>

              {/* Nom */}
              <span className={`flex-1 text-xs font-semibold truncate ${
                isTop3 ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400"
              }`}>
                {chauffeur.nom}
              </span>

              {/* Part % */}
              <span className="text-[10px] text-gray-400 dark:text-gray-600 font-medium flex-shrink-0">
                {share}%
              </span>

              {/* Montant */}
              <span className={`text-xs font-bold font-numeric flex-shrink-0 ${
                isTop3 ? "text-indigo-600 dark:text-indigo-400" : "text-gray-600 dark:text-gray-500"
              }`}>
                {Math.round(chauffeur.ca).toLocaleString("fr-FR")}
                <span className="text-[9px] opacity-60 ml-0.5">F</span>
              </span>
            </div>

            {/* Barre de progression */}
            <div className="ml-8 h-1.5 bg-gray-100 dark:bg-[#1A2235] rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full bg-gradient-to-r ${color}`}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, delay: i * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
              />
            </div>
          </div>
        )
      })}

      {top10.length === 0 && (
        <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-600">
          Aucune donnée disponible
        </div>
      )}
    </div>
  )
}
