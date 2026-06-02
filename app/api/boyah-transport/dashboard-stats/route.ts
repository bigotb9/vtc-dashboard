import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"
import { requirePermission } from "@/lib/requirePermission"

// Auth Lot Z (26/05/2026 audit) : requirePermission("view_dashboard") — la
// route etait ouverte (finding 2.4), exposant les KPIs Boyah Transport.
//
// Perf (02/06/2026, fix 504) : l'agregation est entierement deportee dans
// Postgres via la fonction RPC boyah_dashboard_stats (migration
// 20260602120000). La route ne charge plus les ~65 000 lignes de
// commandes_yango en memoire (ancien code : ~65 requetes paginees + >100
// passes JS -> depassait maxDuration). Elle renvoie directement le jsonb
// agrege. Format de sortie strictement identique a l'ancienne version.

export const maxDuration = 30

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "view_dashboard")
  if (!auth.ok) return auth.response

  try {
    // Commission Boyah Transport sur les courses Yango. Configurable via env
    // YANGO_COMMISSION_RATE (ex: "0.025" pour 2.5%, "0.05" pour 5%).
    const commission = Number(process.env.YANGO_COMMISSION_RATE || 0.025)

    const { data, error } = await supabase.rpc("boyah_dashboard_stats", {
      p_commission: commission,
    })
    if (error) throw error

    return NextResponse.json(data)
  } catch (err) {
    console.error("[dashboard-stats]", err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
