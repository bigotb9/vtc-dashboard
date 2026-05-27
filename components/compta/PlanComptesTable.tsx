"use client"

/**
 * Liste compacte des comptes d'une classe (Écran 10 §3.3).
 */

import { PlanCompteRowComponent } from "@/components/compta/PlanCompteRow"
import type { PlanCompteRow } from "@/types/compta-ui"

type Props = {
  rows:    PlanCompteRow[]
  onPick:  (row: PlanCompteRow) => void
}

export function PlanComptesTable({ rows, onPick }: Props) {
  if (rows.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
        Aucun compte
      </div>
    )
  }
  return (
    <div className="rounded-lg overflow-hidden divide-y divide-gray-100 dark:divide-white/[0.04]">
      {rows.map(r => (
        <PlanCompteRowComponent key={r.code} row={r} onClick={onPick} />
      ))}
    </div>
  )
}
