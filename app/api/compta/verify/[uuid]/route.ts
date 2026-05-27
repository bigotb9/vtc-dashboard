/**
 * GET /api/compta/verify/[uuid]  (Phase 4.2 §6.5)
 *
 * Route PUBLIQUE (pas d'auth). Permet à un tiers (DGI, banque, auditeur)
 * de vérifier l'authenticité d'un PDF Bilan ou CR imprimé en saisissant
 * l'UUID inscrit en pied de page.
 *
 * Retourne :
 *   { type_etat, hash_sha256, exercice_libelle, date_arrete,
 *     raison_sociale, resultat_net, genere_at }
 *
 * Aucune donnée sensible (montants détaillés) n'est exposée — uniquement
 * le hash + résumé pour comparaison.
 */

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteCtx = { params: Promise<{ uuid: string }> }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const { uuid } = await ctx.params
  if (!UUID_RE.test(uuid)) {
    return NextResponse.json({ error: "UUID invalide" }, { status: 400 })
  }

  // On utilise la fonction RPC `verify_etat_financier` (SECURITY DEFINER, public)
  const { data, error } = await supabaseAdmin.rpc("verify_etat_financier", { p_uuid: uuid })
  if (error) {
    return NextResponse.json({ error: "Erreur de vérification" }, { status: 500 })
  }
  const row = Array.isArray(data) && data.length > 0 ? data[0] : null
  if (!row) {
    return NextResponse.json({ error: "Document introuvable", verified: false }, { status: 404 })
  }
  return NextResponse.json({
    verified:         true,
    type_etat:        row.type_etat,
    hash_sha256:      row.hash_sha256,
    exercice_libelle: row.exercice_libelle,
    date_arrete:      row.date_arrete,
    raison_sociale:   row.raison_sociale,
    resultat_net:     row.resultat_net != null ? Number(row.resultat_net) : null,
    genere_at:        row.genere_at,
  }, { status: 200, headers: { "Cache-Control": "no-store" } })
}
