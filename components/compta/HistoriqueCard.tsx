"use client"

/**
 * Card "Historique" — Écran 2 Phase 3 §3.4.
 *
 * Timeline verticale des évènements (création / validation / écriture
 * générée / annulation / extourne). La timeline est triée chronologiquement
 * croissant côté API.
 */

import { Clock } from "lucide-react"
import type { HistoryItem } from "@/types/compta-ui"

const fmtDateTime = (s: string) => {
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString("fr-FR", {
    day:   "2-digit",
    month: "2-digit",
    year:  "numeric",
  }) + " · " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

const DOT_CLASSES: Record<HistoryItem["variant"], string> = {
  success: "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]",
  warning: "bg-amber-500   shadow-[0_0_0_3px_rgba(245,158,11,0.18)]",
  danger:  "bg-red-500     shadow-[0_0_0_3px_rgba(239,68,68,0.18)]",
  default: "bg-violet-500  shadow-[0_0_0_3px_rgba(139,92,246,0.18)]",
}

type Props = { historique: HistoryItem[] }

export function HistoriqueCard({ historique }: Props) {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] shadow-sm">
      {/* Liseré ambre */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent" />

      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100 dark:border-white/[0.04]">
        <span className="inline-flex w-8 h-8 rounded-lg items-center justify-center bg-amber-500/10 text-amber-500">
          <Clock size={16} strokeWidth={2.5} />
        </span>
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-tight">
          Historique
        </h3>
        <span className="text-[11px] text-gray-500 dark:text-gray-500 ml-1">
          {historique.length} évènement{historique.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="p-5">
        {historique.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            Aucun évènement enregistré.
          </p>
        ) : (
          <ol className="relative ml-3">
            {/* Ligne verticale */}
            <span className="absolute left-1.5 top-1 bottom-1 w-px bg-gray-200 dark:bg-white/[0.08]" />

            {historique.map((item, idx) => (
              <li key={`${item.timestamp}-${idx}`} className="relative pl-7 pb-5 last:pb-0">
                <span
                  className={`absolute left-0 top-1 w-3 h-3 rounded-full ${DOT_CLASSES[item.variant] ?? DOT_CLASSES.default}`}
                />
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                  {item.title}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-500 mt-0.5 tabular-nums">
                  {fmtDateTime(item.timestamp)}
                </p>
                {item.detail && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{item.detail}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
