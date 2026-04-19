import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"

export const maxDuration = 30

type RawOrder = {
  status:     string
  created_at: string
  ended_at:   string | null
  raw: {
    price?:          number | string
    driver_profile?: { id?: string; name?: string }
    car?:            { brand_model?: string; brand?: string; model?: string; number?: string }
    payment_method?: string
    category?:       string
  }
}

async function fetchAllOrders(): Promise<RawOrder[]> {
  const all: RawOrder[] = []
  const PAGE = 1000
  let from   = 0
  while (true) {
    const { data, error } = await supabase
      .from("commandes_yango")
      .select("status, created_at, ended_at, raw")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1)
    if (error || !data || data.length === 0) break
    all.push(...(data as RawOrder[]))
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

export async function GET() {
  try {
    const orders = await fetchAllOrders()

    const now        = new Date()
    const todayStr   = now.toISOString().slice(0, 10)
    const monthStr   = now.toISOString().slice(0, 7)
    const weekAgoStr = new Date(now.getTime() - 7  * 86400000).toISOString().slice(0, 10)
    const COMMISSION = 0.025

    const completed = orders.filter(o => o.status === "complete")
    const cancelled = orders.filter(o => o.status === "cancelled")

    const price = (o: RawOrder) => Number(o.raw?.price || 0)

    const todayCompleted = completed.filter(o => o.created_at?.startsWith(todayStr))
    const weekCompleted  = completed.filter(o => (o.created_at?.slice(0, 10) || "") >= weekAgoStr)
    const monthCompleted = completed.filter(o => o.created_at?.startsWith(monthStr))

    const revToday = todayCompleted.reduce((s, o) => s + price(o), 0)
    const revWeek  = weekCompleted.reduce((s, o) => s + price(o), 0)
    const revMonth = monthCompleted.reduce((s, o) => s + price(o), 0)
    const revTotal = completed.reduce((s, o) => s + price(o), 0)

    // Revenus des 30 derniers jours
    const dailyData = Array.from({ length: 30 }, (_, i) => {
      const d   = new Date(now.getTime() - (29 - i) * 86400000)
      const day = d.toISOString().slice(0, 10)
      const rev = completed.filter(o => o.created_at?.startsWith(day)).reduce((s, o) => s + price(o), 0)
      return {
        date:     day,
        label:    `${d.getDate()}/${d.getMonth() + 1}`,
        revenus:  Math.round(rev),
        comm:     Math.round(rev * COMMISSION),
        courses:  completed.filter(o => o.created_at?.startsWith(day)).length,
      }
    })

    // Revenus par heure aujourd'hui
    const hourlyMap: Record<number, number> = {}
    todayCompleted.forEach(o => {
      const h = new Date(o.created_at).getHours()
      hourlyMap[h] = (hourlyMap[h] || 0) + price(o)
    })
    const hourlyData = Array.from({ length: 24 }, (_, h) => ({
      label: `${h}h`, value: Math.round(hourlyMap[h] || 0),
    })).filter(h => h.value > 0)

    // Top chauffeurs (par revenu total)
    const driverMap: Record<string, { name: string; courses: number; revenue: number }> = {}
    completed.forEach(o => {
      const id   = o.raw?.driver_profile?.id || "unknown"
      const name = o.raw?.driver_profile?.name || "Inconnu"
      if (!driverMap[id]) driverMap[id] = { name, courses: 0, revenue: 0 }
      driverMap[id].courses++
      driverMap[id].revenue += price(o)
    })
    const topDrivers = Object.values(driverMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(d => ({ ...d, revenue: Math.round(d.revenue), commission: Math.round(d.revenue * COMMISSION) }))

    // Top véhicules
    const vehicleMap: Record<string, { courses: number; revenue: number }> = {}
    completed.forEach(o => {
      const k = o.raw?.car?.brand_model || (o.raw?.car?.brand ? `${o.raw.car.brand} ${o.raw.car.model}` : null) || "Inconnu"
      if (!vehicleMap[k]) vehicleMap[k] = { courses: 0, revenue: 0 }
      vehicleMap[k].courses++
      vehicleMap[k].revenue += price(o)
    })
    const topVehicles = Object.entries(vehicleMap)
      .map(([name, d]) => ({ name, ...d, revenue: Math.round(d.revenue) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6)

    // Répartition paiements
    const payMap: Record<string, number> = {}
    completed.forEach(o => {
      const k = o.raw?.payment_method || "Autre"
      payMap[k] = (payMap[k] || 0) + 1
    })
    const paymentData = Object.entries(payMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

    // Espèces vs sans espèces (revenu)
    let especes = 0, sanEspeces = 0
    completed.forEach(o => {
      const p = price(o)
      if (o.raw?.payment_method === "cash") especes += p
      else sanEspeces += p
    })

    // Période couverte
    const allDates = orders.map(o => o.created_at).filter(Boolean).sort()
    const periodFrom = allDates[0]?.slice(0, 10) || null
    const periodTo   = allDates[allDates.length - 1]?.slice(0, 10) || null

    // Tendance semaine vs semaine précédente
    const prevWeekAgo = new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 10)
    const prevWeek    = completed.filter(o => {
      const d = o.created_at?.slice(0, 10) || ""
      return d >= prevWeekAgo && d < weekAgoStr
    })
    const revPrevWeek = prevWeek.reduce((s, o) => s + price(o), 0)
    const trendWeek   = revPrevWeek > 0 ? ((revWeek - revPrevWeek) / revPrevWeek * 100) : null

    // Taux complétion par jour (30j) pour sparkline
    const completionTrend = dailyData.map(d => {
      const total = orders.filter(o => o.created_at?.startsWith(d.date)).length
      return { label: d.label, taux: total > 0 ? Math.round(d.courses / total * 100) : 0 }
    })

    return NextResponse.json({
      ok: true,
      period: { from: periodFrom, to: periodTo },
      totals: {
        orders:          orders.length,
        completed:       completed.length,
        cancelled:       cancelled.length,
        completionRate:  orders.length > 0 ? Math.round(completed.length / orders.length * 100) : 0,
        avgOrderValue:   completed.length > 0 ? Math.round(revTotal / completed.length) : 0,
      },
      revenue: {
        today: Math.round(revToday),
        week:  Math.round(revWeek),
        month: Math.round(revMonth),
        total: Math.round(revTotal),
        prevWeek: Math.round(revPrevWeek),
        trendWeekPct: trendWeek !== null ? Math.round(trendWeek) : null,
        especes:    Math.round(especes),
        sanEspeces: Math.round(sanEspeces),
      },
      commission: {
        today: Math.round(revToday  * COMMISSION),
        week:  Math.round(revWeek   * COMMISSION),
        month: Math.round(revMonth  * COMMISSION),
        total: Math.round(revTotal  * COMMISSION),
      },
      charts: {
        daily:      dailyData,
        hourly:     hourlyData,
        payments:   paymentData,
        completion: completionTrend,
      },
      topDrivers,
      topVehicles,
    })
  } catch (err) {
    console.error("[dashboard-stats]", err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
