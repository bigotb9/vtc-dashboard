"use client"

/**
 * Hook unifié `useFlowData(kind, filters)` pour les pages /depenses et /recettes
 * (Phase 4.x Vague 3.5 §3.2.1).
 *
 * Orchestre 2 appels API en parallèle (liste + stats), gère le loading,
 * dédup des requêtes via reqId. Les filtres URL sont gérés côté page parent.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { authFetch } from "@/lib/authFetch"
import type { FlowFilters, FlowKind, FlowListResponse, FlowStatsResponse } from "@/types/compta-ui"

type State = {
  list:        FlowListResponse  | null
  stats:       FlowStatsResponse | null
  loading:     boolean
  loadingMore: boolean
  error:       string | null
}

function buildQueryString(filters: FlowFilters): string {
  const p = new URLSearchParams()
  if (filters.from)        p.set("from", filters.from)
  if (filters.to)          p.set("to",   filters.to)
  if (filters.cat_ids?.length)       p.set("cat_ids",       filters.cat_ids.join(","))
  if (filters.caisse_ids?.length)    p.set("caisse_ids",    filters.caisse_ids.join(","))
  if (filters.vehicule_ids?.length)  p.set("vehicule_ids",  filters.vehicule_ids.join(","))
  if (filters.chauffeur_ids?.length) p.set("chauffeur_ids", filters.chauffeur_ids.join(","))
  if (filters.tiers_ids?.length)     p.set("tiers_ids",     filters.tiers_ids.join(","))
  if (filters.sources?.length)       p.set("sources",       filters.sources.join(","))
  if (filters.montant_min != null)   p.set("montant_min",   String(filters.montant_min))
  if (filters.montant_max != null)   p.set("montant_max",   String(filters.montant_max))
  if (filters.search)                p.set("search",        filters.search)
  if (filters.page && filters.page > 1) p.set("page",       String(filters.page))
  if (filters.page_size && filters.page_size !== 20) p.set("page_size", String(filters.page_size))
  if (filters.sort_by && filters.sort_by !== "date_op") p.set("sort_by", filters.sort_by)
  if (filters.sort_order && filters.sort_order !== "desc") p.set("sort_order", filters.sort_order)
  return p.toString()
}

export function useFlowData(kind: FlowKind, filters: FlowFilters) {
  const [state, setState] = useState<State>({
    list: null, stats: null, loading: true, loadingMore: false, error: null,
  })
  const reqIdRef = useRef(0)
  const isFirstLoadRef = useRef(true)

  const doFetch = useCallback(async (f: FlowFilters) => {
    const reqId = ++reqIdRef.current
    // Première charge : full loading. Sinon, loadingMore (transition douce sur la table).
    if (isFirstLoadRef.current) {
      setState(s => ({ ...s, loading: true, error: null }))
    } else {
      setState(s => ({ ...s, loadingMore: true, error: null }))
    }

    try {
      const qs = buildQueryString(f)
      const [listRes, statsRes] = await Promise.all([
        authFetch(`/api/compta/${kind}?${qs}`),
        authFetch(`/api/compta/${kind}/stats?${qs}`),
      ])
      const [listJson, statsJson] = await Promise.all([
        listRes.json().catch(()  => ({} as Record<string, unknown>)),
        statsRes.json().catch(() => ({} as Record<string, unknown>)),
      ])
      if (reqId !== reqIdRef.current) return

      if (!listRes.ok) {
        const err = (listJson as { error?: string }).error ?? `HTTP ${listRes.status}`
        setState({ list: null, stats: null, loading: false, loadingMore: false, error: err })
        return
      }
      if (!statsRes.ok) {
        const err = (statsJson as { error?: string }).error ?? `HTTP ${statsRes.status}`
        setState({ list: (listJson as { data: FlowListResponse }).data, stats: null, loading: false, loadingMore: false, error: err })
        return
      }

      setState({
        list:        (listJson  as { data: FlowListResponse  }).data,
        stats:       (statsJson as { data: FlowStatsResponse }).data,
        loading:     false,
        loadingMore: false,
        error:       null,
      })
      isFirstLoadRef.current = false
    } catch (e) {
      if (reqId !== reqIdRef.current) return
      setState({ list: null, stats: null, loading: false, loadingMore: false, error: (e as Error).message })
    }
  }, [kind])

  useEffect(() => {
    doFetch(filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters), kind])

  const refetch = useCallback(() => doFetch(filters), [doFetch, filters])

  return { ...state, refetch }
}
