import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { requirePermission } from "@/lib/requirePermission"

// Auth Lot Z (26/05/2026 audit) : requirePermission("manage_tasks") sur toutes
// methodes — la route etait ouverte (finding 2.4).

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "manage_tasks")
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const id_vehicule = searchParams.get("id_vehicule")
  const fait        = searchParams.get("fait") // "true" | "false" | null

  let query = supabaseAdmin
    .from("taches_suivi")
    .select("*, vehicules(immatriculation)")
    .order("created_at", { ascending: false })

  if (id_vehicule) query = query.eq("id_vehicule", id_vehicule)
  if (fait === "true")  query = query.eq("fait", true)
  if (fait === "false") query = query.eq("fait", false)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ taches: data })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, "manage_tasks")
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { id_vehicule, immatriculation, description, id_entretien } = body

  if (!id_vehicule || !immatriculation || !description)
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from("taches_suivi")
    .insert({ id_vehicule, immatriculation, description, id_entretien: id_entretien || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, tache: data })
}

export async function PATCH(req: NextRequest) {
  const auth = await requirePermission(req, "manage_tasks")
  if (!auth.ok) return auth.response

  const body = await req.json()
  const { id, fait } = body
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 })

  const { error } = await supabaseAdmin
    .from("taches_suivi")
    .update({ fait: !!fait, fait_at: fait ? new Date().toISOString() : null })
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePermission(req, "manage_tasks")
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 })

  const { error } = await supabaseAdmin.from("taches_suivi").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
