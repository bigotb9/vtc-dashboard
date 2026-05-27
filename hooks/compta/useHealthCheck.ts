"use client"

/**
 * Hook wrapper GET /api/compta/health (Écran 7 §7.3).
 *
 * Lance la vérification d'équilibre comptable sur demande et expose le
 * résultat normalisé pour l'affichage dans HealthCheckResultModal.
 */

import { useCallback, useState } from "react"
import { authFetch } from "@/lib/authFetch"
import type { HealthCheckResult } from "@/types/compta-ui"

type State = {
  data:    HealthCheckResult | null
  loading: boolean
  error:   string | null
}

export function useHealthCheck() {
  const [state, setState] = useState<State>({ data: null, loading: false, error: null })

  const run = useCallback(async (): Promise<HealthCheckResult | null> => {
    setState({ data: null, loading: true, error: null })
    try {
      const res  = await authFetch("/api/compta/health")
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setState({ data: null, loading: false, error: json?.error ?? `HTTP ${res.status}` })
        return null
      }
      // Le payload peut être directement à la racine ou sous data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any = json?.data ?? json
      // Préférer `anomalies_flat` (string[]) si présent, sinon mapper depuis
      // `anomalies` (objets avec .message) pour la rétrocompat.
      const anomaliesStr: string[] = Array.isArray(raw.anomalies_flat)
        ? raw.anomalies_flat
        : Array.isArray(raw.anomalies)
          ? raw.anomalies.map((a: { message?: string } | string) =>
              typeof a === "string" ? a : (a?.message ?? "Anomalie"))
          : []
      const result: HealthCheckResult = {
        ok:           !!raw.ok,
        nb_ecritures: Number(raw.nb_ecritures ?? 0),
        nb_lignes:    Number(raw.nb_lignes    ?? 0),
        total_debit:  Number(raw.total_debit  ?? 0),
        total_credit: Number(raw.total_credit ?? 0),
        anomalies:    anomaliesStr,
      }
      setState({ data: result, loading: false, error: null })
      return result
    } catch (e) {
      setState({ data: null, loading: false, error: (e as Error).message })
      return null
    }
  }, [])

  const reset = useCallback(() => setState({ data: null, loading: false, error: null }), [])

  return { ...state, run, reset }
}
