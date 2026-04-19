import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"

export const maxDuration = 30

type OrderRow = {
  status:     string
  created_at: string
  raw: {
    driver_profile?: { id?: string; name?: string }
    price?:          number | string
  }
}

// Récupère TOUTES les commandes avec pagination (contourne la limite Supabase de 1000 lignes)
async function fetchAllOrders(): Promise<OrderRow[]> {
  const all: OrderRow[] = []
  const PAGE = 1000
  let from   = 0

  while (true) {
    const { data, error } = await supabase
      .from("commandes_yango")
      .select("status, created_at, raw")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1)

    if (error || !data || data.length === 0) break
    all.push(...(data as OrderRow[]))
    if (data.length < PAGE) break
    from += PAGE
  }

  return all
}

export async function GET() {
  try {
    const now      = new Date()
    const weekAgo  = new Date(now.getTime() - 7  * 86400000)
    const monthAgo = new Date(now.getTime() - 30 * 86400000)

    // 1. Tous les orders depuis Supabase (colonnes top-level = types garantis)
    const orders = await fetchAllOrders()

    // 2. Profils drivers depuis Yango API
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

    // 3. Agréger par driver_profile.id (clé fiable dans le raw Yango)
    type Bucket = {
      driverId:  string
      name:      string
      completed: { created_at: string; price: number }[]
      allCount:  number
    }
    const buckets = new Map<string, Bucket>()

    for (const row of orders) {
      const dp  = row.raw?.driver_profile
      const did = dp?.id?.trim() || ""
      if (!did) continue

      if (!buckets.has(did)) {
        buckets.set(did, { driverId: did, name: dp?.name || "", completed: [], allCount: 0 })
      }
      const b = buckets.get(did)!
      b.allCount++
      if (row.status === "complete") {
        b.completed.push({
          created_at: row.created_at,
          price:      Number(row.raw?.price || 0),
        })
      }
    }

    const COMMISSION = 0.025

    // 4. Construire stats finales
    const stats = []
    const seenIds = new Set<string>()

    for (const b of buckets.values()) {
      seenIds.add(b.driverId)
      const profile = profileMap.get(b.driverId)

      const totalRevenue = b.completed.reduce((s, o) => s + o.price, 0)
      const coursesWeek  = b.completed.filter(o => o.created_at && new Date(o.created_at) >= weekAgo).length
      const coursesMois  = b.completed.filter(o => o.created_at && new Date(o.created_at) >= monthAgo).length
      const sorted       = [...b.completed].sort((a, c) => new Date(c.created_at).getTime() - new Date(a.created_at).getTime())
      const lastActivity = sorted[0]?.created_at || null

      const status =
        coursesWeek > 0 ? "actif" :
        coursesMois > 0 ? "risque" : "inactif"

      stats.push({
        id:           b.driverId,
        nom:          profile?.nom          || b.name,
        telephone:    profile?.telephone    || "",
        vehicle:      profile?.vehicle      || "",
        plaque:       profile?.plaque       || "",
        solde:        profile?.solde        || "0",
        statut:       profile?.statut       || "",
        totalCourses: b.completed.length,
        totalRevenue: Math.round(totalRevenue),
        commission:   Math.round(totalRevenue * COMMISSION),
        lastActivity,
        status,
        coursesWeek,
        coursesMois,
      })
    }

    // Drivers enregistrés dans Yango mais sans aucune commande
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
