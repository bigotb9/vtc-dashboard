import { NextResponse } from "next/server"

export async function GET() {
  try {
    const url    = process.env.YANGO_DRIVERS_URL
    const apiKey = process.env.YANGO_DRIVERS_API_KEY
    const clid   = process.env.CLID
    const parkId = process.env.ID_DU_PARTENAIRE

    if (!url || !apiKey || !clid || !parkId) {
      const missing = [!url && "YANGO_DRIVERS_URL", !apiKey && "YANGO_DRIVERS_API_KEY", !clid && "CLID", !parkId && "ID_DU_PARTENAIRE"].filter(Boolean)
      return NextResponse.json({ error: `Variables d'environnement manquantes: ${missing.join(", ")}` }, { status: 500 })
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type":    "application/json",
        "X-API-Key":       apiKey,
        "X-Client-ID":     clid,
        "X-Park-ID":       parkId,
        "Accept-Language": "fr",
      },
      body: JSON.stringify({
        query: { park: { id: parkId } },
        limit: 1000,
        offset: 0,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.message || JSON.stringify(data) },
        { status: response.status }
      )
    }

    type DriverProfile = {
      driver_profile?: {
        id?: string
        last_name?: string
        first_name?: string
        phones?: string[]
        work_status?: string
      }
      current_status?: { status?: string }
      car?: { brand?: string; model?: string; number?: string }
      accounts?: { balance?: string }[]
    }

    const drivers = (data.driver_profiles || []).map((d: DriverProfile) => ({
      id:          d.driver_profile?.id,
      nom:         d.driver_profile?.last_name,
      prenom:      d.driver_profile?.first_name,
      telephone:   d.driver_profile?.phones?.[0] || "N/A",
      statut:      d.current_status?.status,
      work_status: d.driver_profile?.work_status,
      vehicle:     d.car ? `${d.car.brand} ${d.car.model}` : "Aucun véhicule",
      plaque:      d.car?.number || "-",
      solde:       d.accounts?.[0]?.balance || "0",
    }))

    return NextResponse.json({ drivers })
  } catch (error) {
    console.error("[drivers]", error)
    return NextResponse.json(
      { error: `Erreur serveur: ${(error as Error).message}` },
      { status: 500 }
    )
  }
}
