"use client"

/**
 * Header de l'onboarding (Écran 9 §2.1).
 * Icône rocket dégradée + texte "FLEET BOYAH — MODULE COMPTABILITÉ".
 */

import { Rocket } from "lucide-react"

export function OnboardingHeader() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/30 mb-3">
        <Rocket size={26} className="text-white" />
      </div>
      <p className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
        Fleet Boyah · Module Comptabilité
      </p>
    </div>
  )
}
