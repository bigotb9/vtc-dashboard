"use client"

/**
 * Hook GET /api/compta/tiers/[id] — détail enrichi (Phase 4.x Vague 2).
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { authFetch } from "@/lib/authFetch"
import type { TiersDetail } from "@/types/compta-ui"

type State = {
  data:     TiersDetail | null
  loading:  boolean
  error:    string | null
  notFound: boolean
}

export function useTiersDetail(id: string | null) {
  const [state, setState] = useState<State>({ data: null, loading: !!id, error: null, notFound: false })
  const reqIdRef = useRef(0)

  const doFetch = useCallback(async (tiersId: string) => {
    const reqId = ++reqIdRef.current
    setState(s => ({ ...s, loading: true, error: null, notFound: false }))
    try {
      const res  = await authFetch(`/api/compta/tiers/${tiersId}`)
      const json = await res.json().catch(() => ({}))
      if (reqId !== reqIdRef.current) return
      if (res.status === 404) {
        setState({ data: null, loading: false, error: null, notFound: true })
        return
      }
      if (!res.ok) {
        setState({ data: null, loading: false, error: json?.error ?? `HTTP ${res.status}`, notFound: false })
        return
      }
      setState({ data: json.data as TiersDetail, loading: false, error: null, notFound: false })
    } catch (e) {
      if (reqId !== reqIdRef.current) return
      setState({ data: null, loading: false, error: (e as Error).message, notFound: false })
    }
  }, [])

  useEffect(() => {
    if (id) doFetch(id)
    else    setState({ data: null, loading: false, error: null, notFound: false })
  }, [id, doFetch])

  const refetch = useCallback(() => { if (id) doFetch(id) }, [id, doFetch])
  return { ...state, refetch }
}
