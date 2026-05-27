/**
 * Soft delete d'un justificatif (Phase 4.x Vague 3 §3.3.4).
 *
 * Règles :
 *   - Si l'opération parente est `valide` ET c'est le dernier justificatif
 *     actif → refus avec CONFLICT (sinon l'op deviendrait illégale au regard
 *     du trigger `enforce_justificatif_required`).
 *   - Si l'opération est `annule` → refus FORBIDDEN (lecture seule audit).
 *   - Sinon : update `deleted_at` + `deleted_by`. Le fichier reste en
 *     Storage (conservation audit trail SYSCOHADA).
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"

export type DeleteResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "CONFLICT" | "FORBIDDEN" | "DB_ERROR"; message: string }

export async function deleteJustificatif(justificatifId: string, userId: string): Promise<DeleteResult> {
  // 1. Charger le justif + l'opération parente
  const { data: j, error: jErr } = await supabaseAdmin
    .from("justificatifs")
    .select("id, operation_id, deleted_at, operation:operation_id ( statut, type, tiers_id )")
    .eq("id", justificatifId)
    .maybeSingle()
  if (jErr) return { ok: false, code: "DB_ERROR", message: jErr.message }
  if (!j)   return { ok: false, code: "NOT_FOUND", message: "Justificatif introuvable" }
  if (j.deleted_at) return { ok: false, code: "NOT_FOUND", message: "Justificatif déjà supprimé" }

  const op = (j as unknown as { operation: { statut: string; type: string; tiers_id: string | null } | null }).operation
  if (!op) return { ok: false, code: "NOT_FOUND", message: "Opération parente introuvable" }

  // 2. Refus si opération annulée (lecture seule audit)
  if (op.statut === "annule") {
    return { ok: false, code: "FORBIDDEN", message: "Opération annulée — justificatifs en lecture seule" }
  }

  // 3. Si opération validée + sortie + tiers → vérifier qu'il reste ≥ 1 autre justif actif
  if (op.statut === "valide" && op.type === "sortie" && op.tiers_id) {
    const { count } = await supabaseAdmin
      .from("justificatifs")
      .select("*", { count: "exact", head: true })
      .eq("operation_id", j.operation_id)
      .is("deleted_at", null)
      .neq("id", justificatifId)
    if ((count ?? 0) === 0) {
      return {
        ok: false,
        code: "CONFLICT",
        message: "Impossible de supprimer le dernier justificatif d'une opération validée",
      }
    }
  }

  // 4. Soft delete
  const { error: updErr } = await supabaseAdmin
    .from("justificatifs")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", justificatifId)
  if (updErr) return { ok: false, code: "DB_ERROR", message: updErr.message }

  return { ok: true }
}
