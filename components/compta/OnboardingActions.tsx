"use client"

/**
 * Barre d'actions du wizard (Écran 9 §2.3).
 *
 * - Précédent (gauche) : caché à l'étape 1
 * - Actions secondaires (centre) : ex. "Passer" à l'étape 3
 * - Continuer (droite) : disabled si non valide
 * - Étape 4 : remplace "Continuer" par "Terminer l'onboarding" en dégradé
 */

import { ArrowLeft, ArrowRight, Check, Loader2, SkipForward } from "lucide-react"

type Props = {
  step:         1 | 2 | 3 | 4
  canContinue:  boolean
  loading?:     boolean
  onPrev:       () => void
  onNext:       () => void
  /** Pour l'étape 3 — bouton "Passer". */
  onSkip?:      () => void
  /** Pour l'étape 4 — bouton "Terminer". */
  onFinish?:    () => void
}

export function OnboardingActions({ step, canContinue, loading, onPrev, onNext, onSkip, onFinish }: Props) {
  const isFirst = step === 1
  const isLast  = step === 4

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center">
        {!isFirst && (
          <button
            type="button"
            onClick={onPrev}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition disabled:opacity-50"
          >
            <ArrowLeft size={14} /> Précédent
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {step === 3 && onSkip && (
          <button
            type="button"
            onClick={onSkip}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.04] transition disabled:opacity-50"
          >
            <SkipForward size={14} /> Passer
          </button>
        )}

        {isLast ? (
          <button
            type="button"
            onClick={onFinish}
            disabled={loading || !canContinue}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white text-sm font-semibold shadow-md shadow-emerald-500/30 transition disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Terminer l&apos;onboarding
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            disabled={loading || !canContinue}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-sm font-semibold shadow-md shadow-emerald-500/30 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {step === 1 ? "Commencer" : "Continuer"}
            <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
