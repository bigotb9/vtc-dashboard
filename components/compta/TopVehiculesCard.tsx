"use client"

/**
 * Carte "Top 5 véhicules" (Écran 3 Phase 3).
 *
 * Top 5 véhicules par CA sur la période, avec chauffeur principal,
 * nombre de versements et total CA.
 *
 * Référence : doc Phase 3 Écran 3 §5.4.
 */

import Link from "next/link"
import { Car, ExternalLink } from "lucide-react"
import type { TopVehiculeRow } from "@/types/compta-ui"
import { formatMontant } from "@/lib/format/montant"

// Lot S (audit 27/05/2026) : helper centralise via @/lib/format/montant
const fmt = formatMontant
const fmtMontant = (n: number) => {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`
  if (abs >= 1_000)     return `${(n / 1_000).toFixed(0)}k`
  return fmt(n)
}

type Props = {
  rows:     TopVehiculeRow[]
  loading?: boolean
}

export function TopVehiculesCard({ rows, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-5 h-[320px] animate-pulse" />
    )
  }

  const max = Math.max(1, ...rows.map(r => r.ca_total))

  return (
    <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-5">
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-md shadow-violet-500/30 flex-shrink-0">
            <Car size={16} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Top 5 véhicules</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Par CA sur la période</p>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-center text-xs text-gray-400 dark:text-gray-500 py-12">
          Aucun versement véhicule sur la période
        </div>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r, i) => {
            const w = (r.ca_total / max) * 100
            return (
              <li
                key={r.vehicule_id}
                className="relative rounded-xl bg-gray-50/70 dark:bg-white/[0.025] border border-gray-200/50 dark:border-white/[0.05] p-3 overflow-hidden"
              >
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/5 dark:from-violet-500/15 dark:to-fuchsia-500/5"
                  style={{ width: `${w}%` }}
                />
                <div className="relative flex items-center gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] flex items-center justify-center text-[11px] font-black text-gray-500 dark:text-gray-400 tabular-nums">
                    {i + 1}
                  </div>
                  <Link
                    href={`/vehicules/${r.vehicule_id}`}
                    className="flex-1 min-w-0 group"
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition">
                        {r.immatriculation ?? `Véhicule #${r.vehicule_id}`}
                      </span>
                      <ExternalLink size={11} className="text-gray-400 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition" />
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {r.chauffeur_nom ?? "—"} · <span className="tabular-nums">{r.nb_versements}</span> versement{r.nb_versements > 1 ? "s" : ""}
                    </p>
                  </Link>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-black text-gray-900 dark:text-white tabular-nums leading-tight">
                      {fmtMontant(r.ca_total)} <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500">F</span>
                    </p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
