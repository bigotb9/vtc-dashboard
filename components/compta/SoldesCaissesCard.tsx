"use client"

/**
 * Carte "Soldes caisses & comptes" (Écran 3 Phase 3).
 *
 * Liste tous les contenants (caisses + comptes) triés par solde décroissant,
 * avec logo, libellé, type et nombre de mouvements.
 *
 * Référence : doc Phase 3 Écran 3 §5.6.
 */

import Link from "next/link"
import { Banknote, ArrowRight } from "lucide-react"
import { CaisseLogo } from "@/components/compta/CaisseLogo"
import type { SoldeCaisseCompteRow } from "@/types/compta-ui"
import { formatMontant } from "@/lib/format/montant"

// Lot S (audit 27/05/2026) : helper centralise via @/lib/format/montant
const fmt = formatMontant

type Props = {
  rows:     SoldeCaisseCompteRow[]
  loading?: boolean
}

export function SoldesCaissesCard({ rows, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-5 h-[320px] animate-pulse" />
    )
  }

  const total = rows.reduce((s, r) => s + r.solde, 0)

  return (
    <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-5">
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-500/30 flex-shrink-0">
            <Banknote size={16} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Soldes caisses &amp; comptes</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Cumul tous temps confondus</p>
          </div>
        </div>
        <Link
          href="/comptabilite/comptes-caisses"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:underline whitespace-nowrap"
        >
          Gérer <ArrowRight size={11} />
        </Link>
      </div>

      <div className="flex items-center justify-between mb-3 px-1">
        <p className="text-[9.5px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</p>
        <p className="text-sm font-black text-gray-900 dark:text-white tabular-nums">
          {fmt(total)} <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500">F</span>
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="text-center text-xs text-gray-400 dark:text-gray-500 py-12">
          Aucune caisse ni compte
        </div>
      ) : (
        <ul className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1 -mr-1">
          {rows.map(r => (
            <li
              key={`${r.type_cible}_${r.id}`}
              className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.03] transition"
            >
              <CaisseLogo caisse={{ code: r.code, libelle: r.libelle }} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-semibold text-gray-900 dark:text-white truncate">
                  {r.libelle}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                  <span className={`inline-block px-1.5 py-px rounded text-[9px] font-bold uppercase tracking-wider ${
                    r.type_cible === "caisse"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-violet-500/10 text-violet-600 dark:text-violet-400"
                  }`}>
                    {r.type_cible}
                  </span>
                  <span className="ml-2 tabular-nums">{r.nb_mouvements} mvt{r.nb_mouvements > 1 ? "s" : ""}</span>
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-[13px] font-black tabular-nums leading-tight ${
                  r.solde >= 0 ? "text-gray-900 dark:text-white" : "text-red-600 dark:text-red-400"
                }`}>
                  {r.solde >= 0 ? "" : "−"}{fmt(Math.abs(r.solde))}
                  <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 ml-0.5">F</span>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
