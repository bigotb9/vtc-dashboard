import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"

export async function POST(req: NextRequest) {

  const rows = await req.json()

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ success: false, error: "Fichier CSV vide ou invalide" }, { status: 400 })
  }

  // Supabase insert by chunks of 500 to avoid payload limits
  const chunkSize = 500
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await supabase
      .from("recettes_wave")
      .upsert(chunk, { onConflict: "Identifiant de transaction" })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
  }

  return NextResponse.json({ success: true, count: rows.length })
}
