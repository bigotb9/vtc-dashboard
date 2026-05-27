"use client"

/**
 * Hook wrapper POST /api/compta/toggle-mode (Écran 7).
 *
 * Expose :
 *  - toggle({ nouveau_mode, confirmer, force }) → exécute le toggle
 *  - polling automatique des paramètres pendant que le toggle tourne
 *    (refetch /api/compta/parametres toutes les 5s pour suivre le mode_actif)
 *
 * Référence : doc Phase 3 Écran 7 §3.5 + §7.4.
 */

import { useCallback, useRef, useState } from "react"
import { authFetch } from "@/lib/authFetch"

export type ToggleArgs = {
  nouveau_mode: "simple" | "avance"
  /** Obligatoire pour Avancé → Simple */
  confirmer?:   boolean
  /** Active la régénération forcée des écritures (Écran 7 §7.4) */
  force?:       boolean
}

export type ToggleResult = {
  ok:           true
  ancien_mode:  string
  nouveau_mode: string
  data:         Record<string, unknown>
} | {
  ok:           false
  error:        string
  code?:        string
  details?:     unknown
}

export function useToggleMode(opts?: { onPoll?: () => void }) {
  const [loading, setLoading] = useState(false)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  const toggle = useCallback(async (args: ToggleArgs): Promise<ToggleResult> => {
    setLoading(true)
    // Démarre le polling — l'UI peut refresh les paramètres pendant ce temps
    if (opts?.onPoll) {
      pollingRef.current = setInterval(() => opts.onPoll!(), 5000)
    }
    try {
      const url = `/api/compta/toggle-mode${args.force ? "?force=true" : ""}`
      const res = await authFetch(url, {
        method: "POST",
        body:   JSON.stringify({
          nouveau_mode: args.nouveau_mode,
          confirmer:    args.confirmer ?? false,
        }),
      })
      const json = await res.json().catch(() => ({}))
      stopPolling()
      if (!res.ok) {
        return { ok: false, error: json?.error ?? `HTTP ${res.status}`, code: json?.code, details: json?.details }
      }
      const data = json?.data ?? json
      return {
        ok:           true,
        ancien_mode:  data.ancien_mode ?? "?",
        nouveau_mode: data.nouveau_mode ?? args.nouveau_mode,
        data,
      }
    } catch (e) {
      stopPolling()
      return { ok: false, error: (e as Error).message }
    } finally {
      stopPolling()
      setLoading(false)
    }
  }, [opts])

  return { toggle, loading }
}
