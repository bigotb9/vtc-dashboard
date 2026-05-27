"use client"

/**
 * Bannière "Opérations sans justificatif" (Phase 4.x Vague 3 §3.5).
 *
 * Affichée sur le dashboard /comptabilite quand le compteur > 0.
 * Click → redirige vers /comptabilite/operations?missing_proof=true.
 *
 * Pattern alignée sur HealthBanner mais en accent ambre (avertissement non-bloquant).
 */

import Link from "next/link"
import { Paperclip, ArrowRight } from "lucide-react"

type Props = {
  count?:    number | null
  loading?:  boolean
}

export function MissingProofBanner({ count, loading }: Props) {
  if (loading) {
    return (
      <div className="h-[60px] rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse" />
    )
  }
  if (!count || count === 0) return null

  return (
    <Link
      href="/comptabilite/operations?missing_proof=true"
      className="block rounded-2xl bg-amber-500/8 dark:bg-amber-500/[0.06] border border-amber-500/30 px-4 py-3 hover:bg-amber-500/12 dark:hover:bg-amber-500/[0.10] transition group"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/30 flex-shrink-0">
          <Paperclip size={17} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-amber-700 dark:text-amber-300 leading-tight">
            {count} opération{count > 1 ? "s" : ""} sortie vers tiers sans justificatif
          </p>
          <p className="text-[11px] text-amber-600/80 dark:text-amber-400/70 mt-0.5">
            Conformité SYSCOHADA : chaque sortie vers un tiers doit être justifiée. Clique pour voir la liste.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 group-hover:underline whitespace-nowrap flex-shrink-0">
          Voir <ArrowRight size={11} />
        </span>
      </div>
    </Link>
  )
}
