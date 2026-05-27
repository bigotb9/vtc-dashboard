/**
 * GET  /api/cockpit/todos  — liste tous les to-dos (non faits d'abord, puis récents)
 * POST /api/cockpit/todos  — crée un to-do (body: { texte: string })
 *
 * To-do partagée équipe : tous les utilisateurs authentifiés ont accès en
 * lecture/écriture. created_by tracé pour audit. RLS sur la table permet
 * tout aux authenticated (cf. migration 20260527140000_cockpit_todos.sql).
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

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "view_dashboard")
  if (!auth.ok) return auth.response

  try {
    // Non faits en premier (done ASC), puis plus récents en premier
    const { data, error } = await supabaseAdmin
      .from("cockpit_todos")
      .select("id, texte, done, created_by, created_at, done_at, done_by")
      .order("done", { ascending: true })
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({ ok: true, data: (data ?? []) as TodoRow[] })
  } catch (e) {
    console.error("[cockpit/todos GET]", e)
    return NextResponse.json(
      { ok: false, error: (e as Error).message || "Erreur serveur" },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, "view_dashboard")
  if (!auth.ok) return auth.response

  let body: { texte?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body JSON invalide" },
      { status: 400 },
    )
  }

  const texte = String(body.texte ?? "").trim()
  if (!texte) {
    return NextResponse.json(
      { ok: false, error: "Le champ 'texte' est requis et ne peut pas être vide" },
      { status: 400 },
    )
  }
  if (texte.length > TEXTE_MAX_LEN) {
    return NextResponse.json(
      { ok: false, error: `Le texte dépasse ${TEXTE_MAX_LEN} caractères` },
      { status: 400 },
    )
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("cockpit_todos")
      .insert({
        texte,
        created_by: auth.user.id,
      })
      .select("id, texte, done, created_by, created_at, done_at, done_by")
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, data: data as TodoRow }, { status: 201 })
  } catch (e) {
    console.error("[cockpit/todos POST]", e)
    return NextResponse.json(
      { ok: false, error: (e as Error).message || "Erreur serveur" },
      { status: 500 },
    )
  }
}
