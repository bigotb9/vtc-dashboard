import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"

export async function GET() {
  const { data, error } = await supabase
    .from("chauffeurs")
    .select("id_chauffeur, nom, actif, photo")
    .order("nom")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ chauffeurs: data || [] })
}
