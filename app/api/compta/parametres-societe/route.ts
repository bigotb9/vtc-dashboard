/**
 * GET  /api/compta/parametres-societe — Récupère le singleton + signed URL logo.
 * PUT  /api/compta/parametres-societe — Upsert (création initiale ou modif).
 *
 * Phase 4.2 Module 1 §2.4.
 */

import type { NextRequest } from "next/server"
import { logActivity } from "@/lib/logActivity"
import { requireComptaPermission } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { safeParse, societeParametresSchema } from "@/lib/compta/validators"
import { getSocieteParametres } from "@/lib/compta/parametres/getParametresSociete"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// ─── GET ─────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireComptaPermission(req, "view_comptabilite")
  if (!auth.ok) return auth.response

  try {
    const data = await getSocieteParametres()
    return comptaOk(data)
  } catch (e) {
    console.error("[parametres-societe.get]", e)
    return comptaError("DB_ERROR", { hint: (e as Error).message })
  }
}

// ─── PUT (upsert) ────────────────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  const auth = await requireComptaPermission(req, "manage_societe")
  if (!auth.ok) return auth.response

  let body: unknown = {}
  try { body = await req.json() } catch { /* body vide */ }
  const parsed = safeParse(societeParametresSchema, body)
  if (!parsed.ok) return comptaError("INVALID_PAYLOAD", { issues: parsed.details })

  // Récupère l'enregistrement existant (singleton)
  const { data: existing } = await supabaseAdmin
    .from("societe_parametres")
    .select("id, logo_storage_path")
    .limit(1)
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
    updated_by: auth.user.id,
  }
  // Normaliser les chaînes vides → null
  for (const k of Object.keys(patch)) {
    if (patch[k] === "") patch[k] = null
  }

  let resultId: string
  if (existing) {
    const { data, error } = await supabaseAdmin
      .from("societe_parametres")
      .update(patch)
      .eq("id", existing.id)
      .select("id")
      .single()
    if (error || !data) return comptaError("DB_ERROR", { hint: error?.message })
    resultId = data.id
  } else {
    // INSERT initial — nom_commercial et raison_sociale required par le schema Zod
    const { data, error } = await supabaseAdmin
      .from("societe_parametres")
      .insert(patch)
      .select("id")
      .single()
    if (error || !data) return comptaError("DB_ERROR", { hint: error?.message })
    resultId = data.id
  }

  await logActivity({
    token:   auth.token,
    action:  existing ? "compta.societe_parametres.update" : "compta.societe_parametres.create",
    entity:  resultId,
    details: { keys: Object.keys(parsed.data) },
  })

  const result = await getSocieteParametres()
  return comptaOk(result)
}
