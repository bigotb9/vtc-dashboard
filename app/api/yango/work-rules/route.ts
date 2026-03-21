import { NextResponse } from "next/server"

export async function GET() {
  try {
    const response = await fetch(
      `${process.env.YANGO_WORK_RULES_URL}?park_id=${process.env.ID_DU_PARTENAIRE}`,
      {
        method: "GET",
        headers: {
          "X-API-Key": process.env.WORK_RULE_API_KEY!,
          "X-Client-ID": process.env.CLID!,
        },
      }
    )

    const data = await response.json()

    console.log("WORK RULES RAW:", data)

    if (!response.ok) {
      return NextResponse.json(
        { error: data },
        { status: response.status }
      )
    }

    // 🔥 STRUCTURE YANGO
    const rules =
      data?.rules ||
      data?.work_rules ||
      data?.items ||
      data?.result ||
      []

    return NextResponse.json(rules)

  } catch (error) {
    return NextResponse.json(
      { error: "Erreur récupération work rules" },
      { status: 500 }
    )
  }
}