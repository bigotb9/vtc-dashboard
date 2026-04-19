import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

async function requireDirecteur(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) return null
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return null
  const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "directeur") return null
  return user
}

// GET — toutes les permissions
export async function GET(req: NextRequest) {
  const caller = await requireDirecteur(req)
  if (!caller) return NextResponse.json({ error: "Accès refusé" }, { status: 403 })

  const { data } = await supabaseAdmin.from("role_permissions").select("*").order("role").order("action")
  return NextResponse.json({ permissions: data || [] })
}

// PATCH — modifier une permission
export async function PATCH(req: NextRequest) {
  const caller = await requireDirecteur(req)
  if (!caller) return NextResponse.json({ error: "Accès refusé" }, { status: 403 })

  const { role, action, allowed } = await req.json()
  if (!role || !action || allowed === undefined) return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 })

  const { error } = await supabaseAdmin
    .from("role_permissions")
    .upsert({ role, action, allowed, updated_at: new Date().toISOString() }, { onConflict: "role,action" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabaseAdmin.from("activity_logs").insert({
    user_id:   caller.id,
    user_name: caller.email,
    user_role: "directeur",
    action:    "update_permission",
    entity:    "permission",
    details:   { role, action, allowed },
  })

  return NextResponse.json({ success: true })
}
