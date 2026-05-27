"use client"

/**
 * Tableau de l'historique des opérations dans la fiche détail tiers
 * (Phase 4.x Vague 2 §3.4).
 */

import Link from "next/link"
import { ArrowDownLeft, ArrowUpRight, Paperclip, AlertCircle } from "lucide-react"
import type { TiersOperationRow } from "@/types/compta-ui"

function formatF(n: number): string {
  return Math.round(n).toLocaleString("fr-FR").replace(/ | /g, " ")
}
function formatDateFr(iso: string): string {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

type Props = {
  rows:    TiersOperationRow[]
  loading: boolean
}

export function TiersOperationsTable({ rows, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-4 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-gray-100 dark:bg-white/[0.04] animate-pulse" />
        ))}
      </div>
    )
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.08] p-10 text-center text-sm text-gray-500 dark:text-gray-400">
        Aucune opération liée à ce tiers.
        <div className="mt-1 text-xs text-gray-400">
          Lie une opération existante via la page Détail ou crée une nouvelle opération avec ce tiers.
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200/70 dark:border-white/[0.06]">
        <h3 className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
          Historique des opérations · {rows.length}
        </h3>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-white/[0.03] text-[10.5px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          <tr>
            <th className="text-left  px-3 py-2 w-[90px]">Date</th>
            <th className="text-left  px-3 py-2">Libellé</th>
            <th className="text-left  px-3 py-2 w-[130px]">Catégorie</th>
            <th className="text-left  px-3 py-2 w-[110px]">Caisse</th>
            {/* Phase 4.x Vague 3 — colonne Justif. */}
            <th className="text-center px-3 py-2 w-[70px]" title="Justificatifs">Justif.</th>
            <th className="text-right px-3 py-2 w-[130px]">Montant</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-white/[0.04]">
          {rows.map(r => {
            const isEntree = r.type === "entree"
            const cls = isEntree ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            const Icon = isEntree ? ArrowDownLeft : ArrowUpRight
            return (
              <tr key={r.id} className={r.statut === "annule" ? "opacity-50" : ""}>
                <td className="px-3 py-2 font-mono text-xs">{formatDateFr(r.date_operation)}</td>
                <td className="px-3 py-2">
                  <Link href={`/comptabilite/operations/${r.id}`} className="text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 font-medium">
                    {r.libelle}
                  </Link>
                </td>
                <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 truncate max-w-[140px]">
                  {r.categorie_libelle ?? "—"}
                </td>
                <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 truncate max-w-[110px]">
                  {r.caisse_libelle ?? r.compte_libelle ?? "—"}
                </td>
                {/* Phase 4.x Vague 3 — colonne Justif. */}
                <td className="px-3 py-2 text-center">
                  {r.justificatifs_count > 0 ? (
                    <Link
                      href={`/comptabilite/operations/${r.id}`}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 transition"
                      title={`${r.justificatifs_count} justificatif${r.justificatifs_count > 1 ? "s" : ""}`}
                    >
                      <Paperclip size={10} />
                      {r.justificatifs_count}
                    </Link>
                  ) : (r.type === "sortie" ? (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10"
                      title="Justificatif manquant"
                    >
                      <AlertCircle size={10} /> manquant
                    </span>
                  ) : (
                    <span className="text-[10.5px] text-gray-400">—</span>
                  ))}
                </td>
                <td className={`px-3 py-2 text-right font-mono tabular-nums font-bold ${cls}`}>
                  <span className="inline-flex items-center gap-1 justify-end">
                    <Icon size={11} />
                    {isEntree ? "+" : "−"}{formatF(r.montant)} F
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
