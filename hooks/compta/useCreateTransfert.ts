"use client"

/**
 * Hook POST /api/compta/transferts (Phase 4.x Vague 1).
 *
 * Wrapper du fetch + état loading + parsing typé du résultat.
 */

import { useCallback, useState } from "react"
import { authFetch } from "@/lib/authFetch"
import type { TransfertCreateResult, TransfertPayload } from "@/types/compta-ui"

export type CreateTransfertResult =
  | { ok: true;  result: TransfertCreateResult }
  | { ok: false; error: string; code?: string; status?: number }

export function useCreateTransfert() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const create = useCallback(async (payload: TransfertPayload): Promise<CreateTransfertResult> => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch("/api/compta/transferts", {
        method: "POST",
        body:   JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({} as Record<string, unknown>))
      if (!res.ok) {
        const j = json as { error?: string; code?: string }
        const msg = j?.error ?? `HTTP ${res.status}`
        setError(msg)
        return { ok: false, error: msg, code: j?.code, status: res.status }
      }
      return { ok: true, result: (json as { data: TransfertCreateResult }).data }
    } catch (e) {
      const msg = (e as Error).message
      setError(msg)
      return { ok: false, error: msg }
    } finally {
      setLoading(false)
    }
  }, [])

  return { create, loading, error }
}
