"use client"

/**
 * Hook de fetch des opérations comptables avec filtres + pagination + tri.
 * Référence : doc Phase 3 Écran 1 §6.3.
 *
 * Le hook construit la query string, appelle /api/compta/operations avec le
 * Bearer token de la session Supabase, et retourne {data, loading, error, refetch}.
 *
 * Note : utilise un debounce 300ms sur les changements de filtres pour éviter
 * de hammérer l'API lors de la saisie de la recherche libre.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { authFetch } from "@/lib/authFetch"
import type { OperationView, OperationsFilters, OperationsPaginated } from "@/types/compta-ui"

type State = {
  data:    OperationsPaginated | null
  loading: boolean
  error:   string | null
}

function buildQueryString(f: OperationsFilters): string {
  const p = new URLSearchParams()
  if (f.type)          p.set("type", f.type)
  if (f.source)        p.set("source", f.source)
  if (f.statuts && f.statuts.length > 0) p.set("statut", f.statuts.join(","))
  if (f.categorie_id)  p.set("categorie_id", f.categorie_id)
  if (f.caisse_id)     p.set("caisse_id", f.caisse_id)
  if (f.compte_id)     p.set("compte_id", f.compte_id)
  if (f.vehicule_id)   p.set("vehicule_id", String(f.vehicule_id))
  if (f.chauffeur_id)  p.set("chauffeur_id", String(f.chauffeur_id))
  if (f.client_id)     p.set("client_id", String(f.client_id))
  // Phase 4.x Vague 2 correctif §2.2 — filtre tiers_ids (CSV)
  if (f.tiers_ids && f.tiers_ids.length > 0) p.set("tiers_ids", f.tiers_ids.join(","))
  if (f.date_from)     p.set("date_from", f.date_from)
  if (f.date_to)       p.set("date_to", f.date_to)
  if (f.search)        p.set("recherche", f.search)
  if (f.sort_by && f.sort_order) p.set("sort", `${f.sort_by}:${f.sort_order}`)
  if (f.page)          p.set("page", String(f.page))
  if (f.page_size)     p.set("page_size", String(f.page_size))
  return p.toString()
}

export function useOperations(filters: OperationsFilters, debounceMs = 300) {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null })
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const requestIdRef = useRef(0)

  const doFetch = useCallback(async (f: OperationsFilters) => {
    const reqId = ++requestIdRef.current
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const qs   = buildQueryString(f)
      const res  = await authFetch(`/api/compta/operations${qs ? "?" + qs : ""}`)
      const json = await res.json()
      if (reqId !== requestIdRef.current) return     // requête obsolète, ignorer
      if (!res.ok) {
        setState({ data: null, loading: false, error: json.error ?? `HTTP ${res.status}` })
        return
      }
      // L'API renvoie {data: [...], total, page, page_size} (comptaOkList).
      const data: OperationsPaginated = {
        data:      Array.isArray(json.data) ? (json.data as OperationView[]) : [],
        total:     json.total     ?? 0,
        page:      json.page      ?? 1,
        page_size: json.page_size ?? 50,
      }
      setState({ data, loading: false, error: null })
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

  const refetch = useCallback(() => doFetch(filters), [doFetch, filters])

  return { ...state, refetch }
}
