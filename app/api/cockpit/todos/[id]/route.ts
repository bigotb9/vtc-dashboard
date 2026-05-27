/**
 * PATCH  /api/cockpit/todos/[id]  — toggle done OU update texte
 *   - body: { done: boolean }    → coche/décoche + maj done_at/done_by
 *   - body: { texte: string }    → renomme le to-do
 *
 * DELETE /api/cockpit/todos/[id] — supprime le to-do
 *
 * Cockpit Boyah — Étape 1/3 backend (27/05/2026).
 */

import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { requirePermission } from "@/lib/requirePermission"

export const dynamic     = "force-dynamic"
export const maxDuration = 30

const TEXTE_MAX_LEN = 500

type TodoRow = {
  id:         string
  texte:      string
  done:       boolean
  created_by: string | null
  created_at: string
  done_at:    string | null
  done_by:    string | null
}

type Ctx = { params: Promise<{ id: string }> }

/** Validation UUID basique (8-4-4-4-12 hex). */
function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requirePermission(req, "view_dashboard")
  if (!auth.ok) return auth.response

  const { id } = await ctx.params
  if (!isUuid(id)) {
    return NextResponse.json(
      { ok: false, error: "ID invalide (UUID attendu)" },
      { status: 400 },
    )
  }

  let body: { done?: unknown; texte?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body JSON invalide" },
      { status: 400 },
    )
  }

  // Construction du patch en fonction des champs fournis.
  const patch: Record<string, unknown> = {}

  if (typeof body.done === "boolean") {
    patch.done    = body.done
    patch.done_at = body.done ? new Date().toISOString() : null
    patch.done_by = body.done ? auth.user.id : null
  }

  if (typeof body.texte === "string") {
    const texte = body.texte.trim()
    if (!texte) {
      return NextResponse.json(
        { ok: false, error: "Le champ 'texte' ne peut pas être vide" },
        { status: 400 },
      )
    }
    if (texte.length > TEXTE_MAX_LEN) {
      return NextResponse.json(
        { ok: false, error: `Le texte dépasse ${TEXTE_MAX_LEN} caractères` },
        { status: 400 },
      )
    }
    patch.texte = texte
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { ok: false, error: "Aucun champ valide à mettre à jour (attendu: done ou texte)" },
      { status: 400 },
    )
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("cockpit_todos")
      .update(patch)
      .eq("id", id)
      .select("id, texte, done, created_by, created_at, done_at, done_by")
      .single()

    if (error) throw error
    if (!data) {
      return NextResponse.json(
        { ok: false, error: "To-do introuvable" },
        { status: 404 },
      )
    }

    return NextResponse.json({ ok: true, data: data as TodoRow })
  } catch (e) {
    console.error("[cockpit/todos PATCH]", e)
    return NextResponse.json(
      { ok: false, error: (e as Error).message || "Erreur serveur" },
      { status: 500 },
    )
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requirePermission(req, "view_dashboard")
  if (!auth.ok) return auth.response

  const { id } = await ctx.params
  if (!isUuid(id)) {
    return NextResponse.json(
      { ok: false, error: "ID invalide (UUID attendu)" },
      { status: 400 },
    )
  }

  try {
    const { error } = await supabaseAdmin
      .from("cockpit_todos")
      .delete()
      .eq("id", id)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[cockpit/todos DELETE]", e)
    return NextResponse.json(
      { ok: false, error: (e as Error).message || "Erreur serveur" },
      { status: 500 },
    )
  }
}
