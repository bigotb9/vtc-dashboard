"use client"

/**
 * Card individuelle d'un rapport (Phase 4 §3.3).
 *
 * Header avec pastille (shortCode) + nom + tag + description
 * Métadonnées (pages estimées, nb écritures, etc.)
 * Slot pour sélecteur supplémentaire (journaux, caisses)
 * Actions : Aperçu (outline) + Générer PDF (dégradé rouge→ambre)
 */

import { Eye, Download, Loader2, Clock } from "lucide-react"

type Accent = "violet" | "emerald" | "cyan" | "amber" | "red"

const ACCENT_BAR: Record<Accent, string> = {
  violet:  "from-transparent via-violet-500 to-transparent",
  emerald: "from-transparent via-emerald-500 to-transparent",
  cyan:    "from-transparent via-cyan-500 to-transparent",
  amber:   "from-transparent via-amber-500 to-transparent",
  red:     "from-transparent via-red-500 to-transparent",
}
const ACCENT_PILL: Record<Accent, string> = {
  violet:  "bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-violet-500/30",
  emerald: "bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-emerald-500/30",
  cyan:    "bg-gradient-to-br from-cyan-500 to-sky-500 text-white shadow-cyan-500/30",
  amber:   "bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-amber-500/30",
  red:     "bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-red-500/30",
}

export type MetaItem = { label: string; value: string }

type Props = {
  shortCode:   string
  accent:      Accent
  title:       string
  description: string
  tag?:        string
  metadata?:   MetaItem[]
  /** Slot pour un sélecteur (journaux, caisses, etc.). */
  extras?:     React.ReactNode
  /** "À venir" pour les rapports Vague 2 — désactive les boutons. */
  upcoming?:   boolean
  loading?:    boolean
  /** "preview" ou "generate" si une action est en cours. */
  busyAction?: "preview" | "generate" | null
  onPreview:   () => void
  onGenerate:  () => void
  /** Largeur full pour le rapport mensuel. */
  fullWidth?:  boolean
}

export function ExportsReportCard({
  shortCode, accent, title, description, tag, metadata, extras,
  upcoming, loading, busyAction,
  onPreview, onGenerate, fullWidth,
}: Props) {
  return (
    <article
      className={`relative rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-5 overflow-hidden ${fullWidth ? "lg:col-span-2" : ""}`}
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 8px 24px -8px rgba(0,0,0,0.18)" }}
    >
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${ACCENT_BAR[accent]}`} />

      <div className="flex items-start gap-3 mb-3">
        <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center shadow-md ${ACCENT_PILL[accent]}`}>
          <span className="font-black text-base tracking-tight">{shortCode}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h3>
            {tag && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider bg-violet-500/10 text-violet-600 dark:text-violet-400">
                {tag}
              </span>
            )}
            {upcoming && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Clock size={9} /> À venir
              </span>
            )}
          </div>
          <p className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">{description}</p>
        </div>
      </div>

      {metadata && metadata.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 rounded-lg bg-gray-50/60 dark:bg-white/[0.02] border border-gray-200/60 dark:border-white/[0.05] px-3 py-2">
          {metadata.map((m, i) => (
            <div key={i}>
              <p className="text-[9.5px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.08em] truncate">{m.label}</p>
              <p className="text-[12px] font-bold text-gray-900 dark:text-white tabular-nums truncate">
                {loading ? <span className="inline-block w-10 h-3 bg-gray-200 dark:bg-white/[0.06] rounded animate-pulse" /> : m.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {extras && <div className="mb-3">{extras}</div>}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onPreview}
          disabled={upcoming || !!busyAction}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busyAction === "preview" ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
          Aperçu
        </button>
        <button
          type="button"
          onClick={onGenerate}
          disabled={upcoming || !!busyAction}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-red-500 to-amber-500 hover:from-red-600 hover:to-amber-600 text-white text-sm font-semibold shadow-md shadow-amber-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {busyAction === "generate" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Générer PDF
        </button>
      </div>
    </article>
  )
}
