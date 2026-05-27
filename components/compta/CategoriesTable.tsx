"use client"

/**
 * Table compacte des catégories (Écran 6 §2.6).
 *  - Libellé + pill type
 *  - Code SYSCOHADA en pastille
 *  - Volume formaté coloré selon sens
 *  - Nb ops
 *  - Actions (œil + crayon)
 * Lignes inactives en opacity 0.45.
 */

import Link from "next/link"
import { Eye, Pencil, AlertTriangle } from "lucide-react"
import type { CategorieListItem } from "@/types/compta-ui"

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR")
const fmtCompact = (n: number) => {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`
  if (abs >= 1_000)     return `${(n / 1_000).toFixed(0)}k`
  return fmt(n)
}

const TYPE_LABEL: Record<string, string> = {
  recette:        "Recette",
  depense:        "Dépense",
  apport:         "Apport",
  reversement:    "Reversement",
  avance:         "Avance",
  investissement: "Investissement",
  remboursement:  "Remboursement",
  dotation:       "Dotation",
  transfert:      "Transfert",
  autre:          "Autre",
}

type Props = {
  rows: CategorieListItem[]
}

export function CategoriesTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 dark:border-white/[0.10] p-6 text-center text-xs text-gray-400">
        Aucune catégorie dans cette section
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50/80 dark:bg-white/[0.02]">
          <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <th className="text-left px-3 py-2.5">Catégorie</th>
            <th className="text-left px-3 py-2.5 hidden md:table-cell">Compte SYSCOHADA</th>
            <th className="text-right px-3 py-2.5">Volume</th>
            <th className="text-right px-3 py-2.5 hidden sm:table-cell">Ops</th>
            <th className="text-right px-3 py-2.5 w-[80px]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const isCredit = r.sens === "credit"
            const volColor = (r.volume_total ?? 0) === 0
              ? "text-gray-400 dark:text-gray-500"
              : isCredit
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            return (
              <tr
                key={r.id}
                className={`border-t border-gray-100 dark:border-white/[0.04] group hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition ${
                  !r.actif ? "opacity-45" : ""
                }`}
              >
                <td className="px-3 py-2.5">
                  <Link href={`/comptabilite/categories/${r.id}`} className="block">
                    <p className="text-[13px] font-semibold text-gray-900 dark:text-white truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition">
                      {r.libelle}
                      {!r.actif && (
                        <span className="ml-1.5 text-[9.5px] font-bold text-gray-400 uppercase tracking-wider">
                          inactif
                        </span>
                      )}
                    </p>
                    <p className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
                      <span className="inline-block px-1.5 py-px rounded text-[9px] font-bold uppercase tracking-wider bg-violet-500/10 text-violet-600 dark:text-violet-400">
                        {TYPE_LABEL[r.type] ?? r.type}
                      </span>
                      {r.description && (
                        <span className="truncate max-w-[180px] italic text-gray-400 dark:text-gray-500">
                          {r.description}
                        </span>
                      )}
                    </p>
                  </Link>
                </td>
                <td className="px-3 py-2.5 hidden md:table-cell">
                  <Link href={`/comptabilite/categories/${r.id}`} className="flex items-center gap-1.5 min-w-0">
                    {r.compte_syscohada_code ? (
                      <>
                        <span className="font-mono text-[10.5px] bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded font-bold flex-shrink-0">
                          {r.compte_syscohada_code}
                        </span>
                        {!r.mapping_complet && (
                          <span title="Mapping incomplet" className="text-amber-500">
                            <AlertTriangle size={11} />
                          </span>
                        )}
                        <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                          {r.compte_syscohada_libelle ?? "—"}
                        </span>
                      </>
                    ) : (
                      <span className="text-[11px] text-amber-500">Non mappé</span>
                    )}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Link href={`/comptabilite/categories/${r.id}`} className={`font-mono font-bold text-[12.5px] tabular-nums ${volColor}`}>
                    {fmtCompact(r.volume_total ?? 0)}
                    <span className="text-[9.5px] font-semibold text-gray-400 dark:text-gray-500 ml-0.5">F</span>
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-right hidden sm:table-cell">
                  <Link href={`/comptabilite/categories/${r.id}`} className="font-mono tabular-nums text-[12px] text-gray-700 dark:text-gray-300">
                    {r.nb_operations ?? 0}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="inline-flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <Link
                      href={`/comptabilite/categories/${r.id}`}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-gray-500 hover:text-violet-500 hover:bg-violet-500/10 transition"
                      title="Voir le détail"
                    >
                      <Eye size={13} />
                    </Link>
                    <Link
                      href={`/comptabilite/categories/${r.id}/modifier`}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-gray-500 hover:text-violet-500 hover:bg-violet-500/10 transition"
                      title="Modifier"
                    >
                      <Pencil size={13} />
                    </Link>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
