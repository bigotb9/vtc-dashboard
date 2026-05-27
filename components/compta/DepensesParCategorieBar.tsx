"use client"

/**
 * Bar chart horizontal "Dépenses par catégorie" (Écran 3 Phase 3).
 *
 * Top 5 catégories + "Autres" agrégé. Barre horizontale par catégorie avec
 * pourcentage du total.
 *
 * Référence : doc Phase 3 Écran 3 §5.3.
 */

import { useMemo } from "react"
import { BarChart3 } from "lucide-react"
import type { DepenseCategorieRow } from "@/types/compta-ui"

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR")
const fmtMontant = (n: number) => {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`
  if (abs >= 1_000)     return `${(n / 1_000).toFixed(0)}k`
  return fmt(n)
}

type Props = {
  data:     DepenseCategorieRow[]
  loading?: boolean
}

export function DepensesParCategorieBar({ data, loading }: Props) {
  const max = useMemo(() => Math.max(1, ...data.map(d => d.total)), [data])
  const total = useMemo(() => data.reduce((s, d) => s + d.total, 0), [data])

  if (loading) {
    return (
      <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-5 h-[320px] animate-pulse" />
    )
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center shadow-md shadow-red-500/30 flex-shrink-0">
          <BarChart3 size={16} className="text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Dépenses par catégorie</h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Top 5 + Autres · période courante</p>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="text-center text-xs text-gray-400 dark:text-gray-500 py-12">
          Aucune dépense sur la période
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((row, i) => {
            const pct  = total > 0 ? (row.total / total) * 100 : 0
            const w    = max  > 0 ? (row.total / max)   * 100 : 0
            const isAutres = row.categorie_id == null && row.libelle === "Autres"
            return (
              <div key={row.libelle + "_" + i} className="group">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className={`text-[12px] font-semibold truncate ${isAutres ? "text-gray-400 dark:text-gray-500 italic" : "text-gray-700 dark:text-gray-200"}`}>
                    {row.libelle}
                  </span>
                  <span className="text-[11px] tabular-nums">
                    <span className="font-bold text-gray-900 dark:text-white">{fmtMontant(row.total)} F</span>
                    <span className="text-gray-400 dark:text-gray-500 ml-1.5">{pct.toFixed(1).replace(".0", "")}%</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 dark:bg-white/[0.04] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isAutres
                        ? "bg-gradient-to-r from-gray-400 to-gray-500"
                        : "bg-gradient-to-r from-red-400 via-red-500 to-rose-500"
                    }`}
                    style={{ width: `${w}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
