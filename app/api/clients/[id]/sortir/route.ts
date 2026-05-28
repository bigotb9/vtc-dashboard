/**
 * POST /api/clients/[id]/sortir
 *
 * Workflow complet de sortie d'un Client (E3) :
 *   1. Verifications prerequis (versements regularises)
 *   2. Soft-delete du Client (actif = FALSE)
 *   3. Gestion des vehicules selon le choix :
 *      - "hors_gestion" : vehicules.sous_gestion = FALSE (vehicules restent au Client)
 *      - "transferer"   : vehicules.id_client = nouveau_client_id (transferer a autre Client)
 *      - "retirer"      : vehicules.id_client = NULL + sous_gestion = FALSE
 *   4. Generation du PDF "Etat des comptes a la sortie"
 *   5. Archivage du PDF dans le bucket clients-docs (table clients_documents)
 *
 * Body : { sort_vehicules: 'hors_gestion' | 'transferer' | 'retirer', nouveau_client_id?: number }
 *
 * Ajoute le 23/05/2026 (E3 module Clients enrichi).
 */

import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { logActivity } from "@/lib/logActivity"
import { genererEtatComptesSortie } from "@/lib/clients/genererPdfClient"
import { requirePermission } from "@/lib/requirePermission"

// Auth restauree le 26/05/2026 (Lot A securite) : requirePermission("manage_clients").

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SortVehicules = "hors_gestion" | "transferer" | "retirer"

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
  const sortVehicules = body.sort_vehicules as SortVehicules
  const nouveauClientId = body.nouveau_client_id ? Number(body.nouveau_client_id) : null

  if (!["hors_gestion", "transferer", "retirer"].includes(sortVehicules)) {
    return NextResponse.json({ ok: false, error: "sort_vehicules invalide" }, { status: 400 })
  }
  if (sortVehicules === "transferer" && !nouveauClientId) {
    return NextResponse.json({ ok: false, error: "nouveau_client_id requis pour transferer" }, { status: 400 })
  }

  // 1. Verification prerequis (versements en retard)
  const today = new Date()
  const moisLimits: string[] = []
  for (let i = 1; i <= 6; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    moisLimits.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }
  const { data: versements } = await supabaseAdmin
    .from("versements_clients").select("mois").eq("id_client", idNum).in("mois", moisLimits)
  const moisVerses = new Set((versements || []).map(v => v.mois))
  const moisEnRetard: string[] = []
  for (const ym of moisLimits) {
    const [y, m] = ym.split("-").map(Number)
    const jour10Next = new Date(y, m, 10, 23, 59, 59)
    if (today > jour10Next && !moisVerses.has(ym)) moisEnRetard.push(ym)
  }
  if (moisEnRetard.length > 0) {
    return NextResponse.json({
      ok: false,
      error: "Impossible de sortir le Client : versements en retard non regularises.",
      code: "VERSEMENTS_EN_RETARD",
      mois_en_retard: moisEnRetard,
    }, { status: 409 })
  }

  // 2. Recuperation des vehicules en gestion
  const { data: vehicules } = await supabaseAdmin
    .from("vehicules")
    .select("id_vehicule")
    .eq("id_client", idNum)
    .eq("sous_gestion", true)

  // 3. Gestion des vehicules
  if (vehicules && vehicules.length > 0) {
    const ids = vehicules.map(v => v.id_vehicule)
    if (sortVehicules === "hors_gestion") {
      await supabaseAdmin.from("vehicules").update({ sous_gestion: false }).in("id_vehicule", ids)
    } else if (sortVehicules === "transferer" && nouveauClientId) {
      await supabaseAdmin.from("vehicules").update({ id_client: nouveauClientId }).in("id_vehicule", ids)
    } else if (sortVehicules === "retirer") {
      await supabaseAdmin.from("vehicules").update({ id_client: null, sous_gestion: false }).in("id_vehicule", ids)
    }
  }

  // 4. Soft-delete du Client
  const { error: dErr } = await supabaseAdmin.from("clients").update({ actif: false }).eq("id", idNum)
  if (dErr) return NextResponse.json({ ok: false, error: dErr.message }, { status: 500 })

  // 5. Generation du PDF "Etat des comptes"
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await genererEtatComptesSortie({ id_client: idNum, appUrl })
  } catch (e) {
    // En cas d'echec PDF : on garde la sortie mais on signale a l'UI
    await logActivity({ token, action: "client.sortie.pdf_failed", entity: String(idNum), details: { error: (e as Error).message } })
    return NextResponse.json({
      ok: true,
      warning: "Sortie effectuee, mais PDF Etat des comptes non genere.",
      pdf_failed: true,
    })
  }

  // 6. Upload dans Supabase Storage
  const storagePath = `${idNum}/etat-comptes-sortie-${Date.now()}.pdf`
  const { error: upErr } = await supabaseAdmin.storage
    .from("clients-docs")
    .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: false })
  if (upErr) {
    return NextResponse.json({
      ok: true,
      warning: "Sortie effectuee, mais PDF non archive : " + upErr.message,
    })
  }

  // 7. Reference dans clients_documents
  await supabaseAdmin.from("clients_documents").insert({
    id_client:   idNum,
    type:        "etat_comptes_sortie",
    nom_fichier: `Etat-comptes-sortie-${new Date().toISOString().slice(0,10)}.pdf`,
    storage_path: storagePath,
    taille:      pdfBuffer.length,
    mime_type:   "application/pdf",
    auto_genere: true,
  })

  await logActivity({
    token,
    action: "client.sortie",
    entity: String(idNum),
    details: { sort_vehicules: sortVehicules, nb_vehicules: vehicules?.length || 0 },
  })

  return NextResponse.json({ ok: true, pdf_path: storagePath })
}
