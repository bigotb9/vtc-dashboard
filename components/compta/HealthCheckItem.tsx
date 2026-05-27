"use client"

/**
 * Ligne de check : icône + label + valeur formatée + status.
 * Référence : doc Phase 3 Écran 8.
 */

import { CheckCircle, AlertTriangle, XCircle } from "lucide-react"
import type { HealthCheckLine } from "@/types/compta-ui"

type Props = {
  line: HealthCheckLine
}

export function HealthCheckItem({ line }: Props) {
  const { status, label, value } = line
  const Icon = status === "ok" ? CheckCircle : status === "warn" ? AlertTriangle : XCircle
  const color = status === "ok"
    ? "text-emerald-500"
    : status === "warn"
      ? "text-amber-500"
      : "text-red-500"

  const valueColor = status === "ok"
    ? "text-emerald-600 dark:text-emerald-400"
    : status === "warn"
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400"

  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-gray-100 dark:border-white/[0.04] last:border-b-0">
      <Icon size={14} className={`flex-shrink-0 ${color}`} strokeWidth={2.2} />
      <span className="text-[12.5px] text-gray-700 dark:text-gray-300 flex-1 min-w-0 truncate">
        {label}
      </span>
      <span className={`text-[12px] font-bold tabular-nums whitespace-nowrap ${valueColor}`}>
        {value}
      </span>
    </div>
  )
}
