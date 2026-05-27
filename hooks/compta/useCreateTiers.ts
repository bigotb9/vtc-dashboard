"use client"

/**
 * Hook POST /api/compta/tiers (Phase 4.x Vague 2).
 *
 * Wrapper du fetch + état loading + parsing typé du résultat.
 */

import { useCallback, useState } from "react"
import { authFetch } from "@/lib/authFetch"
import type { TiersCreateResult, TiersPayload, TiersUpdatePayload } from "@/types/compta-ui"

export type CreateTiersResult =
  | { ok: true;  result: TiersCreateResult }
  | { ok: false; error: string; code?: string; status?: number }

export type UpdateTiersResult =
  | { ok: true;  id: string; compte_syscohada_code: string; actif: boolean }
  | { ok: false; error: string; code?: string; status?: number }

export function useCreateTiers() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const create = useCallback(async (payload: TiersPayload): Promise<CreateTiersResult> => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch("/api/compta/tiers", {
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
      return { ok: true, result: (json as { data: TiersCreateResult }).data }
    } catch (e) {
      const msg = (e as Error).message
      setError(msg)
      return { ok: false, error: msg }
    } finally {
      setLoading(false)
    }
  }, [])

  const update = useCallback(async (id: string, patch: TiersUpdatePayload): Promise<UpdateTiersResult> => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch(`/api/compta/tiers/${id}`, {
        method: "PATCH",
        body:   JSON.stringify(patch),
      })
      const json = await res.json().catch(() => ({} as Record<string, unknown>))
      if (!res.ok) {
        const j = json as { error?: string; code?: string }
        const msg = j?.error ?? `HTTP ${res.status}`
        setError(msg)
        return { ok: false, error: msg, code: j?.code, status: res.status }
      }
      const d = (json as { data: { id: string; compte_syscohada_code: string; actif: boolean } }).data
      return { ok: true, id: d.id, compte_syscohada_code: d.compte_syscohada_code, actif: d.actif }
    } catch (e) {
      const msg = (e as Error).message
      setError(msg)
      return { ok: false, error: msg }
    } finally {
      setLoading(false)
    }
  }, [])

  const disable = useCallback(async (id: string): Promise<UpdateTiersResult> => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch(`/api/compta/tiers/${id}/disable`, { method: "POST" })
      const json = await res.json().catch(() => ({} as Record<string, unknown>))
      if (!res.ok) {
        const j = json as { error?: string; code?: string }
        const msg = j?.error ?? `HTTP ${res.status}`
        setError(msg)
        return { ok: false, error: msg, code: j?.code, status: res.status }
      }
      return { ok: true, id, compte_syscohada_code: "", actif: false }
    } catch (e) {
      const msg = (e as Error).message
      setError(msg)
      return { ok: false, error: msg }
    } finally {
      setLoading(false)
    }
  }, [])

  return { create, update, disable, loading, error }
}
