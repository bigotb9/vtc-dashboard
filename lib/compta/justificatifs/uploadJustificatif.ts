/**
 * Upload d'un justificatif sur Supabase Storage + insert table
 * (Phase 4.x Vague 3 §3.3.1).
 *
 * Validations :
 *   - mime ∈ {pdf, jpg, jpeg, png}
 *   - size ≤ 5 Mo par fichier
 *   - total ops ≤ 15 Mo (incluant le nouveau)
 *   - nb total ≤ 5 fichiers actifs
 *
 * Le path Storage est calculé à partir de l'id justificatif généré APRÈS
 * un pre-INSERT, ce qui garantit un nommage stable.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"
import type { JustificatifMimeType, JustificatifUploadResponse } from "@/types/compta-ui"
import {
  JUSTIFICATIF_ALLOWED_MIMES, JUSTIFICATIF_BUCKET,
  JUSTIFICATIF_MAX_FILE_SIZE, JUSTIFICATIF_MAX_FILES, JUSTIFICATIF_MAX_TOTAL_SIZE,
  buildStoragePath,
} from "./constants"

export class JustificatifError extends Error {
  constructor(public code: string, message: string, public details?: Record<string, unknown>) {
    super(message)
    this.name = "JustificatifError"
  }
}

export type UploadResult =
  | { ok: true;  data: JustificatifUploadResponse }
  | { ok: false; error: JustificatifError }

export async function uploadJustificatif(opts: {
  operationId: string
  userId:      string
  filename:    string
  mimeType:    string
  bytes:       Buffer | Uint8Array
  size:        number
}): Promise<UploadResult> {
  const { operationId, userId, filename, mimeType, bytes, size } = opts

  // ── 1. Validations basiques ─────────────────────────────────────────────
  if (!(JUSTIFICATIF_ALLOWED_MIMES as ReadonlyArray<string>).includes(mimeType)) {
    return fail("INVALID_PAYLOAD", `Format non supporté (PDF, JPG, PNG uniquement) — reçu : ${mimeType}`)
  }
  if (size <= 0 || size > JUSTIFICATIF_MAX_FILE_SIZE) {
    return fail("INVALID_PAYLOAD", `Fichier trop volumineux (max ${JUSTIFICATIF_MAX_FILE_SIZE / 1024 / 1024} Mo)`)
  }
  if (!filename || filename.length > 255) {
    return fail("INVALID_PAYLOAD", "Nom de fichier invalide")
  }

  // ── 2. Vérifier l'existence de l'opération ──────────────────────────────
  const { data: op, error: opErr } = await supabaseAdmin
    .from("operations")
    .select("id")
    .eq("id", operationId)
    .maybeSingle()
  if (opErr) return fail("DB_ERROR", opErr.message)
  if (!op)   return fail("NOT_FOUND", "Opération introuvable")

  // ── 3. Vérifier les contraintes de quota (count + total bytes) ──────────
  const { data: existing, error: exErr } = await supabaseAdmin
    .from("justificatifs")
    .select("size_bytes")
    .eq("operation_id", operationId)
    .is("deleted_at", null)
  if (exErr) return fail("DB_ERROR", exErr.message)
  const existingArr = (existing ?? []) as Array<{ size_bytes: number }>
  if (existingArr.length >= JUSTIFICATIF_MAX_FILES) {
    return fail("CONFLICT", `Limite atteinte (${JUSTIFICATIF_MAX_FILES} justificatifs maximum par opération)`)
  }
  const currentTotal = existingArr.reduce((a, r) => a + Number(r.size_bytes), 0)
  if (currentTotal + size > JUSTIFICATIF_MAX_TOTAL_SIZE) {
    return fail("CONFLICT", `Taille totale dépassée (${JUSTIFICATIF_MAX_TOTAL_SIZE / 1024 / 1024} Mo maximum par opération)`)
  }

  // ── 4. Pre-INSERT pour réserver un id (placeholder storage_path temporaire) ─
  const { data: ins, error: insErr } = await supabaseAdmin
    .from("justificatifs")
    .insert({
      operation_id:   operationId,
      storage_path:   "pending",                       // sera UPDATE après upload
      storage_bucket: JUSTIFICATIF_BUCKET,
      filename,
      mime_type:      mimeType,
      size_bytes:     size,
      uploaded_by:    userId,
    })
    .select("id, uploaded_at")
    .single()
  if (insErr || !ins) {
    return fail("DB_ERROR", `Insert justificatif : ${insErr?.message ?? "vide"}`)
  }
  const justificatifId = ins.id as string
  const storagePath    = buildStoragePath(operationId, justificatifId, filename)

  // ── 5. Upload vers Storage ──────────────────────────────────────────────
  const { error: upErr } = await supabaseAdmin.storage
    .from(JUSTIFICATIF_BUCKET)
    .upload(storagePath, bytes, {
      contentType: mimeType,
      cacheControl: "60",
      upsert: false,
    })
  if (upErr) {
    // Rollback : supprimer la ligne orpheline
    await supabaseAdmin.from("justificatifs").delete().eq("id", justificatifId)
    return fail("INTERNAL_ERROR", `Upload Storage : ${upErr.message}`)
  }

  // ── 6. Patch le storage_path définitif ──────────────────────────────────
  const { error: updErr } = await supabaseAdmin
    .from("justificatifs")
    .update({ storage_path: storagePath })
    .eq("id", justificatifId)
  if (updErr) {
    // Rollback storage + ligne
    await supabaseAdmin.storage.from(JUSTIFICATIF_BUCKET).remove([storagePath]).catch(() => {})
    await supabaseAdmin.from("justificatifs").delete().eq("id", justificatifId)
    return fail("DB_ERROR", `Update storage_path : ${updErr.message}`)
  }

  return {
    ok: true,
    data: {
      id:          justificatifId,
      filename,
      mime_type:   mimeType as JustificatifMimeType,
      size_bytes:  size,
      uploaded_at: ins.uploaded_at as string,
    },
  }
}

function fail(code: string, message: string): UploadResult {
  return { ok: false, error: new JustificatifError(code, message) }
}
