"use client"

/**
 * Ligne cliquable dans la liste des destinations du wizard transfert interne
 * (Phase 4.x Vague 1 §3.3).
 *
 * Affiche : pastille (logo via CaisseLogo) + libellé + code SYSCOHADA + solde.
 * Selected → bordure violette + halo doux.
 * Disabled → hachuré (cas où on tente d'afficher la source dans la liste).
 */

import { CaisseLogo } from "@/components/compta/CaisseLogo"
import type { TransfertDestinationItem } from "@/types/compta-ui"

function formatF(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "—"
  return Math.round(n).toLocaleString("fr-FR").replace(/ | /g, " ") + " F"
}

type Props = {
  item:     TransfertDestinationItem
  selected: boolean
  disabled?: boolean
  onClick:  () => void
}

export function DestinationOption({ item, selected, disabled, onClick }: Props) {
  const tagLabel = item.kind === "caisse" ? "Caisse" : "Compte bancaire"
  const tagClass = item.kind === "caisse"
    ? "text-emerald-600 dark:text-emerald-300 bg-emerald-500/10"
    : "text-violet-600 dark:text-violet-300 bg-violet-500/10"

  const solde = item.solde_courant
  const soldeClass = solde === null
    ? "text-gray-400"
    : solde < 0
      ? "text-red-500 dark:text-red-400"
      : "text-gray-700 dark:text-gray-200"

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={[
        "group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition",
        selected
          ? "border-violet-500/60 bg-violet-500/[0.07] ring-1 ring-violet-500/30"
          : "border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] hover:border-violet-300 dark:hover:border-violet-500/40 hover:bg-violet-500/[0.04]",
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
    >
      <CaisseLogo caisse={{ code: item.code, libelle: item.libelle }} size="md" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
            {item.libelle}
          </div>
          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${tagClass}`}>
            {tagLabel}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-[11px]">
          <span className="font-mono text-gray-500 dark:text-gray-400">
            {item.syscohada_code ?? "—"}
          </span>
          <span className="text-gray-300 dark:text-gray-700">·</span>
          <span className={`font-mono tabular-nums font-semibold ${soldeClass}`}>
            solde {formatF(solde)}
          </span>
        </div>
      </div>

      {selected && (
        <div className="shrink-0 w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-md shadow-violet-500/30">
          <svg viewBox="0 0 24 24" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="5 12 10 17 19 8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </button>
  )
}
