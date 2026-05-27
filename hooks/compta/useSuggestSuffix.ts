"use client"

/**
 * Hook debouncé GET /api/compta/tiers/suggest-suffix (Phase 4.x Vague 2).
 *
 * Calcule le suffixe par défaut depuis (nom, type) + vérifie sa disponibilité.
 * Mise en attente 250 ms pour limiter les fetches pendant la saisie.
 */

import { useEffect, useRef, useState } from "react"
import { authFetch } from "@/lib/authFetch"
import type { SuggestSuffixResponse, TiersType } from "@/types/compta-ui"

type State = {
  data:    SuggestSuffixResponse | null
  loading: boolean
  error:   string | null
}

export function useSuggestSuffix(nom: string, type: TiersType | null, debounceMs = 250) {
  const [state, setState] = useState<State>({ data: null, loading: false, error: null })
  const reqIdRef = useRef(0)
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (tRef.current) clearTimeout(tRef.current)
    if (!nom || !nom.trim() || !type) {
      setState({ data: null, loading: false, error: null })
      return
    }
    tRef.current = setTimeout(async () => {
      const reqId = ++reqIdRef.current
      setState(s => ({ ...s, loading: true, error: null }))
      try {
        const p = new URLSearchParams({ nom: nom.trim(), type })
        const res = await authFetch(`/api/compta/tiers/suggest-suffix?${p.toString()}`)
        const json = await res.json().catch(() => ({}))
        if (reqId !== reqIdRef.current) return
        if (!res.ok) {
          setState({ data: null, loading: false, error: json?.error ?? `HTTP ${res.status}` })
          return
        }
        setState({ data: json.data as SuggestSuffixResponse, loading: false, error: null })
      } catch (e) {
        if (reqId !== reqIdRef.current) return
        setState({ data: null, loading: false, error: (e as Error).message })
      }
    }, debounceMs)
    return () => { if (tRef.current) clearTimeout(tRef.current) }
  }, [nom, type, debounceMs])

  return state
}
