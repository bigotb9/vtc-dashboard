"use client"

/**
 * Hook GET/PATCH des paramètres du module compta (Écran 7).
 *
 * - data : ParametresPayload enrichi (paramètres + société + exercice + stats)
 * - patch(partial) : PATCH /api/compta/parametres avec update partiel
 * - refetch() : recharge sans patch
 * - loading / patching / error
 *
 * Référence : doc Phase 3 Écran 7 §8.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { authFetch } from "@/lib/authFetch"
import type { ParametresPayload } from "@/types/compta-ui"

type State = {
  data:     ParametresPayload | null
  loading:  boolean
  patching: boolean
  error:    string | null
}

export function useParametres() {
  const [state, setState] = useState<State>({ data: null, loading: true, patching: false, error: null })
  const requestIdRef = useRef(0)

  const refetch = useCallback(async () => {
    const reqId = ++requestIdRef.current
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const res  = await authFetch("/api/compta/parametres")
      const json = await res.json().catch(() => ({}))
      if (reqId !== requestIdRef.current) return
      if (!res.ok) {
        setState(s => ({ ...s, data: null, loading: false, error: json?.error ?? `HTTP ${res.status}` }))
        return
      }
      setState(s => ({ ...s, data: json.data as ParametresPayload, loading: false, error: null }))
    } catch (e) {
      if (reqId !== requestIdRef.current) return
      setState(s => ({ ...s, data: null, loading: false, error: (e as Error).message }))
    }
  }, [])

  useEffect(() => { refetch() }, [refetch])

  const patch = useCallback(async (update: Record<string, unknown>): Promise<{ ok: true } | { ok: false; error: string }> => {
    setState(s => ({ ...s, patching: true }))
    try {
      const res  = await authFetch("/api/compta/parametres", {
        method: "PATCH",
        body:   JSON.stringify(update),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setState(s => ({ ...s, patching: false, error: json?.error ?? `HTTP ${res.status}` }))
        return { ok: false, error: json?.error ?? `HTTP ${res.status}` }
      }
      // Refetch pour récupérer l'enrichissement (libellés, stats, etc.)
      await refetch()
      setState(s => ({ ...s, patching: false }))
      return { ok: true }
    } catch (e) {
      const msg = (e as Error).message
      setState(s => ({ ...s, patching: false, error: msg }))
      return { ok: false, error: msg }
    }
  }, [refetch])

  return { ...state, refetch, patch }
}
