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

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("jours_feries")
    .select("*")
    .order("date", { ascending: false })
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, feries: data })
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin(req)
  if (!user) return NextResponse.json({ ok: false, error: "Accès réservé aux admins" }, { status: 403 })

  const body = await req.json()
  const { date, libelle, montant } = body
  if (!date || !libelle) return NextResponse.json({ ok: false, error: "date et libelle requis" }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from("jours_feries")
    .upsert({ date, libelle, montant: montant || 15000 })
    .select()
    .single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, ferie: data })
}

export async function DELETE(req: NextRequest) {
  const user = await requireAdmin(req)
  if (!user) return NextResponse.json({ ok: false, error: "Accès réservé aux admins" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get("date")
  if (!date) return NextResponse.json({ ok: false, error: "date requis" }, { status: 400 })

  const { error } = await supabaseAdmin.from("jours_feries").delete().eq("date", date)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
