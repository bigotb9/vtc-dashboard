"use client"

/**
 * Hook qui fetch /api/compta/plan-comptable une fois au mount.
 * Le filtrage (classe + recherche) est délégué à la page (côté client).
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { authFetch } from "@/lib/authFetch"
import type { PlanComptablePayload } from "@/types/compta-ui"

type State = {
  data:    PlanComptablePayload | null
  loading: boolean
  error:   string | null
}

export function usePlanComptable() {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null })
  const requestIdRef = useRef(0)

  const refetch = useCallback(async () => {
    const reqId = ++requestIdRef.current
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const res  = await authFetch("/api/compta/plan-comptable")
      const json = await res.json().catch(() => ({}))
      if (reqId !== requestIdRef.current) return
      if (!res.ok) {
        setState({ data: null, loading: false, error: json?.error ?? `HTTP ${res.status}` })
        return
      }
      setState({ data: json.data as PlanComptablePayload, loading: false, error: null })
    } catch (e) {
      if (reqId !== requestIdRef.current) return
      setState({ data: null, loading: false, error: (e as Error).message })
    }
  }, [])

  useEffect(() => { refetch() }, [refetch])

  return { ...state, refetch }
}
