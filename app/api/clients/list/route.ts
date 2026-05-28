/**
 * GET /api/clients/list
 *
 * Liste légère des clients investisseurs pour les sélecteurs UI
 * (formulaire de saisie d'opération, filtres, etc.).
 *
 * Contrairement à /api/clients qui agrège revenus/dépenses sur un mois donné,
 * ce endpoint renvoie juste { id, nom } sans calculs lourds.
 */

import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"
import { requirePermission } from "@/lib/requirePermission"

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "view_clients")
  if (!auth.ok) return auth.response

  const { data, error } = await supabase
    .from("clients")
    .select("id, nom")
    .order("nom", { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ clients: data ?? [] })
}
