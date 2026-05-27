/**
 * /api/ai-insights/trigger
 * Appelle le webhook n8n "Analyse On-demand".
 * n8n fait tout : fetche Supabase, appelle Claude, écrit en base, répond.
 */
import { NextRequest, NextResponse } from "next/server"
import { requirePermission } from "@/lib/requirePermission"

// Auth Lot Z (26/05/2026 audit) : requirePermission("view_ai_insights") — la
// route etait ouverte (finding 2.4) et declenche un appel Claude via n8n
// (cout API + temps de calcul prolonge jusqu'a 3 minutes).

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, "view_ai_insights")
  if (!auth.ok) return auth.response

  const webhookUrl = process.env.N8N_WEBHOOK_ANALYSE_URL

  if (!webhookUrl) {
    return NextResponse.json(
      { ok: false, error: "N8N_WEBHOOK_ANALYSE_URL non configuré dans .env.local" },
      { status: 503 }
    )
  }

  try {
    const res = await fetch(webhookUrl, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ source: "vtc-dashboard", triggered_by: "manual" }),
      // n8n répond quand l'analyse est finie — timeout 3 min
      signal:  AbortSignal.timeout(180_000),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { ok: false, error: `n8n a répondu ${res.status}: ${text}` },
        { status: 502 }
      )
    }

    const data = await res.json()
    return NextResponse.json({ ok: true, ...data })

  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    )
  }
}
