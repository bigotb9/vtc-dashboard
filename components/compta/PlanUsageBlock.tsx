"use client"

/**
 * Bloc usage dans la modal de détail (Écran 10 §4.3).
 * Liste cliquable des entités qui utilisent le compte SYSCOHADA.
 */

import Link from "next/link"
import { Wallet, Landmark, Folder, ArrowRight } from "lucide-react"
import type { PlanCompteDetail } from "@/types/compta-ui"

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR")
const fmtCompact = (n: number) => {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`
  if (abs >= 1_000)     return `${(n / 1_000).toFixed(0)}k`
  return fmt(n)
}

type CaisseItem = PlanCompteDetail["usage"]["caisses"][number]
type CompteItem = PlanCompteDetail["usage"]["comptes"][number]
type CatItem    = PlanCompteDetail["usage"]["categories"][number]

type Props = {
  variant:  "caisse" | "compte" | "categorie"
  items:    CaisseItem[] | CompteItem[] | CatItem[]
  onLeave:  () => void   // fermer la modal avant navigation
}

export function PlanUsageBlock({ variant, items, onLeave }: Props) {
  if (items.length === 0) return null

  const headers = variant === "caisse"
    ? { Icon: Wallet,   title: "Caisses",    color: "cyan" as const,    accent: "from-cyan-500 to-sky-500 shadow-cyan-500/30" }
    : variant === "compte"
      ? { Icon: Landmark, title: "Comptes bancaires", color: "violet" as const, accent: "from-violet-500 to-indigo-500 shadow-violet-500/30" }
      : { Icon: Folder,   title: "Catégories",        color: "emerald" as const, accent: "from-emerald-500 to-teal-500 shadow-emerald-500/30" }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br text-white shadow-md ${headers.accent}`}>
          <headers.Icon size={13} strokeWidth={2.2} />
        </span>
        <p className="text-[12px] font-bold text-gray-700 dark:text-gray-200">
          {headers.title} <span className="font-mono tabular-nums text-gray-500 dark:text-gray-400">({items.length})</span>
        </p>
      </div>

      <ul className="space-y-1.5">
        {variant === "caisse" && (items as CaisseItem[]).map(c => (
          <li key={c.id}>
            <Link
              href={`/comptabilite/comptes-caisses/${c.id}`}
              onClick={onLeave}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-gray-50/60 dark:bg-white/[0.02] border border-gray-200/60 dark:border-white/[0.05] hover:bg-violet-500/[0.05] dark:hover:bg-violet-500/[0.08] transition group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-semibold text-gray-900 dark:text-white truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition">
                  {c.libelle}
                  {!c.actif && <span className="ml-1.5 text-[9.5px] font-bold text-gray-400 uppercase">inactif</span>}
                </p>
                <p className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {c.type === "mobile_money" ? "Mobile money" : c.type === "cash" ? "Cash" : "Caisse"}
                  {c.operateur && <> · {c.operateur}</>}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-[11.5px] font-mono font-bold tabular-nums ${
                  c.solde < 0 ? "text-red-600 dark:text-red-400" : "text-gray-700 dark:text-gray-200"
                }`}>
                  {fmtCompact(c.solde)} F
                </span>
                <ArrowRight size={12} className="text-gray-300 group-hover:text-violet-500 transition" />
              </div>
            </Link>
          </li>
        ))}
        {variant === "compte" && (items as CompteItem[]).map(c => (
          <li key={c.id}>
            <Link
              href={`/comptabilite/comptes-caisses/${c.id}`}
              onClick={onLeave}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-gray-50/60 dark:bg-white/[0.02] border border-gray-200/60 dark:border-white/[0.05] hover:bg-violet-500/[0.05] dark:hover:bg-violet-500/[0.08] transition group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-semibold text-gray-900 dark:text-white truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition">
                  {c.libelle}
                  {!c.actif && <span className="ml-1.5 text-[9.5px] font-bold text-gray-400 uppercase">inactif</span>}
                </p>
                <p className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {c.banque ?? "Compte bancaire"}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-[11.5px] font-mono font-bold tabular-nums ${
                  c.solde < 0 ? "text-red-600 dark:text-red-400" : "text-gray-700 dark:text-gray-200"
                }`}>
                  {fmtCompact(c.solde)} F
                </span>
                <ArrowRight size={12} className="text-gray-300 group-hover:text-violet-500 transition" />
              </div>
            </Link>
          </li>
        ))}
        {variant === "categorie" && (items as CatItem[]).map(c => (
          <li key={c.id}>
            <Link
              href={`/comptabilite/categories/${c.id}`}
              onClick={onLeave}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-gray-50/60 dark:bg-white/[0.02] border border-gray-200/60 dark:border-white/[0.05] hover:bg-violet-500/[0.05] dark:hover:bg-violet-500/[0.08] transition group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-semibold text-gray-900 dark:text-white truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition">
                  {c.libelle}
                  {!c.actif && <span className="ml-1.5 text-[9.5px] font-bold text-gray-400 uppercase">inactif</span>}
                </p>
                <p className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {c.type ?? "—"}
                  {c.sens && <> · {c.sens === "credit" ? "Crédit" : "Débit"}</>}
                  {" · "}
                  <span className="font-bold tabular-nums">{c.nb_operations}</span> op{c.nb_operations > 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-[11.5px] font-mono font-bold tabular-nums ${
                  c.sens === "credit" ? "text-emerald-600 dark:text-emerald-400" : c.sens === "debit" ? "text-red-600 dark:text-red-400" : "text-gray-500"
                }`}>
                  {fmtCompact(c.volume_total)} F
                </span>
                <ArrowRight size={12} className="text-gray-300 group-hover:text-violet-500 transition" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
