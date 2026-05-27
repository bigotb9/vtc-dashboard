"use client"

/**
 * Cellule "Caisse" : logo (CaisseLogo) + libellé tronqué.
 * Référence : doc Phase 3 Écran 1 §3.6.
 */

import { CaisseLogo, type CaisseLike } from "./CaisseLogo"

type Props = {
  caisse: CaisseLike | null
  /** Si null/undefined caisse : afficher un placeholder discret (cas opération sur compte). */
  fallback?: string
}

export function CaisseCell({ caisse, fallback = "—" }: Props) {
  if (!caisse) {
    return <span className="text-xs text-gray-400 dark:text-gray-600">{fallback}</span>
  }
  return (
    <div className="flex items-center gap-2 min-w-0">
      <CaisseLogo caisse={caisse} size="sm" />
      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
        {caisse.libelle ?? "—"}
      </span>
    </div>
  )
}
