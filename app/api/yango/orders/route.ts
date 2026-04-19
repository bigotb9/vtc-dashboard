import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"

export const maxDuration = 30

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page    = Math.max(0, parseInt(searchParams.get("page") || "0"))
    const limit   = Math.min(200, parseInt(searchParams.get("limit") || "100"))
    const status  = searchParams.get("status") || ""   // "complete" | "cancelled" | ""
    const search  = searchParams.get("search") || ""
    const offset  = page * limit

    // Récupère d'abord le total pour la pagination
    let countQuery = supabase.from("commandes_yango").select("id", { count: "exact", head: true })
    if (status) countQuery = countQuery.eq("status", status)

    const { count } = await countQuery

    // Fetch la page demandée
    let query = supabase
      .from("commandes_yango")
      .select("raw, status, created_at, ended_at")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) query = query.eq("status", status)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Filtre search côté serveur si fourni (sur short_id, driver name)
    let rows = (data || []).map(row => row.raw as Record<string, unknown>)
    if (search) {
      const s = search.toLowerCase()
      rows = rows.filter(o => {
        const shortId = String(o.short_id || "").toLowerCase()
        const driver  = ((o.driver_profile as Record<string, unknown>)?.name as string || "").toLowerCase()
        const cat     = (o.category as string || "").toLowerCase()
        return shortId.includes(s) || driver.includes(s) || cat.includes(s)
      })
    }

    return NextResponse.json({
      orders: rows,
      total:  count ?? 0,
      page,
      limit,
      pages:  Math.ceil((count ?? 0) / limit),
    })
  } catch (err) {
    console.error("[orders]", err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
