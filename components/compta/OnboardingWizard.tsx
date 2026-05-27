"use client"

/**
 * Container du wizard d'onboarding (Écran 9).
 * Gère le state (currentStep, mode, société, skipped) et orchestre les
 * 4 étapes + la soumission finale.
 */

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { authFetch } from "@/lib/authFetch"
import { toast } from "@/lib/toast"
import { OnboardingHeader } from "@/components/compta/OnboardingHeader"
import { OnboardingStepper } from "@/components/compta/OnboardingStepper"
import { OnboardingActions } from "@/components/compta/OnboardingActions"
import { OnboardingStep1Welcome } from "@/components/compta/OnboardingStep1Welcome"
import { OnboardingStep2Mode } from "@/components/compta/OnboardingStep2Mode"
import { OnboardingStep3Societe, type SocieteWizardForm } from "@/components/compta/OnboardingStep3Societe"
import { OnboardingStep4Recap } from "@/components/compta/OnboardingStep4Recap"
import { FullscreenLoader } from "@/components/compta/FullscreenLoader"
import { useOnboarding } from "@/hooks/compta/useOnboarding"
import type { ExerciceCourant } from "@/types/compta-ui"

type Step = 1 | 2 | 3 | 4
type Mode = "simple" | "avance"

const STEP_LABELS: Record<Step, string> = {
  1: "Étape 1 — Bienvenue",
  2: "Étape 2 — Choix du mode",
  3: "Étape 3 — Informations société",
  4: "Étape 4 — Récapitulatif",
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

const EMPTY_SOCIETE: SocieteWizardForm = {
  raison_sociale:  "",
  telephone:       "",
  email_comptable: "",
}

export function OnboardingWizard() {
  const router = useRouter()
  const { submit, loading: submitting } = useOnboarding()

  const [step,           setStep]           = useState<Step>(1)
  const [mode,           setMode]           = useState<Mode>("avance") // pré-sélection recommandée
  const [societe,        setSociete]        = useState<SocieteWizardForm>(EMPTY_SOCIETE)
  const [societeSkipped, setSocieteSkipped] = useState(false)
  const [emailError,     setEmailError]     = useState<string | null>(null)

  // Exercice (pour le récap)
  const [exercice, setExercice] = useState<ExerciceCourant | null>(null)

  // Pré-remplissage société + exercice depuis GET /parametres
  useEffect(() => {
    let cancelled = false
    authFetch("/api/compta/parametres")
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (cancelled) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = j?.data ?? null
        if (data?.societe) {
          setSociete({
            raison_sociale:  data.societe.raison_sociale  ?? "",
            telephone:       data.societe.telephone       ?? "",
            email_comptable: data.societe.email_comptable ?? "",
          })
        }
        if (data?.exercice_courant) {
          setExercice(data.exercice_courant as ExerciceCourant)
        }
        if (data?.mode_actif === "simple" || data?.mode_actif === "avance") {
          setMode(data.mode_actif)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Validation email à chaque saisie (étape 3)
  useEffect(() => {
    if (!societe.email_comptable.trim()) { setEmailError(null); return }
    setEmailError(EMAIL_RE.test(societe.email_comptable.trim()) ? null : "Format email invalide")
  }, [societe.email_comptable])

  // Peut continuer ?
  const canContinue = useMemo(() => {
    if (step === 1) return true
    if (step === 2) return mode === "simple" || mode === "avance"
    if (step === 3) return emailError === null   // pas d'erreur format si email saisi
    if (step === 4) return true
    return false
  }, [step, mode, emailError])

  function handleNext() {
    if (step < 4) {
      setStep(((step + 1) as Step))
      if (step + 1 === 3) {
        // Quand on entre à l'étape 3, on annule un éventuel "skipped" précédent
        setSocieteSkipped(false)
      }
    }
  }

  function handlePrev() {
    if (step > 1) setStep(((step - 1) as Step))
  }

  function handleSkipSociete() {
    setSocieteSkipped(true)
    setStep(4)
  }

  async function handleFinish() {
    const res = await submit({
      mode_actif: mode,
      societe: societeSkipped ? {} : {
        raison_sociale:  societe.raison_sociale.trim()  || null,
        telephone:       societe.telephone.trim()       || null,
        email_comptable: societe.email_comptable.trim() || null,
      },
      societe_skipped: societeSkipped,
    })
    if (res.ok) {
      toast.success("Onboarding terminé · bienvenue dans Fleet Boyah !")
      router.replace("/comptabilite")
    } else {
      toast.error(res.error || "Échec de la finalisation")
    }
  }

  if (submitting) {
    return <FullscreenLoader text="Finalisation de l'onboarding…" />
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-start justify-center px-4 py-8">
      <div className="w-full max-w-2xl space-y-6">
        <OnboardingHeader />
        <OnboardingStepper current={step} label={STEP_LABELS[step]} />

        <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-6 shadow-lg shadow-black/5">
          {step === 1 && <OnboardingStep1Welcome />}
          {step === 2 && <OnboardingStep2Mode value={mode} onChange={setMode} />}
          {step === 3 && (
            <OnboardingStep3Societe
              value={societe}
              onChange={setSociete}
              emailError={emailError}
            />
          )}
          {step === 4 && exercice && (
            <OnboardingStep4Recap
              mode={mode}
              societe={societe}
              societeSkipped={societeSkipped}
              exerciceLibelle={exercice.libelle}
              exerciceDateDebut={exercice.date_debut}
              exerciceDateFin={exercice.date_fin}
              exerciceStatut={exercice.statut}
              onModifyMode={() => setStep(2)}
              onModifySociete={() => { setSocieteSkipped(false); setStep(3) }}
            />
          )}
          {step === 4 && !exercice && (
            <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
              Chargement de l&apos;exercice…
            </div>
          )}
        </div>

        <OnboardingActions
          step={step}
          canContinue={canContinue}
          loading={submitting}
          onPrev={handlePrev}
          onNext={handleNext}
          onSkip={step === 3 ? handleSkipSociete : undefined}
          onFinish={step === 4 ? handleFinish : undefined}
        />
      </div>
    </div>
  )
}
