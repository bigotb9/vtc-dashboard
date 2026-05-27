"use client"

/**
 * Table d'anomalies (Écran 8) — wrapper de HealthAnomalyRow utilisé sur la
 * page "voir tout" /comptabilite/health/[section]. Sépare la liste en
 * paquets de 10 avec compteur.
 */

import { HealthAnomalyRow } from "@/components/compta/HealthAnomalyRow"
import type { HealthAnomaly } from "@/types/compta-ui"

type Props = {
  anomalies: HealthAnomaly[]
  total:     number
  onFix?:    (a: HealthAnomaly) => void
  loading?:  boolean
}

export function HealthAnomaliesTable({ anomalies, total, onFix, loading }: Props) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[64px] rounded-lg bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse" />
        ))}
      </div>
    )
  }
  if (anomalies.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-emerald-300 dark:border-emerald-500/30 bg-emerald-500/[0.04] dark:bg-emerald-500/[0.06] p-6 text-center">
        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          Aucune anomalie dans cette section
        </p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
        Affichage <span className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums">{anomalies.length}</span> sur{" "}
        <span className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums">{total}</span> anomalie{total > 1 ? "s" : ""}
      </p>
      <div className="space-y-1.5">
        {anomalies.map((a, i) => (
          <HealthAnomalyRow key={`${a.type}_${a.id}_${i}`} anomaly={a} onFix={onFix} />
        ))}
      </div>
    </div>
  )
}
