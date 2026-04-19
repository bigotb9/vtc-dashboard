import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/clients/versements?id_client=X
export async function GET(req: NextRequest) {
  try {
    const id_client = req.nextUrl.searchParams.get("id_client")
    if (!id_client) return NextResponse.json({ ok: false, error: "id_client manquant" }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from("versements_clients")
      .select("*")
      .eq("id_client", id_client)
      .order("mois", { ascending: false })

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, versements: data || [] })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

// POST /api/clients/versements — upsert (marquer payé)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { id_client, mois, montant, date_versement, notes } = body

    if (!id_client || !mois || montant == null) {
      return NextResponse.json({ ok: false, error: "Champs requis : id_client, mois, montant" }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from("versements_clients")
      .upsert(
        { id_client, mois, montant, date_versement: date_versement || new Date().toISOString().slice(0, 10), notes: notes || null },
        { onConflict: "id_client,mois" }
      )
      .select()
      .single()

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, versement: data })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}

// DELETE /api/clients/versements?id_client=X&mois=2026-03
export async function DELETE(req: NextRequest) {
  try {
    const id_client = req.nextUrl.searchParams.get("id_client")
    const mois      = req.nextUrl.searchParams.get("mois")
    if (!id_client || !mois) return NextResponse.json({ ok: false, error: "Paramètres manquants" }, { status: 400 })

    const { error } = await supabaseAdmin
      .from("versements_clients")
      .delete()
      .eq("id_client", id_client)
      .eq("mois", mois)

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
