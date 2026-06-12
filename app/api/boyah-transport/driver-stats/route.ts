import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { requirePermission } from "@/lib/requirePermission"

// Auth Lot Z (26/05/2026 audit) : requirePermission("view_dashboard") — la
// route etait ouverte (finding 2.4), exposant l'identite + telephones des
// chauffeurs Yango.
//
// Perf (02/06/2026, meme fix que dashboard-stats) : l'agregation per-chauffeur
// est entierement deportee dans Postgres via la fonction RPC boyah_driver_stats
// (migration 20260602160000). La route ne charge plus les ~64 800 lignes de
// commandes_yango en memoire (ancien code : ~65 requetes paginees + agregation
// JS -> >30s). On garde l'appel Yango Drivers (noms/tel/vehicule/plaque +
// chauffeurs a 0 course) et on merge avec le resultat SQL. Fenetres GLISSANTES
// (7j/30j) conservees (libelles UI "7 jours" / "30 jours"). Format de sortie
// strictement identique a l'ancienne version.

export const maxDuration = 30

type DriverStatRow = {
  driver_id:     string
  driver_name:   string
  total_courses: number
  total_revenue: number
  commission:    number
  courses_week:  number
  courses_mois:  number
  last_activity: string | null
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "view_dashboard")
  if (!auth.ok) return auth.response

  try {
    const COMMISSION = Number(process.env.YANGO_COMMISSION_RATE || 0.025)

    // 1. Agregation per-chauffeur entierement en SQL (remplace fetchAllOrders + JS)
    const { data: sqlStats, error: rpcError } = await supabaseAdmin.rpc("boyah_driver_stats", {
      p_commission: COMMISSION,
    })
    if (rpcError) throw rpcError
    const rows = (sqlStats ?? []) as DriverStatRow[]

    // 2. Profils drivers depuis Yango API (noms / telephones / vehicule / plaque
    //    + chauffeurs enregistres mais sans aucune course)
    const driversUrl = process.env.YANGO_DRIVERS_URL
    const driversKey = process.env.YANGO_DRIVERS_API_KEY
    const clid       = process.env.CLID
    const parkId     = process.env.ID_DU_PARTENAIRE

    if (!driversUrl || !driversKey || !clid || !parkId) {
      return NextResponse.json({ ok: false, error: "Variables d'environnement Yango manquantes" }, { status: 500 })
    }

    const dRes = await fetch(driversUrl, {
      method: "POST",
      headers: {
        "Content-Type":    "application/json",
        "X-API-Key":       driversKey,
        "X-Client-ID":     clid,
        "X-Park-ID":       parkId,
        "Accept-Language": "fr",
      },
      body: JSON.stringify({
        query: { park: { id: parkId } },
        limit: 1000, offset: 0,
      }),
    })
    const dData = await dRes.json()
    type YangoProfile = {
      driver_profile?: { id?: string; first_name?: string; last_name?: string; phones?: string[]; work_status?: string }
      current_status?: { status?: string }
      car?: { brand?: string; model?: string; number?: string }
      accounts?: { balance?: string }[]
    }
    const profileMap = new Map<string, {
      nom: string; telephone: string; vehicle: string; plaque: string; solde: string; statut: string
    }>()
    for (const d of (dData.driver_profiles ?? []) as YangoProfile[]) {
      const id = d.driver_profile?.id
      if (!id) continue
      profileMap.set(id, {
        nom:       `${d.driver_profile?.first_name || ""} ${d.driver_profile?.last_name || ""}`.trim(),
        telephone: d.driver_profile?.phones?.[0] || "",
        vehicle:   d.car ? `${d.car.brand} ${d.car.model}` : "",
        plaque:    d.car?.number || "",
        solde:     d.accounts?.[0]?.balance || "0",
        statut:    d.current_status?.status || "",
      })
    }

    // 3. Construire les stats finales depuis le resultat SQL + merge profil Yango
    const stats = []
    const seenIds = new Set<string>()

    for (const r of rows) {
      seenIds.add(r.driver_id)
      const profile = profileMap.get(r.driver_id)

      const status =
        r.courses_week > 0 ? "actif" :
        r.courses_mois > 0 ? "risque" : "inactif"

      stats.push({
        id:           r.driver_id,
        nom:          profile?.nom          || r.driver_name,
        telephone:    profile?.telephone    || "",
        vehicle:      profile?.vehicle      || "",
        plaque:       profile?.plaque       || "",
        solde:        profile?.solde        || "0",
        statut:       profile?.statut       || "",
        totalCourses: r.total_courses,
        totalRevenue: r.total_revenue,
        commission:   r.commission,
        lastActivity: r.last_activity,
        status,
        coursesWeek:  r.courses_week,
        coursesMois:  r.courses_mois,
      })
    }

    // Drivers enregistres dans Yango mais sans aucune commande
    for (const [id, profile] of profileMap.entries()) {
      if (!seenIds.has(id)) {
        stats.push({
          id, ...profile,
          totalCourses: 0, totalRevenue: 0, commission: 0,
          lastActivity: null, status: "inactif",
          coursesWeek: 0, coursesMois: 0,
        })
      }
    }

    stats.sort((a, b) => b.totalRevenue - a.totalRevenue)

    return NextResponse.json({ ok: true, stats, total: stats.length })
  } catch (err) {
    console.error("[driver-stats]", err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
