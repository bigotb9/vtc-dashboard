"use client"

/**
 * Badge de statut d'une opération comptable.
 * Référence : doc Phase 3 Écran 1 §5.2.
 */

import { Clock, Check, X } from "lucide-react"
import type { StatutOperation } from "@/types/compta-ui"

type Props = { statut: StatutOperation }

const CFG: Record<StatutOperation, {
  label: string
  bg:    string
  text:  string
  Icon:  React.ElementType
}> = {
  brouillon: {
    label: "Brouillon",
    bg:    "bg-amber-500/12 dark:bg-amber-500/15 ring-1 ring-amber-500/20",
    text:  "text-amber-700 dark:text-amber-300",
    Icon:  Clock,
  },
  valide: {
    label: "Validé",
    bg:    "bg-emerald-500/12 dark:bg-emerald-500/15 ring-1 ring-emerald-500/20",
    text:  "text-emerald-700 dark:text-emerald-300",
    Icon:  Check,
  },
  annule: {
    label: "Annulé",
    bg:    "bg-red-400/12 dark:bg-red-400/15 ring-1 ring-red-400/20",
    text:  "text-red-700 dark:text-red-300",
    Icon:  X,
  },
}

export function OperationStatusBadge({ statut }: Props) {
  const cfg = CFG[statut]
  const Icon = cfg.Icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
      <Icon size={11} strokeWidth={2.5} />
      {cfg.label}
    </span>
  )
}
