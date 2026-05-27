"use client"

/**
 * Banner de synthèse large (Écran 8 §2.3).
 *
 * - VERT si toutes les sections sont OK
 * - AMBRE si ≥ 1 WARN sans ERR
 * - ROUGE si ≥ 1 ERR
 *
 * Affiche le score + 4 compteurs principaux.
 */

import { ShieldCheck, AlertTriangle, XCircle } from "lucide-react"
import type { HealthDetailed } from "@/types/compta-ui"
import { formatMontant } from "@/lib/format/montant"

// Lot S (audit 27/05/2026) : helper centralise via @/lib/format/montant
const fmt = formatMontant

type Props = {
  data:    HealthDetailed | null
  loading?: boolean
}

function classify(data: HealthDetailed | null): "ok" | "warn" | "err" {
  if (!data) return "ok"
  const ss = [
    data.sections.equilibre.status,
    data.sections.coherence_ops_ecritures.status,
    data.sections.mappings_syscohada.status,
    data.sections.coherence_journaux.status,
  ]
  if (ss.includes("err"))  return "err"
  if (ss.includes("warn")) return "warn"
  return "ok"
}

export function HealthBannerLarge({ data, loading }: Props) {
  if (loading || !data) {
    return <div className="h-[88px] rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse" />
  }

  const variant = classify(data)
  const palette = variant === "ok"
    ? { bg: "bg-emerald-500/5 dark:bg-emerald-500/[0.06]", border: "border-emerald-500/20", icon: "bg-gradient-to-br from-emerald-500 to-teal-500 shadow-emerald-500/30", text: "text-emerald-700 dark:text-emerald-300", sub: "text-emerald-600/80 dark:text-emerald-400/70" }
    : variant === "warn"
      ? { bg: "bg-amber-500/5 dark:bg-amber-500/[0.06]", border: "border-amber-500/25", icon: "bg-gradient-to-br from-amber-500 to-orange-500 shadow-amber-500/30", text: "text-amber-700 dark:text-amber-300", sub: "text-amber-600/80 dark:text-amber-400/80" }
      : { bg: "bg-red-500/5 dark:bg-red-500/[0.06]", border: "border-red-500/30", icon: "bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/30", text: "text-red-700 dark:text-red-300", sub: "text-red-600/80 dark:text-red-400/80" }

  const Icon = variant === "ok" ? ShieldCheck : variant === "warn" ? AlertTriangle : XCircle

  const title = variant === "ok"
    ? "Comptabilité saine"
    : variant === "warn"
      ? "Points d'attention à corriger"
      : "Anomalies critiques détectées"

  return (
    <div className={`rounded-2xl ${palette.bg} border ${palette.border} p-5 flex flex-wrap items-center gap-4`}>
      <div className={`w-12 h-12 rounded-xl ${palette.icon} flex items-center justify-center text-white shadow-lg flex-shrink-0`}>
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h2 className={`text-base font-black ${palette.text}`}>{title}</h2>
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Score
          </span>
          <span className={`text-2xl font-black tabular-nums ${palette.text}`}>{data.score}%</span>
        </div>
        <p className={`text-[12px] ${palette.sub} mt-1 flex items-center gap-2.5 flex-wrap`}>
          <span><span className="font-bold tabular-nums">{fmt(data.global.nb_ecritures)}</span> écritures</span>
          <span>·</span>
          <span><span className="font-bold tabular-nums">{fmt(data.global.nb_lignes)}</span> lignes</span>
          <span>·</span>
          <span className="font-mono">
            Σ(débit) {data.global.ecart === 0 ? "=" : "≠"} Σ(crédit)
          </span>
          {data.global.nb_anomalies > 0 && (
            <>
              <span>·</span>
              <span className="font-bold">
                {data.global.nb_anomalies} anomalie{data.global.nb_anomalies > 1 ? "s" : ""}
              </span>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
