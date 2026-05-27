"use client"

/**
 * Loader plein écran avec spinner + texte (Écran 9 §4.4).
 * Utilisé par le layout pendant la vérification du flag d'onboarding et
 * par le wizard pendant la finalisation (POST /complete).
 */

import { Loader2 } from "lucide-react"

type Props = {
  text?: string
}

export function FullscreenLoader({ text = "Chargement…" }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-white/85 dark:bg-[#0a0a0a]/85 backdrop-blur-sm">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
        <Loader2 size={22} className="text-white animate-spin" />
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300 font-semibold">{text}</p>
    </div>
  )
}
