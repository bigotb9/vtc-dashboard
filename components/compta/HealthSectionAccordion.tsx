"use client"

/**
 * Section accordéon (Écran 8 §2.2).
 *
 * - Head : status dot + icône + titre + chevron
 * - Body : checks + table d'anomalies (10 premières + lien voir tout)
 * - Toggle open/close avec animation chevron
 * - WARN/ERR ouvertes par défaut
 */

import Link from "next/link"
import { useState } from "react"
import { ChevronRight } from "lucide-react"
import { HealthStatusDot } from "@/components/compta/HealthStatusDot"
import { HealthCheckItem } from "@/components/compta/HealthCheckItem"
import { HealthAnomalyRow } from "@/components/compta/HealthAnomalyRow"
import type { HealthSectionPayload, HealthSectionStatus, HealthAnomaly, HealthSectionKey } from "@/types/compta-ui"

type Accent = "emerald" | "amber" | "violet" | "cyan"
const ACCENT_BAR: Record<Accent, string> = {
  emerald: "from-transparent via-emerald-500 to-transparent",
  amber:   "from-transparent via-amber-500 to-transparent",
  violet:  "from-transparent via-violet-500 to-transparent",
  cyan:    "from-transparent via-cyan-500 to-transparent",
}
const ACCENT_ICON: Record<Accent, string> = {
  emerald: "from-emerald-500 to-teal-500 text-white shadow-emerald-500/30",
  amber:   "from-amber-500 to-orange-500 text-white shadow-amber-500/30",
  violet:  "from-violet-500 to-indigo-500 text-white shadow-violet-500/30",
  cyan:    "from-cyan-500 to-sky-500 text-white shadow-cyan-500/30",
}

type Props = {
  sectionKey:  HealthSectionKey
  accent:      Accent
  Icon:        React.ElementType
  title:       string
  description?: string
  payload:     HealthSectionPayload
  onFix?:      (a: HealthAnomaly) => void
  /** Forcer l'ouverture par défaut quel que soit le status (ex: stats globales). */
  forceOpen?:  boolean
}

function defaultOpen(status: HealthSectionStatus, forceOpen?: boolean): boolean {
  if (forceOpen) return true
  return status === "warn" || status === "err"
}

export function HealthSectionAccordion({
  sectionKey, accent, Icon, title, description, payload, onFix, forceOpen,
}: Props) {
  const [open, setOpen] = useState(() => defaultOpen(payload.status, forceOpen))

  const hasMore = payload.anomalies_total > payload.anomalies.length
  const seeMoreHref = `/comptabilite/health/${sectionKey}`

  return (
    <section id={sectionKey} className="relative rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${ACCENT_BAR[accent]}`} />

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition"
      >
        <HealthStatusDot status={payload.status} />
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-md flex-shrink-0 ${ACCENT_ICON[accent]}`}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h3>
          {description && (
            <p className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug truncate">{description}</p>
          )}
        </div>
        {payload.anomalies_total > 0 && (
          <span className={`text-[10.5px] font-bold px-1.5 py-0.5 rounded ${
            payload.status === "err"
              ? "bg-red-500/10 text-red-600 dark:text-red-400"
              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          }`}>
            {payload.anomalies_total}
          </span>
        )}
        <ChevronRight size={16} className={`text-gray-400 transition-transform flex-shrink-0 ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          {/* Checks */}
          <div className="rounded-xl bg-gray-50/60 dark:bg-white/[0.02] border border-gray-200/60 dark:border-white/[0.05] px-3 py-1">
            {payload.checks.map((c, i) => <HealthCheckItem key={i} line={c} />)}
          </div>

          {/* Anomalies (si présentes) */}
          {payload.anomalies.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400">
                  Anomalies détectées
                </p>
                {hasMore && (
                  <Link
                    href={seeMoreHref}
                    className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:underline"
                  >
                    Voir tout ({payload.anomalies_total}) →
                  </Link>
                )}
              </div>
              <div className="space-y-1.5">
                {payload.anomalies.map((a, i) => (
                  <HealthAnomalyRow key={`${a.type}_${a.id}_${i}`} anomaly={a} onFix={onFix} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
