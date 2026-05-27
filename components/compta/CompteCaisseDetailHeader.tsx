"use client"

/**
 * Header de la page détail caisse/compte (Écran 5 §3.2).
 * Breadcrumb + back + logo grand + nom + badge actif/inactif + meta + actions.
 */

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Pencil, Plus, ArrowRightLeft } from "lucide-react"
import { CaisseLogo } from "@/components/compta/CaisseLogo"
import type { ComptesCaissesDetail } from "@/types/compta-ui"

type Props = {
  detail: ComptesCaissesDetail
  /** Phase 4.x Vague 1 — callback pour ouvrir le modal Transfert interne. */
  onTransfert?: () => void
}

export function CompteCaisseDetailHeader({ detail, onTransfert }: Props) {
  const router = useRouter()
  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <Link href="/dashboard" className="hover:text-gray-700 dark:hover:text-gray-200 transition">
          Accueil
        </Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <Link href="/comptabilite" className="hover:text-gray-700 dark:hover:text-gray-200 transition">
          Comptabilité
        </Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <Link href="/comptabilite/comptes-caisses" className="hover:text-gray-700 dark:hover:text-gray-200 transition">
          Comptes &amp; Caisses
        </Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <span className="text-gray-700 dark:text-gray-300 truncate max-w-[280px]">
          {detail.libelle}
        </span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <button
            type="button"
            onClick={() => router.back()}
            title="Retour"
            className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] text-gray-500 hover:text-violet-500 hover:border-violet-300 dark:hover:border-violet-500/40 transition shadow-sm"
          >
            <ArrowLeft size={16} />
          </button>
          <CaisseLogo caisse={{ code: detail.code, libelle: detail.libelle }} size="lg" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-none">
                {detail.libelle}
              </h1>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                detail.actif
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20"
                  : "bg-gray-200 dark:bg-white/[0.08] text-gray-600 dark:text-gray-400"
              }`}>
                {detail.actif ? "Actif" : "Inactif"}
              </span>
            </div>
            <div className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span className={`inline-block px-1.5 py-px rounded text-[9px] font-bold uppercase tracking-wider ${
                detail.type_cible === "caisse"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-violet-500/10 text-violet-600 dark:text-violet-400"
              }`}>
                {detail.type_cible === "caisse" ? "Caisse" : "Compte"}
              </span>
              {detail.code && (
                <span className="font-mono text-[10px] bg-gray-100 dark:bg-white/[0.05] text-gray-500 dark:text-gray-400 px-1 py-px rounded">
                  {detail.code}
                </span>
              )}
              {detail.compte_syscohada_code && (
                <span className="font-mono text-[10px] bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1.5 py-px rounded font-bold">
                  {detail.compte_syscohada_code}
                </span>
              )}
              {detail.compte_syscohada_libelle && (
                <span className="truncate max-w-[300px]">{detail.compte_syscohada_libelle}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/comptabilite/comptes-caisses/${detail.id}/modifier`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition"
          >
            <Pencil size={14} /> Modifier
          </Link>
          {/* Phase 4.x Vague 1 — Bouton Transfert interne */}
          {onTransfert && detail.actif && (
            <button
              type="button"
              onClick={onTransfert}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600 text-white text-sm font-semibold shadow-md shadow-violet-500/25 transition"
              title="Transférer des fonds vers une autre caisse / compte Boyah"
            >
              <ArrowRightLeft size={14} /> Transfert
            </button>
          )}
          <Link
            href={`/comptabilite/operations/nouveau?caisse_id=${detail.id}&type_cible=${detail.type_cible}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-sm font-semibold shadow-md shadow-emerald-500/25 transition"
          >
            <Plus size={14} /> Ajouter une op
          </Link>
        </div>
      </div>
    </div>
  )
}
