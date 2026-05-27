"use client"

/**
 * Hook GET /api/compta/tiers/[id]/operations — historique (Phase 4.x Vague 2).
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { authFetch } from "@/lib/authFetch"
import type { TiersOperationsResponse } from "@/types/compta-ui"

type Filters = {
  date_from?: string
  date_to?:   string
  page?:      number
  page_size?: number
}

type State = {
  data:    TiersOperationsResponse | null
  loading: boolean
  error:   string | null
}

export function useTiersOperations(tiersId: string | null, filters: Filters = {}) {
  const [state, setState] = useState<State>({ data: null, loading: !!tiersId, error: null })
  const reqIdRef = useRef(0)

  const doFetch = useCallback(async (id: string, f: Filters) => {
    const reqId = ++reqIdRef.current
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const p = new URLSearchParams()
      if (f.date_from) p.set("date_from", f.date_from)
      if (f.date_to)   p.set("date_to",   f.date_to)
      if (f.page)      p.set("page",      String(f.page))
      if (f.page_size) p.set("page_size", String(f.page_size))
      const res  = await authFetch(`/api/compta/tiers/${id}/operations?${p.toString()}`)
      const json = await res.json().catch(() => ({}))
      if (reqId !== reqIdRef.current) return
      if (!res.ok) {
        setState({ data: null, loading: false, error: json?.error ?? `HTTP ${res.status}` })
        return
      }
      setState({ data: json.data as TiersOperationsResponse, loading: false, error: null })
    } catch (e) {
      if (reqId !== reqIdRef.current) return
      setState({ data: null, loading: false, error: (e as Error).message })
    }
  }, [])

  useEffect(() => {
    if (tiersId) doFetch(tiersId, filters)
    else         setState({ data: null, loading: false, error: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiersId, JSON.stringify(filters), doFetch])

  const refetch = useCallback(() => { if (tiersId) doFetch(tiersId, filters) }, [tiersId, filters, doFetch])
  return { ...state, refetch }
}
