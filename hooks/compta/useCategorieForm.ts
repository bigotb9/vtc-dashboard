"use client"

/**
 * Hook CRUD pour le formulaire Catégorie (Écran 6).
 * Mirror de useCompteCaisseForm — create / update / remove.
 */

import { useCallback, useState } from "react"
import { authFetch } from "@/lib/authFetch"
import type { CategorieFormInput } from "@/types/compta-ui"

export type CategorieActionResult<T = unknown> = {
  ok:        true
  data:      T
} | {
  ok:        false
  error:     string
  code?:     string
  details?:  unknown
}

function buildPayload(input: CategorieFormInput): Record<string, unknown> {
  return {
    libelle:                input.libelle.trim(),
    type:                   input.type,
    sens:                   input.sens,
    compte_syscohada_code:  input.compte_syscohada_code,
    journal_par_defaut:     input.journal_par_defaut,
    description:            input.description,
    actif:                  input.actif,
  }
}

export function useCategorieForm() {
  const [loading, setLoading] = useState(false)

  const create = useCallback(async (input: CategorieFormInput): Promise<CategorieActionResult<{ id: string }>> => {
    setLoading(true)
    try {
      const res = await authFetch("/api/compta/categories", {
        method: "POST",
        body:   JSON.stringify(buildPayload(input)),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        return { ok: false, error: json?.error ?? `HTTP ${res.status}`, code: json?.code, details: json?.details }
      }
      const created = json?.data ?? json
      return { ok: true, data: { id: String(created.id) } }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    } finally {
      setLoading(false)
    }
  }, [])

  const update = useCallback(async (id: string, input: CategorieFormInput): Promise<CategorieActionResult<{ id: string }>> => {
    setLoading(true)
    try {
      const res = await authFetch(`/api/compta/categories/${id}`, {
        method: "PATCH",
        body:   JSON.stringify(buildPayload(input)),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        return { ok: false, error: json?.error ?? `HTTP ${res.status}`, code: json?.code, details: json?.details }
      }
      const updated = json?.data ?? json
      return { ok: true, data: { id: String(updated.id) } }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    } finally {
      setLoading(false)
    }
  }, [])

  const remove = useCallback(async (id: string): Promise<CategorieActionResult<{ deleted: boolean }>> => {
    setLoading(true)
    try {
      const res = await authFetch(`/api/compta/categories/${id}`, { method: "DELETE" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        return { ok: false, error: json?.error ?? `HTTP ${res.status}`, code: json?.code, details: json?.details }
      }
      const out = json?.data ?? json
      return { ok: true, data: { deleted: !!out?.deleted } }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    } finally {
      setLoading(false)
    }
  }, [])

  return { create, update, remove, loading }
}
