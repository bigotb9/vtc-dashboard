import { NextResponse } from "next/server"

export async function GET() {
  try {
    const url    = process.env.YANGO_WORK_RULES_URL
    const apiKey = process.env.WORK_RULE_API_KEY
    const clid   = process.env.CLID
    const parkId = process.env.ID_DU_PARTENAIRE

    if (!url || !apiKey || !clid || !parkId) {
      const missing = [!url && "YANGO_WORK_RULES_URL", !apiKey && "WORK_RULE_API_KEY", !clid && "CLID", !parkId && "ID_DU_PARTENAIRE"].filter(Boolean)
      return NextResponse.json({ error: `Variables d'environnement manquantes: ${missing.join(", ")}` }, { status: 500 })
    }

    const response = await fetch(`${url}?park_id=${parkId}`, {
      method: "GET",
      headers: {
        "X-API-Key":   apiKey,
        "X-Client-ID": clid,
        "X-Park-ID":   parkId,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json({ error: data }, { status: response.status })
    }

    const rules =
      data?.rules ||
      data?.work_rules ||
      data?.items ||
      data?.result ||
      []

    return NextResponse.json(rules)
  } catch (error) {
    console.error("[work-rules]", error)
    return NextResponse.json(
      { error: `Erreur récupération work rules: ${(error as Error).message}` },
      { status: 500 }
    )
  }
}
