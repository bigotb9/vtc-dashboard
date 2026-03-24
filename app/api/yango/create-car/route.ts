import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const response = await fetch(process.env.YANGO_CREATE_CAR_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key":           process.env.YANGO_CARS_API_KEY!,
        "X-Client-ID":         process.env.CLID!,
        "X-Park-ID":           process.env.ID_DU_PARTENAIRE!,
        "X-Idempotency-Token": randomUUID(),
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data?.message || JSON.stringify(data) },
        { status: response.status }
      )
    }

    return NextResponse.json({ success: true, vehicle_id: data.vehicle_id })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Erreur serveur lors de la création du véhicule" },
      { status: 500 }
    )
  }
}
