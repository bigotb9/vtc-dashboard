"use client"

/**
 * Card individuelle d'une caisse ou d'un compte dans la liste (§2.5).
 * Bordure colorée à gauche selon code, logo officiel, badges, solde coloré.
 */

import Link from "next/link"
import { Eye, Pencil } from "lucide-react"
import { CaisseLogo } from "@/components/compta/CaisseLogo"
import type { ComptesCaissesListItem } from "@/types/compta-ui"

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR")
const fmtDate = (s: string | null) => {
  if (!s) return null
  const d = new Date(s + "T00:00:00")
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" })
    : s
}

const BORDER_COLORS: Record<string, string> = {
  wave:              "border-l-[#1DC8DD]",
  orange_money:      "border-l-[#FF6B00]",
  mtn_momo:          "border-l-[#FFCC00]",
  caisse_principale: "border-l-[#10B981]",
  petite_caisse:     "border-l-[#10B981]",
  sgci:              "border-l-[#8B5CF6]",
  ecobank:           "border-l-[#8B5CF6]",
  nsia:              "border-l-[#8B5CF6]",
}

function soldeClass(solde: number | null): string {
  if (solde == null || solde === 0) return "text-gray-500 dark:text-gray-400"
  return solde > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
}

type Props = {
  item: ComptesCaissesListItem
}

export function CompteCaisseCard({ item }: Props) {
  const borderClass = (item.code && BORDER_COLORS[item.code]) ?? (
    item.type_cible === "caisse" ? "border-l-emerald-400" : "border-l-violet-400"
  )

  return (
    <article
      className={`relative rounded-2xl border bg-white dark:bg-white/[0.02] border-l-4 ${borderClass} border-gray-200/70 dark:border-white/[0.06] p-4 transition hover:shadow-lg dark:hover:bg-white/[0.04] ${
        !item.actif ? "opacity-55" : ""
      }`}
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 6px 18px -10px rgba(0,0,0,0.15)" }}
    >
      {!item.actif && (
        <span className="absolute top-3 right-3 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-gray-200 dark:bg-white/[0.08] text-gray-600 dark:text-gray-400">
          Inactif
        </span>
      )}

      <Link href={`/comptabilite/comptes-caisses/${item.id}`} className="block">
        <div className="flex items-start gap-3 mb-3">
          <CaisseLogo caisse={{ code: item.code, libelle: item.libelle }} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-gray-900 dark:text-white truncate">
              {item.libelle}
            </p>
            <p className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1.5 flex-wrap">
              <span className={`inline-block px-1.5 py-px rounded text-[9px] font-bold uppercase tracking-wider ${
                item.type_cible === "caisse"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-violet-500/10 text-violet-600 dark:text-violet-400"
              }`}>
                {item.type_cible === "caisse" ? "Caisse" : "Compte"}
              </span>
              {item.code && (
                <span className="font-mono text-[9.5px] bg-gray-100 dark:bg-white/[0.05] text-gray-500 dark:text-gray-400 px-1 py-px rounded">
                  {item.code}
                </span>
              )}
              {item.compte_syscohada_code && (
                <span className="font-mono text-[9.5px] bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1 py-px rounded font-bold">
                  {item.compte_syscohada_code}
                </span>
              )}
            </p>
          </div>
        </div>
      </Link>

      <div className="flex items-end justify-between gap-3">
        <Link href={`/comptabilite/comptes-caisses/${item.id}`} className="flex-1 min-w-0">
          <p className="text-[9.5px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em]">
            Solde actuel
          </p>
          <p className={`font-mono font-bold text-[18px] tabular-nums leading-tight mt-0.5 ${soldeClass(item.solde)}`}>
            {item.solde != null ? fmt(item.solde) : "—"}
            <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 ml-1">F</span>
          </p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">
            {item.derniere_operation
              ? `Dernière op : ${fmtDate(item.derniere_operation)}`
              : "Pas encore utilisé"}
          </p>
        </Link>

        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <Link
            href={`/comptabilite/comptes-caisses/${item.id}`}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-gray-500 hover:text-violet-500 hover:bg-violet-500/10 transition"
            title="Voir le détail"
          >
            <Eye size={13} />
          </Link>
          <Link
            href={`/comptabilite/comptes-caisses/${item.id}/modifier`}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-gray-500 hover:text-violet-500 hover:bg-violet-500/10 transition"
            title="Modifier"
          >
            <Pencil size={13} />
          </Link>
        </div>
      </div>
    </article>
  )
}
