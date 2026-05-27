"use client"

/**
 * Badges d'usage compacts (Écran 10 §3.4).
 * Caisses (cyan) + Comptes (violet) + Catégories (vert). Si 0 sur les 3 :
 * affiche "Non utilisé" italique gris.
 */

import { Wallet, Landmark, Folder } from "lucide-react"

type Props = {
  nbCaisses:     number
  nbComptes:     number
  nbCategories:  number
  size?:         "xs" | "sm"
}

export function PlanUsageBadges({ nbCaisses, nbComptes, nbCategories, size = "sm" }: Props) {
  const total = nbCaisses + nbComptes + nbCategories
  if (total === 0) {
    return (
      <span className="text-[10.5px] italic text-gray-400 dark:text-gray-500 whitespace-nowrap">
        Non utilisé
      </span>
    )
  }

  const iconSize = size === "xs" ? 10 : 12
  const cls = size === "xs" ? "text-[9.5px] px-1 py-0.5" : "text-[10.5px] px-1.5 py-0.5"

  return (
    <div className="inline-flex items-center gap-1 flex-wrap">
      {nbCaisses > 0 && (
        <span className={`inline-flex items-center gap-0.5 rounded ${cls} bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 font-bold tabular-nums whitespace-nowrap`}>
          <Wallet size={iconSize} strokeWidth={2.2} /> {nbCaisses}
        </span>
      )}
      {nbComptes > 0 && (
        <span className={`inline-flex items-center gap-0.5 rounded ${cls} bg-violet-500/10 text-violet-700 dark:text-violet-300 font-bold tabular-nums whitespace-nowrap`}>
          <Landmark size={iconSize} strokeWidth={2.2} /> {nbComptes}
        </span>
      )}
      {nbCategories > 0 && (
        <span className={`inline-flex items-center gap-0.5 rounded ${cls} bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold tabular-nums whitespace-nowrap`}>
          <Folder size={iconSize} strokeWidth={2.2} /> {nbCategories}
        </span>
      )}
    </div>
  )
}
