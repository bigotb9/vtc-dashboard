"use client"

/**
 * Card "Écriture comptable SYSCOHADA" — Écran 2 Phase 3 §3.2.
 *
 * Affichée uniquement si une écriture existe (opérée par la page parente :
 * elle ne rend ce composant que si `ecriture` n'est pas null).
 *
 * Contient :
 *   - Métadonnées (Numéro / Journal / Date / Statut) en grille 4 colonnes
 *   - Tableau partie double : Compte / Libellé / Débit / Crédit + totaux
 *   - Bandeau d'équilibre (vert si équilibré, rouge sinon)
 */

import { Book, Check, AlertTriangle } from "lucide-react"
import type { EcritureView } from "@/types/compta-ui"

const fmtMontant = (n: number) => Math.round(n).toLocaleString("fr-FR")
const fmtDate    = (s: string) => {
  const d = new Date(s + "T00:00:00")
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

const STATUT_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  valide:    { label: "Validée",   bg: "bg-emerald-500/12 ring-1 ring-emerald-500/20", text: "text-emerald-700 dark:text-emerald-300" },
  brouillon: { label: "Brouillon", bg: "bg-amber-500/12 ring-1 ring-amber-500/20",     text: "text-amber-700 dark:text-amber-300" },
  annule:    { label: "Extournée", bg: "bg-red-400/12 ring-1 ring-red-400/20",         text: "text-red-700 dark:text-red-300" },
}

type Props = { ecriture: EcritureView }

export function EcritureComptableCard({ ecriture }: Props) {
  const stCfg = STATUT_BADGE[ecriture.statut] ?? STATUT_BADGE.valide
  const isEq  = ecriture.is_equilibree

  return (
    <div className="relative rounded-2xl overflow-hidden bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] shadow-sm">
      {/* Liseré violet */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-violet-500 to-transparent" />

      {/* Header card */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/[0.04]">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex w-8 h-8 rounded-lg items-center justify-center bg-violet-500/10 text-violet-500">
            <Book size={16} strokeWidth={2.5} />
          </span>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            Écriture comptable SYSCOHADA
          </h3>
        </div>
        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${stCfg.bg} ${stCfg.text}`}>
          {stCfg.label}
        </span>
      </div>

      {/* Métadonnées 4 colonnes */}
      <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-gray-100 dark:border-white/[0.04]">
        <Meta label="Numéro">
          <span className="font-mono text-sm font-semibold text-violet-600 dark:text-violet-400">
            {ecriture.numero}
          </span>
        </Meta>
        <Meta label="Journal">
          <span className="text-sm text-gray-900 dark:text-gray-100">
            <span className="font-mono font-bold text-violet-600 dark:text-violet-400 mr-1">{ecriture.journal_code}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">— {ecriture.journal_libelle}</span>
          </span>
        </Meta>
        <Meta label="Date">
          <span className="font-mono text-sm text-gray-900 dark:text-gray-100 tabular-nums">
            {fmtDate(ecriture.date_ecriture)}
          </span>
        </Meta>
        <Meta label="Libellé">
          <span className="text-sm text-gray-700 dark:text-gray-300 truncate block" title={ecriture.libelle}>
            {ecriture.libelle}
          </span>
        </Meta>
      </div>

      {/* Tableau partie double */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50/70 dark:bg-white/[0.02] border-b border-gray-200/70 dark:border-white/[0.05]">
            <tr>
              <th className="text-left  px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 w-[18%]">Compte</th>
              <th className="text-left  px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 w-[42%]">Libellé</th>
              <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 w-[20%]">Débit</th>
              <th className="text-right px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 w-[20%]">Crédit</th>
            </tr>
          </thead>
          <tbody>
            {ecriture.lignes.map(l => (
              <tr key={l.id} className="border-b border-gray-100 dark:border-white/[0.04]">
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold font-mono bg-violet-500/12 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/20">
                    {l.compte_syscohada_code}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {l.compte_syscohada_libelle ?? l.compte_syscohada_code}
                  </div>
                  {l.libelle_ligne && (
                    <div className="text-[11px] text-gray-500 dark:text-gray-500 mt-0.5">{l.libelle_ligne}</div>
                  )}
                </td>
                <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${
                  l.debit > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-300 dark:text-gray-700"
                }`}>
                  {l.debit > 0 ? fmtMontant(l.debit) : "—"}
                </td>
                <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${
                  l.credit > 0 ? "text-red-500 dark:text-red-400" : "text-gray-300 dark:text-gray-700"
                }`}>
                  {l.credit > 0 ? fmtMontant(l.credit) : "—"}
                </td>
              </tr>
            ))}

            {/* Totaux */}
            <tr className="bg-gray-50/70 dark:bg-white/[0.02] font-bold">
              <td colSpan={2} className="px-4 py-3 text-right text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Totaux
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                {fmtMontant(ecriture.total_debit)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-red-500 dark:text-red-400">
                {fmtMontant(ecriture.total_credit)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Bandeau d'équilibre */}
      <div className={`px-5 py-3 flex items-center gap-2.5 text-sm font-semibold ${
        isEq
          ? "bg-emerald-500/8 text-emerald-700 dark:text-emerald-300"
          : "bg-red-500/8 text-red-700 dark:text-red-300"
      }`}>
        {isEq
          ? <Check size={15} className="text-emerald-500" strokeWidth={2.5} />
          : <AlertTriangle size={15} className="text-red-500" strokeWidth={2.5} />
        }
        {isEq
          ? <span>Écriture équilibrée · Δ = 0 FCFA</span>
          : <span>Écriture déséquilibrée · Δ = {fmtMontant(Math.abs(ecriture.total_debit - ecriture.total_credit))} FCFA</span>
        }
      </div>
    </div>
  )
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <div>{children}</div>
    </div>
  )
}
