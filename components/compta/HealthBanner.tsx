"use client"

/**
 * Bannière santé comptable (Écran 3 Phase 3).
 *
 * Affiche l'état d'équilibre comptable global :
 * - Vert : SUM(débit) === SUM(crédit), aucune anomalie
 * - Rouge : déséquilibre détecté, liste les anomalies
 *
 * Référence : doc Phase 3 Écran 3 §3.2.
 */

import Link from "next/link"
import { ShieldCheck, AlertTriangle, ArrowRight } from "lucide-react"
import type { DashboardHealth } from "@/types/compta-ui"
import { formatMontant } from "@/lib/format/montant"

// Lot S (audit 27/05/2026) : helper centralise via @/lib/format/montant
const fmt = formatMontant

type Props = {
  health:   DashboardHealth | null
  loading?: boolean
}

export function HealthBanner({ health, loading }: Props) {
  if (loading || !health) {
    return (
      <div className="h-[60px] rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse" />
    )
  }

  if (health.ok) {
    return (
      <div className="rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/[0.06] border border-emerald-500/20 px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-500/30 flex-shrink-0">
          <ShieldCheck size={17} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 leading-tight">
            Comptabilité équilibrée
          </p>
          <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/70 mt-0.5">
            <span className="font-semibold tabular-nums">{fmt(health.nb_ecritures)}</span> écritures ·{" "}
            <span className="font-semibold tabular-nums">{fmt(health.nb_lignes)}</span> lignes ·{" "}
            Σ(débit) = Σ(crédit) = <span className="font-semibold tabular-nums">{fmt(health.total_debit)} F</span>
          </p>
        </div>
        <Link
          href="/comptabilite/health"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:underline whitespace-nowrap flex-shrink-0"
        >
          Voir détails <ArrowRight size={11} />
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-red-500/5 dark:bg-red-500/[0.06] border border-red-500/30 px-4 py-3 flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-md shadow-red-500/30 flex-shrink-0">
        <AlertTriangle size={17} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-red-700 dark:text-red-300 leading-tight">
          Déséquilibre comptable détecté
        </p>
        <ul className="mt-1 space-y-0.5">
          {health.anomalies.map((a, i) => (
            <li key={i} className="text-[11px] text-red-600/90 dark:text-red-400/80 tabular-nums">
              • {a}
            </li>
          ))}
        </ul>
      </div>
      <Link
        href="/comptabilite/health"
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 dark:text-red-300 hover:underline whitespace-nowrap flex-shrink-0"
      >
        Voir détails <ArrowRight size={11} />
      </Link>
    </div>
  )
}
