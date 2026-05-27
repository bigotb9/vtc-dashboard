"use client"

/**
 * Hook wrapper POST /api/compta/onboarding/complete (Écran 9).
 *
 * Soumet le payload final du wizard (mode + société + skipped flag) et
 * retourne le résultat normalisé. L'appelant gère la redirection.
 */

import { useCallback, useState } from "react"
import { authFetch } from "@/lib/authFetch"

export interface OnboardingSubmitInput {
  mode_actif: "simple" | "avance"
  societe: {
    raison_sociale?:  string | null
    telephone?:       string | null
    email_comptable?: string | null
  }
  societe_skipped: boolean
}

export type OnboardingSubmitResult = {
  ok:                     true
  mode_actif:             "simple" | "avance"
  premier_login_effectue: boolean
} | {
  ok:       false
  error:    string
  code?:    string
  details?: unknown
}

export function useOnboarding() {
  const [loading, setLoading] = useState(false)

  const submit = useCallback(async (input: OnboardingSubmitInput): Promise<OnboardingSubmitResult> => {
    setLoading(true)
    try {
      const res = await authFetch("/api/compta/onboarding/complete", {
        method: "POST",
        body:   JSON.stringify(input),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        return { ok: false, error: json?.error ?? `HTTP ${res.status}`, code: json?.code, details: json?.details }
      }
      const d = json?.data ?? json
      return {
        ok:                     true,
        mode_actif:             d.mode_actif,
        premier_login_effectue: !!d.premier_login_effectue,
      }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    } finally {
      setLoading(false)
    }
  }, [])

  return { submit, loading }
}
