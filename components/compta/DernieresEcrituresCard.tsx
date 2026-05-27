"use client"

/**
 * Carte "5 dernières écritures" (Écran 3 Phase 3).
 *
 * Liste les 5 écritures valides les plus récentes (hors extournes).
 * Chaque ligne lie vers la page détail de l'opération (si présente).
 *
 * Référence : doc Phase 3 Écran 3 §5.5.
 */

import Link from "next/link"
import { History, ArrowDownToLine, ArrowUpFromLine } from "lucide-react"
import { CaisseLogo } from "@/components/compta/CaisseLogo"
import type { DerniereEcritureRow } from "@/types/compta-ui"

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR")
const fmtDate = (s: string) => {
  const d = new Date(s + "T00:00:00")
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
}

type Props = {
  rows:     DerniereEcritureRow[]
  loading?: boolean
}

export function DernieresEcrituresCard({ rows, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-5 h-[320px] animate-pulse" />
    )
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-5">
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-md shadow-indigo-500/30 flex-shrink-0">
            <History size={16} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Dernières écritures</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">5 plus récentes · hors extournes</p>
          </div>
        </div>
        <Link
          href="/comptabilite/operations"
          className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 hover:underline whitespace-nowrap"
        >
          Voir tout
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="text-center text-xs text-gray-400 dark:text-gray-500 py-12">
          Aucune écriture
        </div>
      ) : (
        <ul className="space-y-1">
          {rows.map(r => {
            const isEntree = r.type === "entree"
            const Icon = isEntree ? ArrowDownToLine : ArrowUpFromLine
            const colorIcon = isEntree
              ? "text-emerald-500 bg-emerald-500/10"
              : r.type === "sortie"
                ? "text-red-500 bg-red-500/10"
                : "text-gray-400 bg-gray-500/10"
            const opHref = r.operation_id ? `/comptabilite/operations/${r.operation_id}` : null
            const inner = (
              <div className="flex items-center gap-3 px-2 py-2.5 rounded-lg group hover:bg-gray-50 dark:hover:bg-white/[0.03] transition">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${colorIcon}`}>
                  <Icon size={13} strokeWidth={2.5} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-semibold text-gray-900 dark:text-white truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition">
                    {r.libelle}
                  </p>
                  <p className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
                    <span className="font-mono bg-gray-100 dark:bg-white/[0.05] px-1 py-px rounded text-[9.5px]">
                      {r.numero}
                    </span>
                    <span>·</span>
                    <span>{r.journal_code}</span>
                    <span>·</span>
                    <span className="tabular-nums">{fmtDate(r.date_ecriture)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {r.caisse_libelle && (
                    <CaisseLogo caisse={{ code: r.caisse_code, libelle: r.caisse_libelle }} size="xs" />
                  )}
                  {r.montant != null && (
                    <span className={`text-[12px] font-black tabular-nums ${
                      isEntree ? "text-emerald-600 dark:text-emerald-400" : r.type === "sortie" ? "text-red-600 dark:text-red-400" : "text-gray-500"
                    }`}>
                      {isEntree ? "+" : r.type === "sortie" ? "−" : ""}
                      {fmt(r.montant)}<span className="text-[9.5px] font-semibold opacity-70 ml-0.5">F</span>
                    </span>
                  )}
                </div>
              </div>
            )
            return (
              <li key={r.ecriture_id}>
                {opHref ? <Link href={opHref}>{inner}</Link> : inner}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
