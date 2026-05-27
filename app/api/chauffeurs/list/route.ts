import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"
import { requirePermission } from "@/lib/requirePermission"

// Auth Lot Z (26/05/2026 audit) : requirePermission("view_fleet") — la route
// etait ouverte (finding 2.4), exposant l'identite de tous les chauffeurs.

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "view_fleet")
  if (!auth.ok) return auth.response

  const { data, error } = await supabase
    .from("chauffeurs")
    .select("id_chauffeur, nom, actif, photo")
    .order("nom")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ chauffeurs: data || [] })
}
