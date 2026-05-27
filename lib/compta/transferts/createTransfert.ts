/**
 * Création atomique d'un transfert interne via la fonction RPC PostgreSQL
 * `create_transfert_interne` (Phase 4.x Vague 1).
 *
 * Le contrat est délibérément fin : on délègue toute la chaîne (transfert + 2
 * opérations + 1 écriture + 2 lignes) à PostgreSQL. Si une étape échoue, la
 * transaction entière est rollbackée — pas de demi-transfert possible.
 *
 * Erreurs typées via `TransfertError` avec codes alignés sur errors.ts.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"
import type { TransfertCreateResult, TransfertPayload } from "@/types/compta-ui"

export class TransfertError extends Error {
  constructor(public code: string, message: string, public details?: Record<string, unknown>) {
    super(message)
    this.name = "TransfertError"
  }
}

export type CreateTransfertOk    = { ok: true;  result: TransfertCreateResult }
export type CreateTransfertFail  = { ok: false; error: TransfertError }
export type CreateTransfertReply = CreateTransfertOk | CreateTransfertFail

export async function createTransfertInterne(
  payload: TransfertPayload,
  userId:  string,
): Promise<CreateTransfertReply> {
  try {
    const { data, error } = await supabaseAdmin.rpc("create_transfert_interne", {
      p_date:              payload.date_transfert,
      p_montant:           payload.montant,
      p_libelle:           payload.libelle ?? null,
      p_source_caisse_id:  payload.source_caisse_id ?? null,
      p_source_compte_id:  payload.source_compte_id ?? null,
      p_dest_caisse_id:    payload.dest_caisse_id ?? null,
      p_dest_compte_id:    payload.dest_compte_id ?? null,
      p_user_id:           userId,
      p_notes:             payload.notes ?? null,
    })

    if (error) {
      console.error("[transfert.create] RPC error:", {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      })
      // Mapper les messages PG vers nos codes
      const msg = error.message ?? ""
      if (/exercice ouvert/i.test(msg))             return fail("EXERCICE_CLOSED", msg)
      if (/Catégorie système/i.test(msg))           return fail("CATEGORY_NO_MAPPING", msg)
      if (/mapping SYSCOHADA/i.test(msg))           return fail("ACCOUNT_NO_MAPPING", msg)
      if (/ne peuvent pas être/i.test(msg))         return fail("INVALID_PAYLOAD", msg)
      if (/Source invalide|Destination invalide/i.test(msg)) return fail("INVALID_PAYLOAD", msg)
      if (/strictement positif/i.test(msg))         return fail("INVALID_PAYLOAD", msg)
      if (/déséquilibrée/i.test(msg))               return fail("ECRITURE_DESEQUILIBREE", msg)
      return fail("DB_ERROR", `Échec création transfert : ${msg}`, {
        code: error.code, hint: error.hint, details: error.details,
      })
    }

    if (!data || typeof data !== "object") {
      return fail("INTERNAL_ERROR", "RPC create_transfert_interne : retour vide")
    }
    const r = data as Record<string, unknown>
    return {
      ok: true,
      result: {
        transfert_id:        String(r.transfert_id),
        operation_sortie_id: String(r.operation_sortie_id),
        operation_entree_id: String(r.operation_entree_id),
        ecriture_id:         String(r.ecriture_id),
        numero_ecriture:     String(r.numero_ecriture),
      },
    }
  } catch (e) {
    console.error("[transfert.create] unexpected:", e)
    return fail("INTERNAL_ERROR", (e as Error).message ?? "Erreur inattendue")
  }
}

function fail(code: string, message: string, details?: Record<string, unknown>): CreateTransfertFail {
  return { ok: false, error: new TransfertError(code, message, details) }
}
