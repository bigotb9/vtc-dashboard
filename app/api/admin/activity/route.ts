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

export async function GET(req: NextRequest) {
  const caller = await requireDirecteur(req)
  if (!caller) return NextResponse.json({ error: "Accès refusé" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const page     = parseInt(searchParams.get("page")      || "0")
  const limit    = Math.min(100, parseInt(searchParams.get("limit") || "50"))
  const userId   = searchParams.get("user_id")   || ""
  const action   = searchParams.get("action")    || ""   // filtre partiel sur le type d'action
  const dateFrom = searchParams.get("date_from") || ""
  const dateTo   = searchParams.get("date_to")   || ""
  const offset   = page * limit

  let query = supabaseAdmin
    .from("activity_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (userId)   query = query.eq("user_id", userId)
  if (action)   query = query.ilike("action", `%${action}%`)
  if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00`)
  if (dateTo)   query = query.lte("created_at", `${dateTo}T23:59:59`)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    logs:  data || [],
    total: count || 0,
    page,
    pages: Math.ceil((count || 0) / limit),
  })
}
