"use client"

/**
 * Hook CRUD pour le formulaire Caisse/Compte (Écran 5).
 *
 * Expose :
 *  - create  : POST /api/compta/caisses ou /comptes selon type_cible
 *  - update  : PATCH /api/compta/{kind}/[id]
 *  - remove  : DELETE /api/compta/{kind}/[id]
 *
 * Tous renvoient { ok, data?, error?, code? } pour permettre une gestion
 * fine côté UI (afficher toast d'erreur, redirect, etc.).
 *
 * Référence : doc Phase 3 Écran 5 §4.2-4.4.
 */

import { useCallback, useState } from "react"
import { authFetch } from "@/lib/authFetch"
import type { CompteCaisseFormInput } from "@/types/compta-ui"

export type FormActionResult<T = unknown> = {
  ok:        true
  data:      T
} | {
  ok:        false
  error:     string
  code?:     string
  details?:  unknown
}

function buildPayload(input: CompteCaisseFormInput): Record<string, unknown> {
  if (input.type_cible === "caisse") {
    return {
      libelle:                input.libelle,
      code:                   input.code,
      type:                   input.type ?? "cash",
      operateur:              input.type === "mobile_money" ? input.operateur : null,
      numero:                 input.numero,
      compte_syscohada_code:  input.compte_syscohada_code,
      description:            input.description,
      actif:                  input.actif,
    }
  }
  // compte bancaire
  return {
    libelle:                input.libelle,
    code:                   input.code,
    banque:                 input.banque,
    numero_compte:          input.numero,
    compte_syscohada_code:  input.compte_syscohada_code,
    description:            input.description,
    actif:                  input.actif,
  }
}

function endpoint(kind: "caisse" | "compte", id?: string): string {
  const base = kind === "caisse" ? "/api/compta/caisses" : "/api/compta/comptes"
  return id ? `${base}/${id}` : base
}

export function useCompteCaisseForm() {
  const [loading, setLoading] = useState(false)

  const create = useCallback(async (input: CompteCaisseFormInput): Promise<FormActionResult<{ id: string }>> => {
    setLoading(true)
    try {
      const res = await authFetch(endpoint(input.type_cible), {
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

  const update = useCallback(async (
    kind: "caisse" | "compte",
    id:   string,
    input: CompteCaisseFormInput,
  ): Promise<FormActionResult<{ id: string }>> => {
    setLoading(true)
    try {
      // On retire le `type_cible` du payload car non éditable par PATCH ;
      // l'endpoint est déjà déterminé par `kind`.
      const payload = buildPayload(input)
      const res = await authFetch(endpoint(kind, id), {
        method: "PATCH",
        body:   JSON.stringify(payload),
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

  const remove = useCallback(async (kind: "caisse" | "compte", id: string): Promise<FormActionResult<{ deleted: boolean; mode?: string }>> => {
    setLoading(true)
    try {
      const res = await authFetch(endpoint(kind, id), { method: "DELETE" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        return { ok: false, error: json?.error ?? `HTTP ${res.status}`, code: json?.code, details: json?.details }
      }
      const out = json?.data ?? json
      return { ok: true, data: { deleted: !!out?.deleted, mode: out?.mode } }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    } finally {
      setLoading(false)
    }
  }, [])

  return { create, update, remove, loading }
}
