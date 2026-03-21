import { NextResponse } from "next/server"

export async function GET() {
  try {
    const response = await fetch(process.env.YANGO_WORK_RULES_URL!, {
      method: "GET",
      headers: {
        "X-API-Key": process.env.WORK_RULE_API_KEY!,
        "X-Client-ID": process.env.CLID!,
        "X-Park-ID": process.env.ID_DU_PARTENAIRE!,
      },
    })

    const data = await response.json()

    console.log("WORK RULES RAW:", data) // 🔥 DEBUG

    if (!response.ok) {
      return NextResponse.json({ error: data }, { status: response.status })
    }

    const workRules = data?.work_rules || data?.items || data?.rules || []

    return NextResponse.json(workRules)
  } catch (error) {
    return NextResponse.json(
      { error: "Erreur récupération work rules" },
      { status: 500 }
    )
  }
}