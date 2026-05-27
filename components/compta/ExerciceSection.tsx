"use client"

/**
 * Section 2 — Exercice comptable (Écran 7 §4).
 * Lecture seule pour le MVP.
 */

import { Calendar } from "lucide-react"
import type { ParametresPayload } from "@/types/compta-ui"

const fmtDate = (s: string) => {
  const d = new Date(s + "T00:00:00")
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : s
}

type Props = {
  data:    ParametresPayload | null
  loading?: boolean
}

export function ExerciceSection({ data, loading }: Props) {
  const ex = data?.exercice_courant

  return (
    <section id="exercice" className="relative rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-5 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />

      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/30 flex-shrink-0">
          <Calendar size={16} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Exercice comptable</h2>
          <p className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
            Période sur laquelle portent les écritures et le bilan annuel.
          </p>
        </div>
      </div>

      {loading || !ex ? (
        <div className="h-24 rounded-xl animate-pulse bg-gray-100 dark:bg-white/[0.04]" />
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <Row label="Exercice courant">
            <span className="font-semibold text-gray-900 dark:text-white">{ex.libelle}</span>
          </Row>
          <Row label="Statut">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
              ex.statut === "ouvert"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20"
                : "bg-gray-200 dark:bg-white/[0.08] text-gray-600 dark:text-gray-400"
            }`}>
              {ex.statut === "ouvert" ? "Ouvert" : "Clôturé"}
            </span>
          </Row>
          <Row label="Date de début">
            <span className="font-mono tabular-nums">{fmtDate(ex.date_debut)}</span>
          </Row>
          <Row label="Date de fin">
            <span className="font-mono tabular-nums">{fmtDate(ex.date_fin)}</span>
          </Row>
        </div>
      )}
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9.5px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em] mb-1">{label}</p>
      <div className="text-[13px] text-gray-900 dark:text-white">{children}</div>
    </div>
  )
}
