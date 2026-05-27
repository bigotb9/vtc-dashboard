"use client"

/**
 * Hook de fetch du détail enrichi d'une opération (Écran 2 Phase 3).
 * Référence : doc §5.3.
 *
 * Note : `notFound` est exposé séparément pour permettre à la page de
 * basculer sur le composant `<NotFound />` Next.js (status 404).
 */

import { useCallback, useEffect, useState } from "react"
import { authFetch } from "@/lib/authFetch"
import type { OperationDetailResponse } from "@/types/compta-ui"

type State = {
  data:     OperationDetailResponse | null
  loading:  boolean
  error:    string | null
  notFound: boolean
}

export function useOperationDetail(id: string) {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null, notFound: false })

  const fetchDetail = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null, notFound: false }))
    try {
      const res = await authFetch(`/api/compta/operations/${id}/detail`)
      if (res.status === 404) {
        setState({ data: null, loading: false, error: null, notFound: true })
        return
      }
      const json = await res.json()
      if (!res.ok) {
        setState({ data: null, loading: false, error: json.error ?? `HTTP ${res.status}`, notFound: false })
        return
      }
      setState({ data: json.data as OperationDetailResponse, loading: false, error: null, notFound: false })
    } catch (e) {
      setState({ data: null, loading: false, error: (e as Error).message, notFound: false })
    }
  }, [id])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  return { ...state, refetch: fetchDetail }
}
