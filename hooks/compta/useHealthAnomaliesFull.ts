"use client"

/**
 * Hook qui charge TOUTES les anomalies d'une section (Écran 8 §4.2).
 * Utilisé par la page /comptabilite/health/[section].
 */

import { useCallback, useEffect, useState } from "react"
import { authFetch } from "@/lib/authFetch"
import type { HealthAnomaly, HealthSectionKey } from "@/types/compta-ui"

type State = {
  section:    HealthSectionKey
  anomalies:  HealthAnomaly[]
  total:      number
  loading:    boolean
  error:      string | null
}

export function useHealthAnomaliesFull(section: HealthSectionKey | null, limit = 100) {
  const [state, setState] = useState<State>({
    section: (section ?? "equilibre"),
    anomalies: [], total: 0, loading: true, error: null,
  })

  const refetch = useCallback(async () => {
    if (!section) { setState(s => ({ ...s, loading: false })); return }
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const res  = await authFetch(`/api/compta/health/anomalies?section=${section}&limit=${limit}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setState(s => ({ ...s, loading: false, error: json?.error ?? `HTTP ${res.status}` }))
        return
      }
      const d = json?.data ?? json
      setState({
        section:   section,
        anomalies: Array.isArray(d?.anomalies) ? d.anomalies : [],
        total:     Number(d?.total ?? 0),
        loading:   false,
        error:     null,
      })
    } catch (e) {
      setState(s => ({ ...s, loading: false, error: (e as Error).message }))
    }
  }, [section, limit])

  useEffect(() => { refetch() }, [refetch])

  return { ...state, refetch }
}
