import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { requirePermission } from "@/lib/requirePermission"

// Auth Lot Z (26/05/2026 audit) : requirePermission("view_fleet") — la route
// etait ouverte (finding 2.4), exposant la liste complete de la flotte.

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "view_fleet")
  if (!auth.ok) return auth.response

  const { data, error } = await supabaseAdmin
    .from("vehicules")
    .select("id_vehicule, immatriculation, type_vehicule, statut, photo")
    .order("immatriculation")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ vehicules: data || [] })
}
