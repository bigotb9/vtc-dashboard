/**
 * POST /api/compta/operations/regenerer-ecritures
 *
 * Regenere les ecritures comptables des operations validees qui n'ont pas
 * encore d'ecriture liee (`ecriture_id IS NULL`). Reserve directeur.
 *
 * Use case immediat (18/05/2026) : les 462 ops creees par INSERT SQL direct
 * lors du rattrapage manuel n'ont pas d'ecriture comptable. Cet endpoint
 * les rattrape en mode batch.
 *
 * Filtres optionnels :
 *   - source     : filtre operations.source (ex 'recette_wave', 'depense_vehicule')
 *   - date_from  : filtre operations.date_operation >= (YYYY-MM-DD)
 *   - date_to    : filtre operations.date_operation <= (YYYY-MM-DD)
 *   - force      : si true, regenere MEME si ecriture_id est deja rempli (DELETE ancien + INSERT nouveau)
 *                  par defaut false -> skip les ops avec ecriture existante
 *
 * Retour :
 *   { ok: true, data: { generees, echouees, skipped, erreurs[] } }
 *
 * Phase 4.x patch sync legacy -> operations (18/05/2026).
 */

import type { NextRequest } from "next/server"
import { logActivity } from "@/lib/logActivity"
import { requireComptaPermission } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { genererEcritureFromOperation, EcritureError } from "@/lib/compta/ecritures"

export const dynamic     = "force-dynamic"
export const runtime     = "nodejs"
export const maxDuration = 60

const ALLOWED_SOURCES = new Set([
  "manuel", "recette_wave", "depense_vehicule", "versement_client",
  "import_csv", "transfert_interne", "dotation_amort",
])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const PAGE = 500

interface Body {
  source?:    string
  date_from?: string
  date_to?:   string
  force?:     boolean
}

export async function POST(req: NextRequest) {
  const auth = await requireComptaPermission(req, "manage_comptabilite")
  if (!auth.ok) return auth.response

  let body: Body = {}
  try {
    const txt = await req.text()
    if (txt && txt.trim().length > 0) body = JSON.parse(txt)
  } catch {
    return comptaError("INVALID_PAYLOAD", { reason: "JSON malforme" })
  }

  // Validation des filtres
  if (body.source !== undefined && !ALLOWED_SOURCES.has(body.source)) {
    return comptaError("INVALID_PAYLOAD", { field: "source", reason: "valeur non autorisee" })
  }
  if (body.date_from !== undefined && !DATE_RE.test(body.date_from)) {
    return comptaError("INVALID_PAYLOAD", { field: "date_from", reason: "format attendu YYYY-MM-DD" })
  }
  if (body.date_to !== undefined && !DATE_RE.test(body.date_to)) {
    return comptaError("INVALID_PAYLOAD", { field: "date_to", reason: "format attendu YYYY-MM-DD" })
  }
  const force = body.force === true

  const t0 = Date.now()

  // 1. Selection des ops candidates
  // On pagine par tranches de 500 pour eviter les payloads massifs.
  const candidatesIds: string[] = []
  const candidatesWithEcriture: Array<{ id: string; ecriture_id: string }> = []

  let pageFrom = 0
  while (candidatesIds.length + candidatesWithEcriture.length < 10_000) {
    let q = supabaseAdmin
      .from("operations")
      .select("id, ecriture_id")
      .eq("statut", "valide")
      .order("date_operation", { ascending: true })
      .range(pageFrom, pageFrom + PAGE - 1)
    if (body.source)    q = q.eq("source", body.source)
    if (body.date_from) q = q.gte("date_operation", body.date_from)
    if (body.date_to)   q = q.lte("date_operation", body.date_to)

    const { data, error } = await q
    if (error) return comptaError("DB_ERROR", { hint: error.message })
    if (!data || data.length === 0) break

    for (const op of data as Array<{ id: string; ecriture_id: string | null }>) {
      if (op.ecriture_id == null) {
        candidatesIds.push(op.id)
      } else if (force) {
        candidatesWithEcriture.push({ id: op.id, ecriture_id: op.ecriture_id })
      }
      // sinon (ecriture_id non null && !force) : on skippe silencieusement
    }
    if (data.length < PAGE) break
    pageFrom += PAGE
  }

  // 2. Si force=true : supprimer les ecritures existantes des ops ciblees
  if (force && candidatesWithEcriture.length > 0) {
    const ecrIds = candidatesWithEcriture.map(c => c.ecriture_id)
    // On delie d'abord operations.ecriture_id pour eviter une FK en cours.
    const opIdsToUnlink = candidatesWithEcriture.map(c => c.id)
    {
      const { error } = await supabaseAdmin
        .from("operations")
        .update({ ecriture_id: null })
        .in("id", opIdsToUnlink)
      if (error) return comptaError("DB_ERROR", { hint: `Deliage operations.ecriture_id : ${error.message}` })
    }
    // Puis suppression des anciennes ecritures (CASCADE sur lignes_ecritures).
    {
      const { error } = await supabaseAdmin
        .from("ecritures_comptables")
        .delete()
        .in("id", ecrIds)
      if (error) return comptaError("DB_ERROR", { hint: `DELETE anciennes ecritures : ${error.message}` })
    }
    // Et on les ajoute aux candidats a regenerer.
    for (const c of candidatesWithEcriture) candidatesIds.push(c.id)
  }

  // 3. Regeneration sequentielle
  let generees = 0
  let echouees = 0
  const erreurs: Array<{ op_id: string; code: string; message: string }> = []

  for (const opId of candidatesIds) {
    try {
      await genererEcritureFromOperation(opId)
      generees++
    } catch (e) {
      echouees++
      const code    = e instanceof EcritureError ? e.code : "INTERNAL_ERROR"
      const message = (e as Error).message
      if (erreurs.length < 50) {
        erreurs.push({ op_id: opId, code, message })
      }
    }
  }

  const dureeMs = Date.now() - t0

  await logActivity({
    token:   auth.token,
    action:  "compta.operations.regenerer_ecritures",
    entity:  null,
    details: {
      filtres:   { source: body.source ?? null, date_from: body.date_from ?? null, date_to: body.date_to ?? null, force },
      candidats: candidatesIds.length,
      generees,
      echouees,
      duree_ms:  dureeMs,
    },
  })

  return comptaOk({
    candidats:        candidatesIds.length,
    skipped_si_force_false: force ? null : "(ops avec ecriture existante non recomptees sans force=true)",
    generees,
    echouees,
    erreurs,
    duree_ms:         dureeMs,
  })
}
