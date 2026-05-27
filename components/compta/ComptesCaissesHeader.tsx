"use client"

/**
 * Header de la page liste Comptes & Caisses (Écran 5 §2.2).
 *
 * Bloc titre + sous-titre dynamique + bouton "Ajouter" qui pointe vers
 * /comptabilite/comptes-caisses/nouveau.
 */

import Link from "next/link"
import { Wallet, Plus } from "lucide-react"

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR")

type Props = {
  nbCaisses:        number
  nbComptes:        number
  tresorerieTotale: number
}

export function ComptesCaissesHeader({ nbCaisses, nbComptes, tresorerieTotale }: Props) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/30 flex-shrink-0">
          <Wallet size={20} className="text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-none">
            Comptes &amp; Caisses
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
            {nbCaisses} caisse{nbCaisses > 1 ? "s" : ""} · {nbComptes} compte{nbComptes > 1 ? "s" : ""} bancaire{nbComptes > 1 ? "s" : ""} · Trésorerie{" "}
            <span className={`font-semibold tabular-nums ${tresorerieTotale < 0 ? "text-red-600 dark:text-red-400" : "text-gray-700 dark:text-gray-200"}`}>
              {fmt(tresorerieTotale)} F
            </span>
          </p>
        </div>
      </div>

      <Link
        href="/comptabilite/comptes-caisses/nouveau"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-sm font-semibold shadow-md shadow-emerald-500/25 transition"
      >
        <Plus size={14} />
        Ajouter
      </Link>
    </div>
  )
}
