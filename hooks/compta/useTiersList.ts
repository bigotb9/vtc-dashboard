"use client"

/**
 * Hook GET /api/compta/tiers — liste paginée + KPIs (Phase 4.x Vague 2).
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { authFetch } from "@/lib/authFetch"
import type { TiersListResponse, TiersFilters } from "@/types/compta-ui"

type State = {
  data:    TiersListResponse | null
  loading: boolean
  error:   string | null
}

export function useTiersList(filters: TiersFilters) {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null })
  const reqIdRef = useRef(0)

  const doFetch = useCallback(async (f: TiersFilters) => {
    const reqId = ++reqIdRef.current
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const p = new URLSearchParams()
      if (f.type && f.type !== "tout")      p.set("type",        f.type)
      if (f.q)                              p.set("q",           f.q)
      if (f.actifs_only === false)          p.set("actifs_only", "false")
      if (f.page)                           p.set("page",        String(f.page))
      if (f.page_size)                      p.set("page_size",   String(f.page_size))
      const res  = await authFetch(`/api/compta/tiers?${p.toString()}`)
      const json = await res.json().catch(() => ({}))
      if (reqId !== reqIdRef.current) return
      if (!res.ok) {
        setState({ data: null, loading: false, error: json?.error ?? `HTTP ${res.status}` })
        return
      }
      setState({ data: json.data as TiersListResponse, loading: false, error: null })
    } catch (e) {
      if (reqId !== reqIdRef.current) return
      setState({ data: null, loading: false, error: (e as Error).message })
    }
  }, [])

  useEffect(() => {
    doFetch(filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters), doFetch])

  const refetch = useCallback(() => doFetch(filters), [doFetch, filters])
  return { ...state, refetch }
}
