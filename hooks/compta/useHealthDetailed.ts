"use client"

/**
 * Hook qui fetch GET /api/compta/health?detailed=true (Écran 8).
 *
 * Expose :
 *  - data : HealthDetailed enrichi
 *  - loading, error
 *  - refetch() : relance la vérification
 *
 * Référence : doc Phase 3 Écran 8 §4.1.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { authFetch } from "@/lib/authFetch"
import type { HealthDetailed } from "@/types/compta-ui"

type State = {
  data:    HealthDetailed | null
  loading: boolean
  error:   string | null
}

export function useHealthDetailed(opts: { autoFetch?: boolean } = {}) {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null })
  const requestIdRef = useRef(0)

  const refetch = useCallback(async () => {
    const reqId = ++requestIdRef.current
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const res  = await authFetch("/api/compta/health?detailed=true")
      const json = await res.json().catch(() => ({}))
      if (reqId !== requestIdRef.current) return
      if (!res.ok) {
        setState({ data: null, loading: false, error: json?.error ?? `HTTP ${res.status}` })
        return
      }
      setState({ data: json.data as HealthDetailed, loading: false, error: null })
    } catch (e) {
      if (reqId !== requestIdRef.current) return
      setState({ data: null, loading: false, error: (e as Error).message })
    }
  }, [])

  useEffect(() => { if (opts.autoFetch !== false) refetch() }, [refetch, opts.autoFetch])

  return { ...state, refetch }
}
