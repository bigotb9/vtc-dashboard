"use client"

/**
 * Section par sens (Entrées / Sorties) avec compteur + table compacte.
 * Référence : doc Phase 3 Écran 6 §2.5.
 */

import { ArrowDownCircle, ArrowUpCircle } from "lucide-react"
import { CategoriesTable } from "@/components/compta/CategoriesTable"
import type { CategorieListItem } from "@/types/compta-ui"

type Props = {
  sens:  "credit" | "debit"
  rows:  CategorieListItem[]
}

export function CategoriesSection({ sens, rows }: Props) {
  const isEntree = sens === "credit"
  const Icon = isEntree ? ArrowDownCircle : ArrowUpCircle

  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2.5">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
          isEntree
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "bg-red-500/10 text-red-600 dark:text-red-400"
        }`}>
          <Icon size={14} strokeWidth={2.5} />
        </div>
        <h2 className={`text-sm font-bold tracking-tight ${
          isEntree ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
        }`}>
          {isEntree ? "Entrées" : "Sorties"}
        </h2>
        <span className="text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
          ({rows.length} catégorie{rows.length > 1 ? "s" : ""})
        </span>
      </div>

      <CategoriesTable rows={rows} />
    </section>
  )
}
