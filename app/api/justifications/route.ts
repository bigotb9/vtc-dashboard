import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

async function requireAdmin(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return null
  const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).single()
  if (!profile || !["admin", "directeur"].includes(profile.role)) return null
  return user
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id_vehicule = searchParams.get("id_vehicule")
  const from        = searchParams.get("from")
  const to          = searchParams.get("to")

  let q = supabaseAdmin.from("justifications_versement").select("*").order("jour_exploitation", { ascending: false })
  if (id_vehicule) q = q.eq("id_vehicule", id_vehicule)
  if (from)        q = q.gte("jour_exploitation", from)
  if (to)          q = q.lte("jour_exploitation", to)

  const { data, error } = await q
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, justifications: data })
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin(req)
  if (!user) return NextResponse.json({ ok: false, error: "Accès réservé aux admins" }, { status: 403 })

  const body = await req.json()
  const { id_vehicule, jour_exploitation, type, motif, montant_attendu, montant_recu } = body
  if (!id_vehicule || !jour_exploitation || !type)
    return NextResponse.json({ ok: false, error: "Champs requis manquants" }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from("justifications_versement")
    .upsert({
      id_vehicule, jour_exploitation, type,
      motif: motif || null,
      montant_attendu: montant_attendu || null,
      montant_recu:    montant_recu    || null,
      auto_genere:     false,
      created_by:      user.id,
    }, { onConflict: "id_vehicule,jour_exploitation" })
    .select()
    .single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, justification: data })
}

export async function DELETE(req: NextRequest) {
  const user = await requireAdmin(req)
  if (!user) return NextResponse.json({ ok: false, error: "Accès réservé aux admins" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ ok: false, error: "id requis" }, { status: 400 })

  const { error } = await supabaseAdmin.from("justifications_versement").delete().eq("id", id)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
