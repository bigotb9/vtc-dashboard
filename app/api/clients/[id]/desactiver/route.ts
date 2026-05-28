/**
 * POST /api/clients/[id]/desactiver
 *
 * Soft-delete d'un Client. Refuse l'operation si des versements en retard
 * subsistent (statut metier "regularise avant fermeture").
 *
 * Body : { reactiver?: boolean }  -> si true, reactive (actif = TRUE)
 *
 * Ajoute le 23/05/2026 (QW3 + E3).
 */

import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { logActivity } from "@/lib/logActivity"
import { requirePermission } from "@/lib/requirePermission"

// Auth restauree le 26/05/2026 (Lot A securite) : requirePermission("manage_clients").
// Le retrait du 24/05/2026 exposait la route en POST anonyme.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, "delete_client")
  if (!auth.ok) return auth.response

  const token = req.headers.get("authorization")?.replace("Bearer ", "") || ""

  const { id } = await ctx.params
  const idNum = Number(id)
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ ok: false, error: "ID invalide" }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const reactiver = body.reactiver === true

  if (reactiver) {
    const { error } = await supabaseAdmin
      .from("clients")
      .update({ actif: true })
      .eq("id", idNum)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    await logActivity({
      token,
      action: "client.reactive",
      entity: String(idNum),
      details: { id_client: idNum },
    })
    return NextResponse.json({ ok: true, actif: true })
  }

  // Desactivation : verifier qu'aucun versement n'est en retard
  // On regarde les mois N-2 a N (= versements typiquement passes/courants).
  const today = new Date()
  const ymCurrent = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`

  // Recupere tous les mois pour lesquels le client devrait avoir verse
  // (= mois ou il avait au moins 1 vehicule sous gestion)
  const { data: vehicules } = await supabaseAdmin
    .from("vehicules")
    .select("id_vehicule, sous_gestion, montant_mensuel_client")
    .eq("id_client", idNum)
    .eq("sous_gestion", true)

  if (!vehicules || vehicules.length === 0) {
    // Pas de vehicule sous gestion -> on peut desactiver tranquillement
    const { error } = await supabaseAdmin
      .from("clients")
      .update({ actif: false })
      .eq("id", idNum)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    await logActivity({ token, action: "client.desactive", entity: String(idNum), details: { id_client: idNum, raison: "aucun vehicule" } })
    return NextResponse.json({ ok: true, actif: false })
  }

  // Versements deja saisis sur les 6 derniers mois
  const moisLimits: string[] = []
  for (let i = 1; i <= 6; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    moisLimits.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }
  const { data: versements } = await supabaseAdmin
    .from("versements_clients")
    .select("mois")
    .eq("id_client", idNum)
    .in("mois", moisLimits)

  const moisVerses = new Set((versements || []).map(v => v.mois))

  // Definition du retard : mois fini + apres le 10 du suivant + non verse
  const j10ThisMonth = new Date(today.getFullYear(), today.getMonth(), 10, 23, 59, 59)
  const moisEnRetard: string[] = []
  for (const ym of moisLimits) {
    const [y, m] = ym.split("-").map(Number)
    const finMois  = new Date(y, m, 0, 23, 59, 59)
    const jour10Next = new Date(y, m, 10, 23, 59, 59)
    if (today > jour10Next && !moisVerses.has(ym)) {
      // Mois pour lequel la fenetre paiement est passee sans versement
      moisEnRetard.push(ym)
    }
  }

  if (moisEnRetard.length > 0) {
    return NextResponse.json({
      ok: false,
      error: "Impossible de desactiver : versements en retard non regularises.",
      code: "VERSEMENTS_EN_RETARD",
      mois_en_retard: moisEnRetard,
    }, { status: 409 })
  }

  const { error } = await supabaseAdmin
    .from("clients")
    .update({ actif: false })
    .eq("id", idNum)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  await logActivity({
    token,
    action: "client.desactive",
    entity: String(idNum),
    details: { id_client: idNum },
  })

  return NextResponse.json({ ok: true, actif: false })
}
