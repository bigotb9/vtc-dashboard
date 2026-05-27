"use client"

/**
 * /comptabilite/onboarding — Écran 9 Phase 3.
 *
 * Page d'onboarding affichée au premier login (flag
 * `parametres_module_compta.premier_login_effectue = false`). Le layout
 * /comptabilite redirige automatiquement vers cette page si nécessaire et
 * vice-versa (anti-boucle).
 */

export const dynamic = "force-dynamic"

import { OnboardingWizard } from "@/components/compta/OnboardingWizard"

export default function OnboardingPage() {
  return <OnboardingWizard />
}
