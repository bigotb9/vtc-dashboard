"use client"

/**
 * Bloc visuel DEPUIS → VERS + MONTANT du wizard transfert interne
 * (Phase 4.x Vague 1 §3.4).
 *
 * Trois blocs en grille : source (gauche), flèche centrale, destination (droite),
 * puis une bande basse avec le montant en gros.
 */

import { ArrowRight } from "lucide-react"
import { CaisseLogo } from "@/components/compta/CaisseLogo"

type Side = {
  libelle:        string
  code:           string | null     // code interne (wave_boyah, sgci, …) pour le logo
  syscohada_code: string | null
}

type Props = {
  source:  Side
  dest:    Side
  montant: number
}

function formatF(n: number): string {
  return Math.round(n).toLocaleString("fr-FR").replace(/ | /g, " ")
}

export function TransfertVisualBlock({ source, dest, montant }: Props) {
  return (
    <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/[0.04] to-cyan-500/[0.04] p-4">
      {/* Ligne haute : source ← arrow → dest */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        {/* Source */}
        <div className="rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] p-3 flex flex-col items-center text-center gap-2">
          <span className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
            Depuis
          </span>
          <CaisseLogo caisse={{ code: source.code, libelle: source.libelle }} size="lg" />
          <div className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
            {source.libelle}
          </div>
          <div className="text-[10.5px] font-mono text-gray-500 dark:text-gray-400">
            {source.syscohada_code ?? "—"}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <ArrowRight size={18} className="text-white" />
          </div>
          <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">
            transfert
          </div>
        </div>

        {/* Destination */}
        <div className="rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] p-3 flex flex-col items-center text-center gap-2">
          <span className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
            Vers
          </span>
          <CaisseLogo caisse={{ code: dest.code, libelle: dest.libelle }} size="lg" />
          <div className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
            {dest.libelle}
          </div>
          <div className="text-[10.5px] font-mono text-gray-500 dark:text-gray-400">
            {dest.syscohada_code ?? "—"}
          </div>
        </div>
      </div>

      {/* Ligne basse : montant */}
      <div className="mt-3 rounded-xl bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.08] p-3 flex items-center justify-between">
        <span className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
          Montant
        </span>
        <span className="text-2xl font-black tabular-nums font-mono bg-gradient-to-r from-violet-600 to-cyan-600 dark:from-violet-300 dark:to-cyan-300 bg-clip-text text-transparent">
          {formatF(montant)} F
        </span>
      </div>
    </div>
  )
}
