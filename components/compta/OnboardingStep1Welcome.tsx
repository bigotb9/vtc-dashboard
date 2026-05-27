"use client"

/**
 * Étape 1 — Welcome (Écran 9 §3.1).
 * Titre + sous-titre + 4 feature items en stack vertical.
 */

import { ListChecks, BookOpen, BarChart3, ShieldCheck } from "lucide-react"

const FEATURES = [
  {
    Icon:  ListChecks,
    accent: "emerald" as const,
    title:  "Suivi des opérations",
    desc:   "Entrées, sorties, transferts. Saisie manuelle ou automatique depuis les recettes Wave, les dépenses véhicules et les versements clients.",
  },
  {
    Icon:  BookOpen,
    accent: "violet" as const,
    title:  "Conformité SYSCOHADA",
    desc:   "Génération automatique des écritures comptables en partie double avec mapping vers le plan SYSCOHADA officiel.",
  },
  {
    Icon:  BarChart3,
    accent: "cyan" as const,
    title:  "Dashboard temps réel",
    desc:   "CA, dépenses, soldes de caisses et comptes bancaires. Graphiques d'évolution mensuelle et top véhicules.",
  },
  {
    Icon:  ShieldCheck,
    accent: "amber" as const,
    title:  "Audit comptable",
    desc:   "Vérifie l'équilibre Σ(débit)=Σ(crédit), détecte les anomalies, propose des corrections automatiques.",
  },
]

const ACCENT_ICON: Record<"emerald" | "violet" | "cyan" | "amber", string> = {
  emerald: "from-emerald-500 to-teal-500 text-white shadow-emerald-500/30",
  violet:  "from-violet-500 to-indigo-500 text-white shadow-violet-500/30",
  cyan:    "from-cyan-500 to-sky-500 text-white shadow-cyan-500/30",
  amber:   "from-amber-500 to-orange-500 text-white shadow-amber-500/30",
}

export function OnboardingStep1Welcome() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-black tracking-tight text-gray-900 dark:text-white">
          Bienvenue dans Fleet Boyah
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 leading-snug">
          Avant de commencer, configurons ensemble votre module comptable en quelques minutes.
        </p>
      </div>

      <ul className="space-y-3">
        {FEATURES.map((f, i) => (
          <li key={i} className="flex items-start gap-3 rounded-xl border border-gray-200/70 dark:border-white/[0.05] bg-gray-50/50 dark:bg-white/[0.02] px-3 py-2.5">
            <div className={`flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-md ${ACCENT_ICON[f.accent]}`}>
              <f.Icon size={16} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-gray-900 dark:text-white">{f.title}</p>
              <p className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{f.desc}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
