"use client"

/**
 * Card "Opérations utilisant cette catégorie" (Écran 6 §3.5).
 * 5 dernières ops + lien "Voir toutes (N)" → /operations?categorie_id=…
 */

import Link from "next/link"
import { History, ArrowDownToLine, ArrowUpFromLine } from "lucide-react"
import { CaisseLogo } from "@/components/compta/CaisseLogo"
import type { CategorieDetail } from "@/types/compta-ui"

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR")
const fmtDate = (s: string) => {
  const d = new Date(s + "T00:00:00")
  if (!Number.isFinite(d.getTime())) return s
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
}

type Props = {
  detail: CategorieDetail
}

export function CategorieOpsList({ detail }: Props) {
  return (
    <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-violet-500 to-transparent" />
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-md shadow-violet-500/30 flex-shrink-0">
            <History size={16} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Opérations utilisant cette catégorie</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">5 plus récentes · validées</p>
          </div>
        </div>
        <Link
          href={`/comptabilite/operations?categorie_id=${detail.id}`}
          className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:underline whitespace-nowrap"
        >
          Voir tout ({detail.nb_operations})
        </Link>
      </div>

      {detail.dernieres_operations.length === 0 ? (
        <div className="text-center text-xs text-gray-400 dark:text-gray-500 py-8">
          Aucune opération
        </div>
      ) : (
        <ul className="space-y-1">
          {detail.dernieres_operations.map(op => {
            const isEntree = op.type === "entree"
            const Icon = isEntree ? ArrowDownToLine : ArrowUpFromLine
            return (
              <li key={op.id}>
                <Link
                  href={`/comptabilite/operations/${op.id}`}
                  className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.03] transition group"
                >
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isEntree ? "text-emerald-500 bg-emerald-500/10" : "text-red-500 bg-red-500/10"
                  }`}>
                    <Icon size={13} strokeWidth={2.5} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-gray-900 dark:text-white truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition">
                      {op.libelle}
                    </p>
                    <p className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5 truncate">
                      <span className="tabular-nums">{fmtDate(op.date_operation)}</span>
                      {op.caisse_libelle && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 truncate">
                            <CaisseLogo caisse={{ code: op.caisse_code, libelle: op.caisse_libelle }} size="xs" />
                            <span className="truncate">{op.caisse_libelle}</span>
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <span className={`text-[12px] font-black tabular-nums flex-shrink-0 ${
                    isEntree ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                  }`}>
                    {isEntree ? "+" : "−"}{fmt(op.montant)}<span className="text-[9.5px] font-semibold opacity-70 ml-0.5">F</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
