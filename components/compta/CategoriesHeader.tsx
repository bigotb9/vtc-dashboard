"use client"

/**
 * Header de la liste catégories (Écran 6 §2.2).
 * Icône violet/ambre + titre + sous-titre dynamique + bouton Ajouter.
 */

import Link from "next/link"
import { Folder, Plus } from "lucide-react"

type Props = {
  nbActives:        number
  nbEntrees:        number
  nbSorties:        number
  nbAvecMapping:    number
  nbTotal:          number
}

export function CategoriesHeader({ nbActives, nbEntrees, nbSorties, nbAvecMapping, nbTotal }: Props) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-amber-500 flex items-center justify-center shadow-lg shadow-violet-500/30 flex-shrink-0">
          <Folder size={20} className="text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-none">
            Catégories d&apos;opérations
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
            <span className="font-semibold tabular-nums text-gray-700 dark:text-gray-200">{nbActives}</span> actives
            · <span className="tabular-nums">{nbEntrees}</span> entrées
            · <span className="tabular-nums">{nbSorties}</span> sorties
            · Mapping SYSCOHADA pour <span className="tabular-nums font-semibold">{nbAvecMapping}/{nbTotal}</span>
          </p>
        </div>
      </div>

      <Link
        href="/comptabilite/categories/nouvelle"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-sm font-semibold shadow-md shadow-emerald-500/25 transition"
      >
        <Plus size={14} />
        Ajouter
      </Link>
    </div>
  )
}
