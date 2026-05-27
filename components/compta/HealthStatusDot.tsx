"use client"

/**
 * Dot coloré ok/warn/err avec glow (Écran 8 §2.4).
 * Le glow box-shadow donne du relief sur fond sombre comme clair.
 */

import type { HealthSectionStatus } from "@/types/compta-ui"

const COLORS: Record<HealthSectionStatus, { bg: string; glow: string }> = {
  ok:   { bg: "#10B981", glow: "rgba(16,185,129,0.5)" },
  warn: { bg: "#F59E0B", glow: "rgba(245,158,11,0.5)" },
  err:  { bg: "#F87171", glow: "rgba(248,113,113,0.5)" },
  info: { bg: "#06B6D4", glow: "rgba(6,182,212,0.45)" },
}

type Props = {
  status: HealthSectionStatus
  size?:  number
}

export function HealthStatusDot({ status, size = 10 }: Props) {
  const c = COLORS[status]
  return (
    <span
      className="inline-block rounded-full flex-shrink-0"
      style={{
        width:      size,
        height:     size,
        background: c.bg,
        boxShadow:  `0 0 ${Math.round(size * 0.8)}px ${c.glow}`,
      }}
    />
  )
}
