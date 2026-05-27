/**
 * GET helper — liste des justificatifs actifs d'une opération + signed URLs
 * (Phase 4.x Vague 3 §3.3.2).
 *
 * Retourne aussi le nom de l'uploader (jointure profiles) et une URL
 * signée valide ~60s pour le download immédiat côté UI.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"
import type { JustificatifMimeType, JustificatifRef } from "@/types/compta-ui"
import { JUSTIFICATIF_BUCKET, SIGNED_URL_TTL_SECONDS } from "./constants"

export async function listJustificatifs(operationId: string): Promise<JustificatifRef[]> {
  const { data, error } = await supabaseAdmin
    .from("justificatifs")
    .select("id, filename, mime_type, size_bytes, uploaded_at, uploaded_by, storage_path")
    .eq("operation_id", operationId)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: true })
  if (error) throw error
  const rows = (data ?? []) as Array<{
    id: string; filename: string; mime_type: string; size_bytes: number;
    uploaded_at: string; uploaded_by: string | null; storage_path: string
  }>
  if (rows.length === 0) return []

  // Charger les noms des uploaders en bulk
  const userIds = Array.from(new Set(rows.map(r => r.uploaded_by).filter((x): x is string => !!x)))
  const userMap = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, name")
      .in("id", userIds)
    for (const p of (profiles ?? []) as Array<{ id: string; name: string | null }>) {
      if (p.name) userMap.set(p.id, p.name)
    }
  }

  // Générer les signed URLs en bulk
  const paths = rows.map(r => r.storage_path)
  const { data: signed, error: sErr } = await supabaseAdmin.storage
    .from(JUSTIFICATIF_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)
  if (sErr) throw sErr
  const signedMap = new Map<string, string>()
  for (const s of (signed ?? []) as Array<{ path?: string; signedUrl?: string }>) {
    if (s.path && s.signedUrl) signedMap.set(s.path, s.signedUrl)
  }

  return rows.map(r => ({
    id:               r.id,
    filename:         r.filename,
    mime_type:        r.mime_type as JustificatifMimeType,
    size_bytes:       Number(r.size_bytes),
    uploaded_at:      r.uploaded_at,
    uploaded_by_name: r.uploaded_by ? (userMap.get(r.uploaded_by) ?? null) : null,
    signed_url:       signedMap.get(r.storage_path) ?? "",
  }))
}

/** Variante : juste les compteurs en bulk pour la liste opérations. */
export async function countJustificatifsByOperation(operationIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (operationIds.length === 0) return map
  const { data, error } = await supabaseAdmin
    .from("justificatifs")
    .select("operation_id")
    .in("operation_id", operationIds)
    .is("deleted_at", null)
  if (error) throw error
  for (const r of (data ?? []) as Array<{ operation_id: string }>) {
    map.set(r.operation_id, (map.get(r.operation_id) ?? 0) + 1)
  }
  return map
}

/** Renvoie la signed URL d'UN justificatif (pour le redirect 302 download). */
export async function getJustificatifSignedUrl(justificatifId: string): Promise<{
  signed_url: string; filename: string; mime_type: string
} | null> {
  const { data: j } = await supabaseAdmin
    .from("justificatifs")
    .select("id, storage_path, filename, mime_type, deleted_at")
    .eq("id", justificatifId)
    .maybeSingle()
  if (!j || j.deleted_at) return null
  const { data: signed, error } = await supabaseAdmin.storage
    .from(JUSTIFICATIF_BUCKET)
    .createSignedUrl(j.storage_path, SIGNED_URL_TTL_SECONDS, { download: j.filename })
  if (error || !signed?.signedUrl) return null
  return { signed_url: signed.signedUrl, filename: j.filename, mime_type: j.mime_type }
}
