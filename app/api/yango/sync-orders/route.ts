import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"

export const maxDuration = 60

const PAGE_SIZE = 100
const MAX_ORDERS = 5000

export async function POST() {
  try {
    // 1. Trouver la date du dernier order stocké
    const { data: latest } = await supabase
      .from("commandes_yango")
      .select("ended_at")
      .order("ended_at", { ascending: false })
      .limit(1)
      .single()

    const fromDate = latest?.ended_at ?? "2024-01-01T00:00:00Z"

    // 2. Fetch paginé depuis Yango
    const allOrders: Record<string, unknown>[] = []
    let cursor: string | null = null

    do {
      const body: Record<string, unknown> = {
        limit: PAGE_SIZE,
        query: {
          park: {
            id: process.env.ID_DU_PARTENAIRE,
            order: {
              ended_at: {
                from: fromDate,
                to: new Date().toISOString(),
              },
            },
          },
        },
      }
      if (cursor) body.cursor = cursor

      const res = await fetch(process.env.YANGO_ORDERS_URL!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.YANGO_ORDERS_API_KEY!,
          "X-Client-ID": process.env.CLID!,
        },
        body: JSON.stringify(body),
      })

      const text = await res.text()

      // Arrêt propre si rate-limit Yango
      if (!text.trim().startsWith("{") && !text.trim().startsWith("[")) {
        console.warn("Yango réponse non-JSON:", text.slice(0, 100))
        break
      }

      const data = JSON.parse(text)
      const pageOrders: Record<string, unknown>[] = Array.isArray(data.orders) ? data.orders : []
      allOrders.push(...pageOrders)

      cursor = (data.next_cursor as string) || (data.cursor as string) || null
      if (pageOrders.length < PAGE_SIZE) cursor = null

      // Délai entre pages pour éviter le rate-limit
      if (cursor) await new Promise(r => setTimeout(r, 300))
    } while (cursor && allOrders.length < MAX_ORDERS)

    if (allOrders.length === 0) {
      return NextResponse.json({ synced: 0, message: "Aucune nouvelle commande depuis " + fromDate })
    }

    // 3. Upsert dans Supabase par lots de 500
    const BATCH = 500
    let upsertError = null
    for (let i = 0; i < allOrders.length; i += BATCH) {
      const batch = allOrders.slice(i, i + BATCH)
      const rows = batch.map((o) => ({
        id: o.id as string,
        short_id: o.short_id as number ?? null,
        status: o.status as string ?? null,
        created_at: (o.created_at as string) || null,
        ended_at: (o.ended_at as string) || (o.created_at as string) || null,
        raw: o,
      }))
      const { error } = await supabase
        .from("commandes_yango")
        .upsert(rows, { onConflict: "id" })
      if (error) { upsertError = error.message; break }
    }

    if (upsertError) {
      return NextResponse.json({ error: upsertError, fetched: allOrders.length }, { status: 500 })
    }

    return NextResponse.json({ synced: allOrders.length, from: fromDate })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("Erreur sync-orders:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
