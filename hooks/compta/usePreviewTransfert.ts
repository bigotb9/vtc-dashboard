"use client"

/**
 * Hook POST /api/compta/transferts/preview (Phase 4.x Vague 1).
 *
 * Calcule l'écriture future SANS rien créer en BD. Debouncé pour limiter le
 * spam pendant que l'utilisateur tape le montant.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { authFetch } from "@/lib/authFetch"
import type { TransfertPayload, TransfertPreview } from "@/types/compta-ui"

type State = {
  data:    TransfertPreview | null
  loading: boolean
  error:   string | null
}

export function usePreviewTransfert(payload: TransfertPayload | null, debounceMs = 250) {
  const [state, setState] = useState<State>({ data: null, loading: false, error: null })
  const reqIdRef = useRef(0)
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doFetch = useCallback(async (p: TransfertPayload) => {
    const reqId = ++reqIdRef.current
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const res  = await authFetch("/api/compta/transferts/preview", {
        method: "POST",
        body:   JSON.stringify(p),
      })
      const json = await res.json().catch(() => ({} as Record<string, unknown>))
      if (reqId !== reqIdRef.current) return
      if (!res.ok) {
        const j = json as { error?: string }
        setState({ data: null, loading: false, error: j?.error ?? `HTTP ${res.status}` })
        return
      }
      setState({ data: (json as { data: TransfertPreview }).data, loading: false, error: null })
    } catch (e) {
      if (reqId !== reqIdRef.current) return
      setState({ data: null, loading: false, error: (e as Error).message })
    }
  }, [])

  useEffect(() => {
    if (tRef.current) clearTimeout(tRef.current)
    if (!payload) { setState({ data: null, loading: false, error: null }); return }
    if (!isComplete(payload)) {
      setState({ data: null, loading: false, error: null })
      return
    }
    tRef.current = setTimeout(() => doFetch(payload), debounceMs)
    return () => { if (tRef.current) clearTimeout(tRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(payload), debounceMs, doFetch])

  return state
}

/** Vérifie qu'on a au moins source XOR + dest XOR + montant > 0 + date. */
function isComplete(p: TransfertPayload): boolean {
  const hasSource = !!(p.source_caisse_id ? !p.source_compte_id : p.source_compte_id)
  const hasDest   = !!(p.dest_caisse_id   ? !p.dest_compte_id   : p.dest_compte_id)
  return hasSource && hasDest && p.montant > 0 && !!p.date_transfert
}
