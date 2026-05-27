"use client"

/**
 * Hook qui fetch /api/compta/plan-comptable/[code] pour la modal de détail.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { authFetch } from "@/lib/authFetch"
import type { PlanCompteDetail } from "@/types/compta-ui"

type State = {
  data:    PlanCompteDetail | null
  loading: boolean
  error:   string | null
}

export function usePlanCompteDetail(code: string | null) {
  const [state, setState] = useState<State>({ data: null, loading: !!code, error: null })
  const requestIdRef = useRef(0)

  const refetch = useCallback(async () => {
    if (!code) { setState({ data: null, loading: false, error: null }); return }
    const reqId = ++requestIdRef.current
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const res  = await authFetch(`/api/compta/plan-comptable/${encodeURIComponent(code)}`)
      const json = await res.json().catch(() => ({}))
      if (reqId !== requestIdRef.current) return
      if (!res.ok) {
        setState({ data: null, loading: false, error: json?.error ?? `HTTP ${res.status}` })
        return
      }
      setState({ data: json.data as PlanCompteDetail, loading: false, error: null })
    } catch (e) {
      if (reqId !== requestIdRef.current) return
      setState({ data: null, loading: false, error: (e as Error).message })
    }
  }, [code])

  useEffect(() => { refetch() }, [refetch])

  return { ...state, refetch }
}
