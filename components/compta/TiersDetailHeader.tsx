"use client"

/**
 * Header de la page détail tiers (Phase 4.x Vague 2 §3.4).
 * Avatar initiales + nom + meta + actions (Modifier / Désactiver / Export PDF).
 */

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Pencil, FileDown, PowerOff, Power, Loader2 } from "lucide-react"
import { TiersTypeBadge } from "@/components/compta/TiersTypeBadge"
import type { TiersDetail } from "@/types/compta-ui"

type Props = {
  detail:         TiersDetail
  onDisable?:     () => void
  /** Phase 4.x Vague 2 correctif §2.1 — réactiver un tiers désactivé. */
  onReactivate?:  () => void
  reactivating?:  boolean
  onExportPdf?:   () => void
  exportingPdf?:  boolean
}

const AVATAR_BG: Record<TiersDetail["type"], string> = {
  client:      "from-emerald-500 to-teal-600",
  fournisseur: "from-amber-500 to-orange-600",
  salarie:     "from-cyan-500 to-sky-600",
  autre:       "from-violet-500 to-fuchsia-600",
}

function initials(nom: string): string {
  const words = nom.toUpperCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "TI"
  if (words.length === 1) return words[0].slice(0, 2)
  return words[0][0] + words[1][0]
}

export function TiersDetailHeader({ detail, onDisable, onReactivate, reactivating, onExportPdf, exportingPdf }: Props) {
  const router = useRouter()
  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <Link href="/dashboard" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Accueil</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <Link href="/comptabilite" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Comptabilité</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <Link href="/comptabilite/tiers" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Tiers</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <span className="text-gray-700 dark:text-gray-300 truncate max-w-[260px]">{detail.nom}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <button
            type="button"
            onClick={() => router.back()}
            title="Retour"
            className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] text-gray-500 hover:text-indigo-500 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition shadow-sm"
          >
            <ArrowLeft size={16} />
          </button>
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${AVATAR_BG[detail.type]} flex items-center justify-center shadow-lg text-white font-black text-lg tracking-wider`}>
            {initials(detail.nom)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-none">
                {detail.nom}
              </h1>
              <TiersTypeBadge type={detail.type} size="sm" />
              {!detail.actif && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-200 dark:bg-white/[0.08] text-gray-600 dark:text-gray-400">
                  Désactivé
                </span>
              )}
            </div>
            <div className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span className="font-mono text-[11px] bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1.5 py-px rounded font-bold">
                {detail.compte_syscohada_code}
              </span>
              {detail.numero_rccm && (
                <span className="font-mono text-[10px] bg-gray-100 dark:bg-white/[0.05] text-gray-500 dark:text-gray-400 px-1 py-px rounded">
                  RCCM {detail.numero_rccm}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onExportPdf && (
            <button
              type="button"
              onClick={onExportPdf}
              disabled={exportingPdf}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-500/[0.08] text-sm font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-500/[0.14] transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {exportingPdf ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
              {exportingPdf ? "Génération…" : "Exporter PDF"}
            </button>
          )}
          {onDisable && detail.actif && (
            <button
              type="button"
              onClick={onDisable}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition"
            >
              <PowerOff size={14} /> Désactiver
            </button>
          )}
          {/* Phase 4.x Vague 2 correctif §2.1 — Réactiver un tiers désactivé */}
          {onReactivate && !detail.actif && (
            <button
              type="button"
              onClick={onReactivate}
              disabled={reactivating}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/[0.08] text-sm font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/[0.14] transition disabled:opacity-60 disabled:cursor-not-allowed"
              title="Remettre ce tiers en service"
            >
              {reactivating ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
              {reactivating ? "Réactivation…" : "Réactiver"}
            </button>
          )}
          <Link
            href={`/comptabilite/tiers/${detail.id}/modifier`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white text-sm font-semibold shadow-md shadow-indigo-500/25 transition"
          >
            <Pencil size={14} /> Modifier
          </Link>
        </div>
      </div>
    </div>
  )
}
