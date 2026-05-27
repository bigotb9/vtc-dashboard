"use client"

/**
 * Encart "Cette opération fait partie d'un transfert interne" (Phase 4.x Vague 1 §3.6).
 *
 * Affiché sur la page détail (Écran 2) quand op.source = 'transfert_interne'.
 * Présente : sens (vers/depuis), libellé de la jumelle, montant, et lien clickable
 * vers la page détail de l'opération jumelle.
 */

import Link from "next/link"
import { ArrowRight, ArrowLeft, ArrowRightLeft, ExternalLink } from "lucide-react"
import type { TransfertJumelleLink } from "@/types/compta-ui"

function formatF(n: number): string {
  return Math.round(n).toLocaleString("fr-FR").replace(/ | /g, " ")
}

type Props = {
  link: TransfertJumelleLink
  /** Libellé de la caisse/compte de CETTE opération (pour afficher l'orientation). */
  selfLibelle?: string | null
}

export function OperationTransfertCard({ link, selfLibelle }: Props) {
  const sortie = link.sens === "vers"   // notre opération est la sortie → fonds vont VERS la jumelle
  return (
    <div className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/[0.06] to-cyan-500/[0.06] p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-md shadow-violet-500/30">
          <ArrowRightLeft size={13} className="text-white" />
        </div>
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-300">
            Transfert interne
          </div>
          <div className="text-[12px] text-gray-600 dark:text-gray-300 leading-tight">
            Cette opération fait partie d&apos;un transfert entre 2 caisses/comptes Boyah.
          </div>
        </div>
      </div>

      {/* Bloc visuel mini */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-3">
        <div className="rounded-lg bg-white/70 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.06] p-2 text-center">
          <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500">
            {sortie ? "Depuis (cette op)" : "Vers (cette op)"}
          </div>
          <div className="mt-0.5 text-[12px] font-bold text-gray-900 dark:text-white truncate">
            {selfLibelle ?? "—"}
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-sm">
            {sortie
              ? <ArrowRight size={13} className="text-white" />
              : <ArrowLeft  size={13} className="text-white" />}
          </div>
          <div className="text-[10px] font-mono tabular-nums font-bold text-violet-700 dark:text-violet-300">
            {formatF(link.montant)} F
          </div>
        </div>
        <div className="rounded-lg bg-white/70 dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.06] p-2 text-center">
          <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500">
            {sortie ? "Vers" : "Depuis"}
          </div>
          <div className="mt-0.5 text-[12px] font-bold text-gray-900 dark:text-white truncate">
            {link.jumelle_libelle}
          </div>
        </div>
      </div>

      {/* Lien vers la jumelle */}
      <Link
        href={`/comptabilite/operations/${link.jumelle_id}`}
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-violet-700 dark:text-violet-300 hover:text-violet-900 dark:hover:text-violet-200 transition"
      >
        <ExternalLink size={12} />
        Voir l&apos;opération jumelle ({link.jumelle_type === "entree" ? "entrée" : "sortie"})
      </Link>
    </div>
  )
}
