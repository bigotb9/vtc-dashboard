"use client"

/**
 * Header de la page /comptabilite/tiers (liste) — Phase 4.x Vague 2 §3.2.
 */

import Link from "next/link"
import { Users, Plus } from "lucide-react"

type Props = {
  totalActifs?: number
}

export function TiersHeader({ totalActifs }: Props) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
          <Users size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-none">
            Tiers
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
            Fournisseurs, salariés et autres contacts comptables
            {typeof totalActifs === "number" && (
              <> · <span className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums">{totalActifs}</span> actif{totalActifs > 1 ? "s" : ""}</>
            )}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Link
          href="/comptabilite/tiers/nouveau"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white text-sm font-semibold shadow-md shadow-indigo-500/25 transition"
        >
          <Plus size={14} /> Nouveau tiers
        </Link>
      </div>
    </div>
  )
}
