import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"

export async function PATCH(req: NextRequest) {
  const { id, ...fields } = await req.json()

  if (!id) {
    return NextResponse.json({ success: false, error: "id manquant" }, { status: 400 })
  }

  const { error } = await supabase
    .from("vehicules")
    .update(fields)
    .eq("id_vehicule", id)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
