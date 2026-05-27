"use client"

/**
 * Hook wrapper pour les corrections d'anomalies (Écran 8 §4.3).
 *
 * Au lieu de créer des endpoints "fix" spécifiques, on appelle les endpoints
 * existants :
 *   - op_sans_ecriture → POST /api/compta/operations/[id]/valider
 *   - Mapping manquant → navigation vers l'écran de modification (pas géré ici)
 *
 * Le hook ne fait QUE l'appel API. La logique de navigation pour les autres
 * types reste côté composant.
 */

import { useCallback, useState } from "react"
import { authFetch } from "@/lib/authFetch"
import type { HealthAnomaly } from "@/types/compta-ui"

export type FixResult = {
  ok:        true
  message?:  string
} | {
  ok:        false
  error:     string
  code?:     string
}

export function useHealthFix() {
  const [loading, setLoading] = useState(false)

  const fix = useCallback(async (anomaly: HealthAnomaly): Promise<FixResult> => {
    if (!anomaly.fixable || !anomaly.fix_endpoint) {
      return { ok: false, error: "Cette anomalie n'a pas de correction automatique." }
    }
    setLoading(true)
    try {
      const res = await authFetch(anomaly.fix_endpoint, { method: "POST" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        return { ok: false, error: json?.error ?? `HTTP ${res.status}`, code: json?.code }
      }
      return { ok: true, message: "Correction appliquée" }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    } finally {
      setLoading(false)
    }
  }, [])

  return { fix, loading }
}
