"use client"

/**
 * Hook de fetch du détail enrichi d'une catégorie (Écran 6).
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { authFetch } from "@/lib/authFetch"
import type { CategorieDetail } from "@/types/compta-ui"

type State = {
  data:    CategorieDetail | null
  loading: boolean
  error:   string | null
}

export function useCategorieDetail(id: string | null) {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null })
  const requestIdRef = useRef(0)

  const refetch = useCallback(async () => {
    if (!id) { setState({ data: null, loading: false, error: null }); return }
    const reqId = ++requestIdRef.current
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const res = await authFetch(`/api/compta/categories/${id}`)
      const json = await res.json().catch(() => ({}))
      if (reqId !== requestIdRef.current) return
      if (!res.ok) {
        setState({ data: null, loading: false, error: json?.error ?? `HTTP ${res.status}` })
        return
      }
      setState({ data: json.data as CategorieDetail, loading: false, error: null })
    } catch (e) {
      if (reqId !== requestIdRef.current) return
      setState({ data: null, loading: false, error: (e as Error).message })
    }
  }, [id])

  useEffect(() => { refetch() }, [refetch])

  return { ...state, refetch }
}
