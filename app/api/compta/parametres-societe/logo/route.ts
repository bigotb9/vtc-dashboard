/**
 * POST   /api/compta/parametres-societe/logo — Upload nouveau logo (FormData).
 * DELETE /api/compta/parametres-societe/logo — Supprime le logo actif.
 *
 * Phase 4.2 Module 1 §2.4.
 * - Validations : mime ∈ {png, jpg, svg+xml}, size ≤ 2 Mo
 * - Path Storage : `logo-{timestamp}.{ext}` (le précédent est SUPPRIMÉ)
 * - Met à jour `societe_parametres.logo_storage_path`
 */

import type { NextRequest } from "next/server"
import { logActivity } from "@/lib/logActivity"
import { requireComptaPermission } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const LOGO_BUCKET     = "logos"
const LOGO_MAX_SIZE   = 2 * 1024 * 1024
const LOGO_MIMES      = ["image/png", "image/jpeg", "image/svg+xml"] as const
const MIME_EXT: Record<string, string> = {
  "image/png":     "png",
  "image/jpeg":    "jpg",
  "image/svg+xml": "svg",
}

// ─── POST upload ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireComptaPermission(req, "manage_societe")
  if (!auth.ok) return auth.response

  let formData: FormData
  try { formData = await req.formData() } catch (e) {
    return comptaError("INVALID_PAYLOAD", { reason: (e as Error).message }, "FormData invalide")
  }
  const file = formData.get("file")
  if (!file || typeof file === "string") {
    return comptaError("INVALID_PAYLOAD", { reason: "field 'file' manquant" })
  }
  const f = file as File
  if (!(LOGO_MIMES as ReadonlyArray<string>).includes(f.type)) {
    return comptaError("INVALID_PAYLOAD", { mime: f.type }, "Format non supporté (PNG, JPG, SVG uniquement)")
  }
  if (f.size > LOGO_MAX_SIZE) {
    return comptaError("INVALID_PAYLOAD", { size: f.size }, "Fichier trop volumineux (max 2 Mo)")
  }

  // 1. Charger l'enregistrement existant pour récupérer l'ancien path
  const { data: existing } = await supabaseAdmin
    .from("societe_parametres")
    .select("id, logo_storage_path, nom_commercial, raison_sociale")
    .limit(1)
    .maybeSingle()

  if (!existing) {
    return comptaError(
      "CONFLICT",
      undefined,
      "Crée d'abord les paramètres société (nom + raison sociale) avant d'uploader le logo.",
    )
  }

  // 2. Upload du nouveau fichier
  const ext      = MIME_EXT[f.type] ?? "bin"
  const newPath  = `logo-${Date.now()}.${ext}`
  const buf      = Buffer.from(await f.arrayBuffer())
  const { error: upErr } = await supabaseAdmin.storage
    .from(LOGO_BUCKET)
    .upload(newPath, buf, { contentType: f.type, cacheControl: "60", upsert: false })
  if (upErr) {
    console.error("[logo.upload] storage error:", upErr)
    return comptaError("INTERNAL_ERROR", { hint: upErr.message }, "Upload Storage échoué")
  }

  // 3. Update path en BD
  const { error: updErr } = await supabaseAdmin
    .from("societe_parametres")
    .update({
      logo_storage_path: newPath,
      updated_at:        new Date().toISOString(),
      updated_by:        auth.user.id,
    })
    .eq("id", existing.id)
  if (updErr) {
    // Rollback Storage
    await supabaseAdmin.storage.from(LOGO_BUCKET).remove([newPath]).catch(() => {})
    return comptaError("DB_ERROR", { hint: updErr.message })
  }

  // 4. Supprimer l'ancien logo (best-effort, ignore les erreurs)
  if (existing.logo_storage_path && existing.logo_storage_path !== newPath) {
    await supabaseAdmin.storage.from(LOGO_BUCKET).remove([existing.logo_storage_path]).catch(() => {})
  }

  await logActivity({
    token:   auth.token,
    action:  "compta.societe_parametres.logo_upload",
    entity:  existing.id,
    details: { storage_path: newPath, mime: f.type, size: f.size },
  })

  return comptaOk({ logo_storage_path: newPath }, { status: 201 })
}

// ─── DELETE logo ─────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const auth = await requireComptaPermission(req, "manage_societe")
  if (!auth.ok) return auth.response

  const { data: existing } = await supabaseAdmin
    .from("societe_parametres")
    .select("id, logo_storage_path")
    .limit(1)
    .maybeSingle()
  if (!existing) return comptaError("NOT_FOUND", undefined, "Paramètres société introuvables")

  if (existing.logo_storage_path) {
    await supabaseAdmin.storage.from(LOGO_BUCKET).remove([existing.logo_storage_path]).catch(() => {})
  }

  const { error } = await supabaseAdmin
    .from("societe_parametres")
    .update({ logo_storage_path: null, updated_at: new Date().toISOString(), updated_by: auth.user.id })
    .eq("id", existing.id)
  if (error) return comptaError("DB_ERROR", { hint: error.message })

  await logActivity({
    token:   auth.token,
    action:  "compta.societe_parametres.logo_delete",
    entity:  existing.id,
  })

  return comptaOk({ deleted: true })
}
