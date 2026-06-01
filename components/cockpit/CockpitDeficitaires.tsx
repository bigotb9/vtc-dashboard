"use client"

/**
 * components/cockpit/CockpitDeficitaires.tsx
 *
 * Section finance (sensible) — véhicules clients déficitaires du mois.
 * Liste les véhicules sous gestion dont le résultat Boyah < 0 ce mois
 * (recettes − loyer net dû − dépenses absorbées), triés du pire au moins pire.
 *
 * Source : /api/cockpit/finances (champ deficitaires). Affichée uniquement
 * si l'utilisateur a la permission view_finances_cockpit (gestion côté page).
 */

import { TrendingDown, CheckCircle2 } from "lucide-react"
import { formatMontant } from "@/lib/format/montant"
import type { FinanceDeficitaire } from "./types"

type Props = {
  deficitaires: FinanceDeficitaire[]
  loading:      boolean
  error:        string | null
}

export default function CockpitDeficitaires({ deficitaires, loading, error }: Props) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <TrendingDown size={15} className="text-red-500" />
        <h2 className="text-[13px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Véhicules clients déficitaires (ce mois)
        </h2>
        {!loading && !error && deficitaires.length > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400 text-[10px] font-bold tabular-nums">
            {deficitaires.length}
          </span>
        )}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-400">
          Erreur : {error}
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-gray-100 dark:bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : deficitaires.length === 0 ? (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-500/5 border border-emerald-200/60 dark:border-emerald-500/20">
          <CheckCircle2 size={16} className="text-emerald-500" />
          <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
            Aucun véhicule client déficitaire ce mois
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {deficitaires.map(v => (
            <li
              key={v.id_vehicule}
              className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100 dark:border-[#1E2D45] bg-white dark:bg-[#0D1424]"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {v.immatriculation}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  {v.client} · Recettes {formatMontant(v.recettes)} F · Loyer {formatMontant(v.loyer_net)} F · Charges {formatMontant(v.depenses_absorbees)} F
                </p>
              </div>
              <span className="text-sm font-bold tabular-nums text-red-600 dark:text-red-400 shrink-0">
                − {formatMontant(Math.abs(v.resultat))} F
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
