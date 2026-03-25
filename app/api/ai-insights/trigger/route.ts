/**
 * /api/ai-insights/trigger
 * Appelle le webhook n8n "Analyse On-demand".
 * n8n fait tout : fetche Supabase, appelle Claude, écrit en base, répond.
 */
import { NextResponse } from "next/server"

export async function POST() {
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
