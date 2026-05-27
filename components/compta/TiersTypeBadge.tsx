"use client"

/**
 * Badge coloré pour le type d'un tiers (Phase 4.x Vague 2 §3.2).
 *
 * Codes couleur (cf. spec) :
 *   - client      → vert
 *   - fournisseur → ambre
 *   - salarie     → cyan
 *   - autre       → violet
 */

import { User, Building2, BadgeCheck, Sparkles } from "lucide-react"
import type { TiersType } from "@/types/compta-ui"

const STYLES: Record<TiersType, { label: string; cls: string; Icon: React.ElementType }> = {
  client: {
    label: "Client",
    cls:   "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20",
    Icon:  User,
  },
  fournisseur: {
    label: "Fournisseur",
    cls:   "bg-amber-500/12 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20",
    Icon:  Building2,
  },
  salarie: {
    label: "Salarié",
    cls:   "bg-cyan-500/12 text-cyan-700 dark:text-cyan-300 ring-1 ring-cyan-500/20",
    Icon:  BadgeCheck,
  },
  autre: {
    label: "Autre",
    cls:   "bg-violet-500/12 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/20",
    Icon:  Sparkles,
  },
}

type Size = "xs" | "sm" | "md"
const SIZE: Record<Size, string> = {
  xs: "text-[9.5px] px-1.5 py-px gap-0.5",
  sm: "text-[10.5px] px-2 py-0.5 gap-1",
  md: "text-[11.5px] px-2.5 py-1 gap-1",
}

type Props = {
  type:  TiersType
  size?: Size
}

export function TiersTypeBadge({ type, size = "sm" }: Props) {
  const cfg = STYLES[type]
  const Icon = cfg.Icon
  const iconSize = size === "xs" ? 9 : size === "sm" ? 11 : 13
  return (
    <span className={`inline-flex items-center font-bold uppercase tracking-wider rounded ${cfg.cls} ${SIZE[size]}`}>
      <Icon size={iconSize} strokeWidth={2.5} />
      {cfg.label}
    </span>
  )
}
