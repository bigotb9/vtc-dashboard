/**
 * Création atomique d'un tiers via la RPC PostgreSQL `create_tiers`
 * (Phase 4.x Vague 2).
 *
 * La fonction RPC gère :
 *   - Mapping type → compte SYSCOHADA parent (411 / 401 / 421 / 467)
 *   - Génération du suffixe par défaut (initiales du nom) si non fourni
 *   - Retry sur collision (GA → GA1 → GA2 … max 100)
 *   - Retourne JSON {tiers_id, suffix_final, compte_syscohada_code}
 *
 * Erreurs typées via `TiersError`.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"
import type { TiersCreateResult, TiersPayload } from "@/types/compta-ui"

export class TiersError extends Error {
  constructor(public code: string, message: string, public details?: Record<string, unknown>) {
    super(message)
    this.name = "TiersError"
  }
}

export type CreateTiersReply =
  | { ok: true;  result: TiersCreateResult }
  | { ok: false; error: TiersError }

export async function createTiersRpc(
  payload: TiersPayload,
  userId:  string,
): Promise<CreateTiersReply> {
  try {
    const { data, error } = await supabaseAdmin.rpc("create_tiers", {
      p_nom:                  payload.nom,
      p_type:                 payload.type,
      p_telephone:            payload.telephone            ?? null,
      p_email:                payload.email                ?? null,
      p_adresse:              payload.adresse              ?? null,
      p_raison_sociale:       payload.raison_sociale       ?? null,
      p_numero_rccm:          payload.numero_rccm          ?? null,
      p_numero_contribuable:  payload.numero_contribuable  ?? null,
      p_suffix_manuel:        payload.suffix_manuel        ?? null,
      p_notes:                payload.notes                ?? null,
      p_user_id:              userId,
    })

    if (error) {
      console.error("[tiers.create] RPC error:", {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      })
      const msg = error.message ?? ""
      if (/Type de tiers invalide/i.test(msg))           return fail("INVALID_PAYLOAD", msg)
      if (/Nom obligatoire/i.test(msg))                  return fail("INVALID_PAYLOAD", msg)
      if (/suffixe unique après 100/i.test(msg))         return fail("CONFLICT", msg)
      return fail("DB_ERROR", `Création tiers : ${msg}`, {
        code: error.code, hint: error.hint, details: error.details,
      })
    }
    if (!data || typeof data !== "object") {
      return fail("INTERNAL_ERROR", "RPC create_tiers : retour vide")
    }
    const r = data as Record<string, unknown>
    return {
      ok: true,
      result: {
        tiers_id:              String(r.tiers_id),
        suffix_final:          String(r.suffix_final),
        compte_syscohada_code: String(r.compte_syscohada_code),
      },
    }
  } catch (e) {
    console.error("[tiers.create] unexpected:", e)
    return fail("INTERNAL_ERROR", (e as Error).message ?? "Erreur inattendue")
  }
}

function fail(code: string, message: string, details?: Record<string, unknown>): CreateTiersReply {
  return { ok: false, error: new TiersError(code, message, details) }
}
