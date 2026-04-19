import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"

export async function POST(req: NextRequest) {
  try {
    const url    = process.env.YANGO_CREATE_CAR_URL
    const apiKey = process.env.YANGO_CARS_API_KEY
    const clid   = process.env.CLID
    const parkId = process.env.ID_DU_PARTENAIRE

    if (!url || !apiKey || !clid || !parkId) {
      const missing = [!url && "YANGO_CREATE_CAR_URL", !apiKey && "YANGO_CARS_API_KEY", !clid && "CLID", !parkId && "ID_DU_PARTENAIRE"].filter(Boolean)
      return NextResponse.json({ success: false, error: `Variables d'environnement manquantes sur Vercel : ${missing.join(", ")}` }, { status: 500 })
    }

    const body = await req.json()

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type":        "application/json",
        "X-API-Key":           apiKey,
        "X-Client-ID":         clid,
        "X-Park-ID":           parkId,
        "X-Idempotency-Token": randomUUID(),
      },
      body: JSON.stringify(body),
    })

    let data: Record<string, unknown>
    try {
      data = await response.json()
    } catch {
      return NextResponse.json(
        { success: false, error: `Réponse invalide de l'API Yango (HTTP ${response.status})` },
        { status: response.status }
      )
    }

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: (data?.message as string) || JSON.stringify(data) },
        { status: response.status }
      )
    }

    return NextResponse.json({ success: true, vehicle_id: data.vehicle_id })
  } catch (error) {
    console.error("[create-car]", error)
    return NextResponse.json(
      { success: false, error: `Erreur serveur : ${(error as Error).message}` },
      { status: 500 }
    )
  }
}
