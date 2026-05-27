"use client"

/**
 * Étape 2 — Choix du mode (Écran 9 §3.2).
 * 2 cards radio (Simple ambre, Avancé violet) + banner recommandation vert.
 */

import { Pencil, BookOpen, Lightbulb, Check } from "lucide-react"

type Mode = "simple" | "avance"

type Props = {
  value:    Mode
  onChange: (next: Mode) => void
}

const SIMPLE_FEATURES   = ["Saisie rapide", "Pas de partie double", "Bascule possible plus tard"]
const AVANCE_FEATURES   = ["Partie double", "Plan comptable SYSCOHADA", "Prêt pour audit"]

export function OnboardingStep2Mode({ value, onChange }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-black tracking-tight text-gray-900 dark:text-white">
          Quel mode souhaitez-vous ?
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 leading-snug">
          Vous pourrez changer ce choix ultérieurement depuis les Paramètres.
        </p>
      </div>

      <div className="space-y-3">
        {/* Simple */}
        <ModeCard
          active={value === "simple"}
          accent="amber"
          Icon={Pencil}
          title="Mode Simple"
          desc="Suivi des entrées et sorties uniquement. Pas d'écriture comptable générée automatiquement. Idéal pour démarrer rapidement."
          features={SIMPLE_FEATURES}
          onClick={() => onChange("simple")}
        />
        {/* Avancé */}
        <ModeCard
          active={value === "avance"}
          accent="violet"
          Icon={BookOpen}
          title="Mode Avancé"
          desc="Écriture SYSCOHADA générée à chaque opération validée. Partie double, balance, journaux. Conformité comptable totale."
          features={AVANCE_FEATURES}
          onClick={() => onChange("avance")}
        />
      </div>

      <div className="rounded-xl bg-emerald-500/5 dark:bg-emerald-500/[0.08] border border-emerald-500/20 px-3 py-2.5 flex items-start gap-2">
        <Lightbulb size={14} className="text-emerald-500 flex-shrink-0 mt-0.5" />
        <p className="text-[11.5px] text-emerald-700 dark:text-emerald-300 leading-snug">
          <strong>Recommandé : Mode Avancé.</strong> Vous bénéficiez de la conformité SYSCOHADA dès
          le départ et évitez une régénération rétroactive des écritures plus tard.
        </p>
      </div>
    </div>
  )
}

function ModeCard({
  active, accent, Icon, title, desc, features, onClick,
}: {
  active:   boolean
  accent:   "amber" | "violet"
  Icon:     React.ElementType
  title:    string
  desc:     string
  features: string[]
  onClick:  () => void
}) {
  const accentBorder = active
    ? accent === "amber"
      ? "border-amber-500/40 ring-2 ring-amber-500/30 bg-amber-500/[0.06] dark:bg-amber-500/[0.10]"
      : "border-violet-500/40 ring-2 ring-violet-500/30 bg-violet-500/[0.06] dark:bg-violet-500/[0.10]"
    : "border-gray-200/70 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:border-gray-300 dark:hover:border-white/[0.12]"

  const iconCls = active
    ? accent === "amber"
      ? "bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-amber-500/40"
      : "bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-violet-500/40"
    : accent === "amber"
      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
      : "bg-violet-500/10 text-violet-600 dark:text-violet-400"

  const titleCls = active
    ? accent === "amber"
      ? "text-amber-700 dark:text-amber-300"
      : "text-violet-700 dark:text-violet-300"
    : "text-gray-900 dark:text-white"

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl border p-4 transition relative ${accentBorder}`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${iconCls}`}>
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-black tracking-tight ${titleCls}`}>{title}</p>
            {active && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20">
                <Check size={9} strokeWidth={3} />
                Choisi
              </span>
            )}
          </div>
          <p className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">{desc}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {features.map(f => (
              <span key={f} className={`inline-block px-1.5 py-0.5 rounded text-[9.5px] font-semibold ${
                active
                  ? accent === "amber"
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    : "bg-violet-500/15 text-violet-700 dark:text-violet-300"
                  : "bg-gray-100 dark:bg-white/[0.05] text-gray-500 dark:text-gray-400"
              }`}>
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>
    </button>
  )
}
