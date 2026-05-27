"use client"

/**
 * Une ligne de compte SYSCOHADA dans la table (Écran 10 §3.3).
 * Grid : Code (90px) · Libellé (flex) · Badges usage (auto).
 * Click sur la ligne → ouvre la modal de détail.
 */

import { PlanUsageBadges } from "@/components/compta/PlanUsageBadges"
import type { PlanCompteRow } from "@/types/compta-ui"

type Props = {
  row:      PlanCompteRow
  onClick:  (row: PlanCompteRow) => void
}

export function PlanCompteRowComponent({ row, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={() => onClick(row)}
      className="w-full grid grid-cols-[90px_1fr_auto] items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-violet-500/[0.04] dark:hover:bg-violet-500/[0.08] transition compte-row"
    >
      <span className="font-mono text-[11.5px] bg-violet-500/10 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded font-bold whitespace-nowrap compte-code">
        {row.code}
      </span>
      <span className="flex-1 min-w-0 text-[13px]">
        <span className="text-gray-900 dark:text-white truncate">{row.libelle}</span>
        {row.parent && (
          <span className="ml-1.5 text-[10.5px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
            — parent <span className="font-mono">{row.parent}</span>
          </span>
        )}
      </span>
      <span className="flex-shrink-0 print:hidden">
        <PlanUsageBadges
          nbCaisses={row.nb_caisses}
          nbComptes={row.nb_comptes}
          nbCategories={row.nb_categories}
        />
      </span>
    </button>
  )
}
