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

// GET — liste tous les utilisateurs (email + statut depuis auth.users)
export async function GET(req: NextRequest) {
  const caller = await requireDirecteur(req)
  if (!caller) return NextResponse.json({ error: "Accès refusé" }, { status: 403 })

  const { data: { users: authUsers }, error: authError } = await supabaseAdmin.auth.admin.listUsers()
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  const { data: profiles } = await supabaseAdmin.from("profiles").select("*")
  const profileMap = new Map((profiles || []).map(p => [p.id, p]))

  const users = authUsers.map(u => {
    const p = profileMap.get(u.id)
    const banned = u.banned_until ? new Date(u.banned_until) > new Date() : false
    return {
      id:         u.id,
      email:      u.email || "",
      full_name:  (p as Record<string, unknown>)?.full_name as string | null || u.user_metadata?.name || u.user_metadata?.display_name || null,
      role:       (p as Record<string, unknown>)?.role as string || "dispatcher",
      is_active:  !banned,
      created_at: u.created_at,
    }
  })

  return NextResponse.json({ users })
}

// POST — créer un nouvel utilisateur
export async function POST(req: NextRequest) {
  const caller = await requireDirecteur(req)
  if (!caller) return NextResponse.json({ error: "Accès refusé" }, { status: 403 })

  const { email, password, full_name, role } = await req.json()
  if (!email || !password || !role) return NextResponse.json({ error: "Champs manquants" }, { status: 400 })
  if (!["admin", "dispatcher"].includes(role)) return NextResponse.json({ error: "Rôle invalide" }, { status: 400 })

  const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: full_name },
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  // Upsert profil (only columns that exist)
  await supabaseAdmin.from("profiles").upsert({
    id:   newUser.user.id,
    role,
  })

  await supabaseAdmin.from("activity_logs").insert({
    user_id:   caller.id,
    user_name: caller.email,
    user_role: "directeur",
    action:    "create_user",
    entity:    "user",
    details:   { email, role, full_name },
  })

  return NextResponse.json({ success: true, user_id: newUser.user.id })
}

// PATCH — modifier rôle ou statut
export async function PATCH(req: NextRequest) {
  const caller = await requireDirecteur(req)
  if (!caller) return NextResponse.json({ error: "Accès refusé" }, { status: 403 })

  const { user_id, role, is_active } = await req.json()
  if (!user_id) return NextResponse.json({ error: "user_id requis" }, { status: 400 })

  if (role !== undefined) {
    await supabaseAdmin.from("profiles").upsert({ id: user_id, role })
  }

  if (is_active !== undefined) {
    await supabaseAdmin.auth.admin.updateUserById(user_id, {
      ban_duration: is_active ? "none" : "87600h",
    })
  }

  await supabaseAdmin.from("activity_logs").insert({
    user_id:   caller.id,
    user_name: caller.email,
    user_role: "directeur",
    action:    "update_user",
    entity:    "user",
    details:   { user_id, role, is_active },
  })

  return NextResponse.json({ success: true })
}

// DELETE — désactiver
export async function DELETE(req: NextRequest) {
  const caller = await requireDirecteur(req)
  if (!caller) return NextResponse.json({ error: "Accès refusé" }, { status: 403 })

  const { user_id } = await req.json()
  if (!user_id) return NextResponse.json({ error: "user_id requis" }, { status: 400 })

  await supabaseAdmin.auth.admin.updateUserById(user_id, { ban_duration: "87600h" })

  await supabaseAdmin.from("activity_logs").insert({
    user_id:   caller.id,
    user_name: caller.email,
    user_role: "directeur",
    action:    "disable_user",
    entity:    "user",
    details:   { user_id },
  })

  return NextResponse.json({ success: true })
}
