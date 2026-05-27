"use client"

/**
 * Étape 4 — Récapitulatif (Écran 9 §3.4).
 * 3 recap items (Mode, Société, Exercice) avec boutons "Modifier" sur les
 * deux premiers. Banner info en bas.
 */

import { BookOpen, Building2, Calendar, Info, Pencil } from "lucide-react"
import type { SocieteWizardForm } from "@/components/compta/OnboardingStep3Societe"

type Mode = "simple" | "avance"

type Props = {
  mode:            Mode
  societe:         SocieteWizardForm
  societeSkipped:  boolean
  /** Libellé de l'exercice courant pour affichage. */
  exerciceLibelle:    string
  exerciceDateDebut:  string
  exerciceDateFin:    string
  exerciceStatut:     "ouvert" | "cloture"
  onModifyMode:    () => void
  onModifySociete: () => void
}

const fmtDate = (s: string) => {
  const d = new Date(s.length === 10 ? s + "T00:00:00" : s)
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : s
}

export function OnboardingStep4Recap({
  mode, societe, societeSkipped,
  exerciceLibelle, exerciceDateDebut, exerciceDateFin, exerciceStatut,
  onModifyMode, onModifySociete,
}: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-black tracking-tight text-gray-900 dark:text-white">
          Tout est prêt !
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 leading-snug">
          Vérifiez vos choix avant de finaliser l&apos;onboarding.
        </p>
      </div>

      <div className="space-y-2.5">
        {/* Mode */}
        <RecapItem
          accent="violet"
          Icon={BookOpen}
          label="Mode de fonctionnement"
          value={
            mode === "avance"
              ? "Mode Avancé · Écriture SYSCOHADA générée automatiquement"
              : "Mode Simple · Suivi entrées/sorties uniquement"
          }
          onModify={onModifyMode}
        />

        {/* Société */}
        <RecapItem
          accent="emerald"
          Icon={Building2}
          label="Société"
          value={
            societeSkipped
              ? "Non renseignée (à compléter depuis les Paramètres)"
              : formatSociete(societe)
          }
          muted={societeSkipped}
          onModify={onModifySociete}
        />

        {/* Exercice (lecture seule) */}
        <RecapItem
          accent="amber"
          Icon={Calendar}
          label="Exercice comptable"
          value={`${exerciceLibelle} · du ${fmtDate(exerciceDateDebut)} au ${fmtDate(exerciceDateFin)} · ${exerciceStatut === "ouvert" ? "Ouvert" : "Clôturé"}`}
        />
      </div>

      <div className="rounded-xl bg-cyan-500/5 dark:bg-cyan-500/[0.08] border border-cyan-500/20 px-3 py-2.5 flex items-start gap-2">
        <Info size={14} className="text-cyan-500 flex-shrink-0 mt-0.5" />
        <p className="text-[11.5px] text-cyan-700 dark:text-cyan-300 leading-snug">
          Une fois l&apos;onboarding terminé, vous accéderez directement au Dashboard. Vous pourrez
          ajuster tous les paramètres à tout moment.
        </p>
      </div>
    </div>
  )
}

function formatSociete(s: SocieteWizardForm): string {
  const parts: string[] = []
  if (s.raison_sociale.trim())  parts.push(s.raison_sociale.trim())
  if (s.telephone.trim())       parts.push(s.telephone.trim())
  if (s.email_comptable.trim()) parts.push(s.email_comptable.trim())
  return parts.length > 0 ? parts.join(" · ") : "Aucune donnée renseignée"
}

type Accent = "violet" | "emerald" | "amber"

const ACCENT_ICON: Record<Accent, string> = {
  violet:  "from-violet-500 to-indigo-500 text-white shadow-violet-500/30",
  emerald: "from-emerald-500 to-teal-500 text-white shadow-emerald-500/30",
  amber:   "from-amber-500 to-orange-500 text-white shadow-amber-500/30",
}
const ACCENT_BAR: Record<Accent, string> = {
  violet:  "from-transparent via-violet-500 to-transparent",
  emerald: "from-transparent via-emerald-500 to-transparent",
  amber:   "from-transparent via-amber-500 to-transparent",
}

function RecapItem({
  accent, Icon, label, value, muted, onModify,
}: {
  accent:   Accent
  Icon:     React.ElementType
  label:    string
  value:    string
  muted?:   boolean
  onModify?: () => void
}) {
  return (
    <div className="relative rounded-xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-3 overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${ACCENT_BAR[accent]}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-md ${ACCENT_ICON[accent]}`}>
            <Icon size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[10.5px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em]">{label}</p>
            <p className={`text-[12.5px] mt-0.5 ${muted ? "italic text-gray-400 dark:text-gray-500" : "font-semibold text-gray-900 dark:text-white"}`}>
              {value}
            </p>
          </div>
        </div>
        {onModify && (
          <button
            type="button"
            onClick={onModify}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-semibold text-gray-500 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-500/10 transition flex-shrink-0"
          >
            <Pencil size={11} />
            Modifier
          </button>
        )}
      </div>
    </div>
  )
}
