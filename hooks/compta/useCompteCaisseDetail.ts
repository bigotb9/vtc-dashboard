"use client"

/**
 * Hook de fetch du détail enrichi d'une caisse ou d'un compte (Écran 5).
 *
 * Référence : doc Phase 3 Écran 5 §3 / §4.5.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { authFetch } from "@/lib/authFetch"
import type { ComptesCaissesDetail } from "@/types/compta-ui"

type State = {
  data:    ComptesCaissesDetail | null
  loading: boolean
  error:   string | null
}

export function useCompteCaisseDetail(kind: "caisse" | "compte", id: string | null) {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null })
  const requestIdRef = useRef(0)

  const refetch = useCallback(async () => {
    if (!id) { setState({ data: null, loading: false, error: null }); return }
    const reqId = ++requestIdRef.current
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const url = kind === "caisse"
        ? `/api/compta/caisses/${id}`
        : `/api/compta/comptes/${id}`
      const res = await authFetch(url)
      const json = await res.json().catch(() => ({}))
      if (reqId !== requestIdRef.current) return
      if (!res.ok) {
        setState({ data: null, loading: false, error: json?.error ?? `HTTP ${res.status}` })
        return
      }
      setState({ data: json.data as ComptesCaissesDetail, loading: false, error: null })
    } catch (e) {
      if (reqId !== requestIdRef.current) return
      setState({ data: null, loading: false, error: (e as Error).message })
    }
  }, [kind, id])

  useEffect(() => { refetch() }, [refetch])

  return { ...state, refetch }
}
