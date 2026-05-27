"use client"

/**
 * Hook qui fetch GET /api/compta/exports/metadata?date_from=&date_to=
 * (Phase 4 — page Exports).
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { authFetch } from "@/lib/authFetch"
import type { ExportsMetadata } from "@/types/compta-ui"

type State = {
  data:    ExportsMetadata | null
  loading: boolean
  error:   string | null
}

export function useExportsMetadata(dateFrom: string, dateTo: string, debounceMs = 200) {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null })
  const requestIdRef = useRef(0)
  const tRef = useRef<NodeJS.Timeout | null>(null)

  const doFetch = useCallback(async (df: string, dt: string) => {
    const reqId = ++requestIdRef.current
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const p = new URLSearchParams({ date_from: df, date_to: dt })
      const res  = await authFetch(`/api/compta/exports/metadata?${p.toString()}`)
      const json = await res.json().catch(() => ({}))
      if (reqId !== requestIdRef.current) return
      if (!res.ok) {
        setState({ data: null, loading: false, error: json?.error ?? `HTTP ${res.status}` })
        return
      }
      setState({ data: json.data as ExportsMetadata, loading: false, error: null })
    } catch (e) {
      if (reqId !== requestIdRef.current) return
      setState({ data: null, loading: false, error: (e as Error).message })
    }
  }, [])

  useEffect(() => {
    if (tRef.current) clearTimeout(tRef.current)
    tRef.current = setTimeout(() => doFetch(dateFrom, dateTo), debounceMs)
    return () => { if (tRef.current) clearTimeout(tRef.current) }
  }, [dateFrom, dateTo, debounceMs, doFetch])

  const refetch = useCallback(() => doFetch(dateFrom, dateTo), [doFetch, dateFrom, dateTo])

  return { ...state, refetch }
}
