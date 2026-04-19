import { NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"

export async function GET() {
  const { data, error } = await supabase
    .from("vehicules")
    .select("id_vehicule, immatriculation, type_vehicule, statut, photo")
    .order("immatriculation")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ vehicules: data || [] })
}
