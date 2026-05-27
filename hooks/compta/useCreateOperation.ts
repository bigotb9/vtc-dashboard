"use client"

/**
 * Hook de soumission du formulaire de saisie d'opération (Écran 4 Phase 3).
 *
 * Expose 2 actions :
 *   - saveDraft  → POST /api/compta/operations { statut:'brouillon' }
 *   - validate   → POST /api/compta/operations { statut:'brouillon' }
 *                  PUIS POST /api/compta/operations/[id]/valider
 *
 * En cas d'échec de la validation après création, on garde l'opération en
 * brouillon et on remonte l'erreur — l'appelant peut afficher un toast avec
 * lien vers le détail pour correction.
 *
 * Référence : doc Phase 3 Écran 4 §4.2-4.4.
 */

import { useCallback, useState } from "react"
import { authFetch } from "@/lib/authFetch"
import type { CreateOperationInput } from "@/types/compta-ui"

export type SaveResult = {
  ok:           true
  operationId:  string
  statut:       "brouillon" | "valide"
  ecritureId?:  string | null
} | {
  ok:               false
  error:            string
  details?:         unknown
  /** Si la création OK mais la /valider a foiré, on remonte l'id pour
   *  permettre la navigation vers le détail. */
  operationId?:     string
}

function buildPayload(input: CreateOperationInput): Record<string, unknown> {
  return {
    type:              input.type,
    date_operation:    input.date_operation,
    montant:           input.montant,
    libelle:           input.libelle,
    caisse_id:         input.caisse_id ?? null,
    compte_id:         input.compte_id ?? null,
    categorie_id:      input.categorie_id,
    vehicule_id:       input.vehicule_id  ?? null,
    chauffeur_id:      input.chauffeur_id ?? null,
    client_id:         input.client_id    ?? null,
    notes:             input.notes ?? null,
    statut:            "brouillon",
  }
}

export function useCreateOperation() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const saveDraft = useCallback(async (input: CreateOperationInput): Promise<SaveResult> => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch("/api/compta/operations", {
        method: "POST",
        body:   JSON.stringify(buildPayload(input)),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = json?.error ?? `HTTP ${res.status}`
        setError(msg)
        return { ok: false, error: msg, details: json?.details ?? json }
      }
      const op = json?.data ?? json
      return { ok: true, operationId: String(op.id), statut: "brouillon" }
    } catch (e) {
      const msg = (e as Error).message
      setError(msg)
      return { ok: false, error: msg }
    } finally {
      setLoading(false)
    }
  }, [])

  const validate = useCallback(async (input: CreateOperationInput): Promise<SaveResult> => {
    setLoading(true)
    setError(null)
    try {
      // 1. Création en brouillon
      const createRes = await authFetch("/api/compta/operations", {
        method: "POST",
        body:   JSON.stringify(buildPayload(input)),
      })
      const createJson = await createRes.json().catch(() => ({}))
      if (!createRes.ok) {
        const msg = createJson?.error ?? `HTTP ${createRes.status} à la création`
        setError(msg)
        return { ok: false, error: msg, details: createJson?.details ?? createJson }
      }
      const op = createJson?.data ?? createJson
      const opId = String(op.id)

      // 2. Validation : transition brouillon → valide + génération écriture
      const valideRes = await authFetch(`/api/compta/operations/${opId}/valider`, {
        method: "POST",
      })
      const valideJson = await valideRes.json().catch(() => ({}))
      if (!valideRes.ok) {
        const msg = valideJson?.error ?? `HTTP ${valideRes.status} à la validation`
        setError(msg)
        // On garde l'opération en brouillon (déjà créée) → on renvoie l'id pour
        // permettre la navigation vers le détail.
        return { ok: false, error: msg, details: valideJson?.details ?? valideJson, operationId: opId }
      }
      const valideData = valideJson?.data ?? valideJson
      return {
        ok:           true,
        operationId:  opId,
        statut:       "valide",
        ecritureId:   valideData?.ecriture_id ?? null,
      }
    } catch (e) {
      const msg = (e as Error).message
      setError(msg)
      return { ok: false, error: msg }
    } finally {
      setLoading(false)
    }
  }, [])

  return { saveDraft, validate, loading, error }
}
