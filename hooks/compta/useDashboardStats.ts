"use client"

/**
 * Hook de fetch des stats agrégées du Dashboard comptable (Écran 3).
 *
 * Fetch unique vers GET /api/compta/dashboard/stats?date_from=&date_to=
 * Retourne les 7 sections + santé + soldes en un seul payload.
 *
 * Référence : doc Phase 3 Écran 3 §6.3.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { authFetch } from "@/lib/authFetch"
import type { DashboardStats } from "@/types/compta-ui"

export interface DashboardStatsRange {
  /** Si `all=true`, on demande l'agrégat tous-temps-confondus via ?period=all
   *  et le serveur ignore date_from/date_to. */
  all?:       boolean
  date_from?: string
  date_to?:   string
}

type State = {
  data:    DashboardStats | null
  loading: boolean
  error:   string | null
}

export function useDashboardStats(range: DashboardStatsRange, debounceMs = 200) {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null })
  const debounceRef  = useRef<NodeJS.Timeout | null>(null)
  const requestIdRef = useRef(0)

  const doFetch = useCallback(async (r: DashboardStatsRange) => {
    const reqId = ++requestIdRef.current
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const p = new URLSearchParams()
      if (r.all) {
        // Mode all-time : on n'envoie pas de dates, juste le flag.
        // Le serveur élargit à [1900-01-01, 9999-12-31] et désactive les trends.
        p.set("period", "all")
      } else {
        if (r.date_from) p.set("date_from", r.date_from)
        if (r.date_to)   p.set("date_to",   r.date_to)
      }
      const qs = p.toString()
      const res  = await authFetch(`/api/compta/dashboard/stats${qs ? "?" + qs : ""}`)
      const json = await res.json()
      if (reqId !== requestIdRef.current) return
      if (!res.ok) {
        setState({ data: null, loading: false, error: json.error ?? `HTTP ${res.status}` })
        return
      }
      setState({ data: json.data as DashboardStats, loading: false, error: null })
    } catch (e) {
      if (reqId !== requestIdRef.current) return
      setState({ data: null, loading: false, error: (e as Error).message })
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doFetch(range), debounceMs)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.all, range.date_from, range.date_to])

  const refetch = useCallback(() => doFetch(range), [doFetch, range])

  return { ...state, refetch }
}
