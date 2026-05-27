"use client"

/**
 * Hook de fetch des KPIs (stats agrégées) avec mêmes filtres que useOperations
 * mais sans pagination ni tri.
 *
 * Référence : doc Phase 3 Écran 1 §6.3.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { authFetch } from "@/lib/authFetch"
import type { OperationsFilters, OperationsStats } from "@/types/compta-ui"

type State = {
  data:    OperationsStats | null
  loading: boolean
  error:   string | null
}

function buildQueryString(f: OperationsFilters): string {
  const p = new URLSearchParams()
  if (f.type)         p.set("type", f.type)
  if (f.source)       p.set("source", f.source)
  if (f.statuts && f.statuts.length > 0) p.set("statut", f.statuts.join(","))
  if (f.categorie_id) p.set("categorie_id", f.categorie_id)
  if (f.caisse_id)    p.set("caisse_id", f.caisse_id)
  if (f.compte_id)    p.set("compte_id", f.compte_id)
  if (f.vehicule_id)  p.set("vehicule_id", String(f.vehicule_id))
  if (f.chauffeur_id) p.set("chauffeur_id", String(f.chauffeur_id))
  if (f.client_id)    p.set("client_id", String(f.client_id))
  if (f.date_from)    p.set("date_from", f.date_from)
  if (f.date_to)      p.set("date_to", f.date_to)
  if (f.search)       p.set("search", f.search)
  return p.toString()
}

export function useOperationsStats(filters: OperationsFilters, debounceMs = 300) {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null })
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const requestIdRef = useRef(0)

  const doFetch = useCallback(async (f: OperationsFilters) => {
    const reqId = ++requestIdRef.current
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const qs   = buildQueryString(f)
      const res  = await authFetch(`/api/compta/operations/stats${qs ? "?" + qs : ""}`)
      const json = await res.json()
      if (reqId !== requestIdRef.current) return
      if (!res.ok) {
        setState({ data: null, loading: false, error: json.error ?? `HTTP ${res.status}` })
        return
      }
      setState({ data: json.data as OperationsStats, loading: false, error: null })
    } catch (e) {
      if (reqId !== requestIdRef.current) return
      setState({ data: null, loading: false, error: (e as Error).message })
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doFetch(filters), debounceMs)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)])

  return state
}
