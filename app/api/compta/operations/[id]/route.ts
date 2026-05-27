/**
 * GET    /api/compta/operations/[id]
 * PATCH  /api/compta/operations/[id]
 * DELETE /api/compta/operations/[id]
 *
 * Réservé directeur. Référence : doc Phase 2 §7.3 / §7.6.
 *
 * GET    : détail enrichi (compte, caisse, catégorie, écriture, lignes).
 * PATCH  : update partielle UNIQUEMENT si statut='brouillon' ET source='manuel'.
 *          Mêmes règles de cohérence que POST. La validation/passage en 'valide'
 *          se fait via /api/compta/operations/[id]/valider (Day 5) — PAS ici.
 * DELETE : DELETE physique UNIQUEMENT si statut='brouillon' ET source='manuel'.
 */

import type { NextRequest } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { logActivity } from "@/lib/logActivity"
import { requireDirecteurCompta } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { operationUpdateSchema, safeParse } from "@/lib/compta/validators"
import { getExerciceForDate } from "@/lib/compta/soldes"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

const ENTREE_OK = new Set(["recette", "apport", "autre"])
const SORTIE_OK = new Set(["depense", "reversement", "avance", "investissement", "remboursement", "dotation", "autre"])

// ─── GET (détail) ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  const { id } = await ctx.params

  const { data, error } = await supabaseAdmin
    .from("operations")
    .select(`
      id, date_operation, type, montant, libelle, reference_externe,
      compte_id, caisse_id, categorie_id,
      vehicule_id, chauffeur_id, client_id,
      source, source_ref, statut,
      valide_le, valide_par,
      ecriture_id, exercice_id,
      created_at, created_by, updated_at, updated_by, notes,
      compte:compte_id ( id, libelle, banque ),
      caisse:caisse_id ( id, libelle, type, operateur ),
      categorie:categorie_id ( id, libelle, type, compte_syscohada_code, sens ),
      ecriture:ecriture_id (
        id, numero, journal_code, date_ecriture, libelle, statut,
        lignes_ecritures ( ordre, compte_syscohada_code, libelle, debit, credit )
      ),
      pieces_justificatives ( id, url, nom_fichier, type_mime, taille_octets, created_at )
    `)
    .eq("id", id)
    .maybeSingle()

  if (error) return comptaError("DB_ERROR", { hint: error.message })
  if (!data)  return comptaError("NOT_FOUND")

  return comptaOk(data)
}

// ─── PATCH ────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  const { id } = await ctx.params

  const { data: existing } = await supabaseAdmin
    .from("operations")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (!existing) return comptaError("NOT_FOUND")

  // Parse body
  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return comptaError("INVALID_PAYLOAD", { reason: "JSON malformé" })
  }

  const parsed = safeParse(operationUpdateSchema, payload)
  if (!parsed.ok) return comptaError("INVALID_PAYLOAD", { issues: parsed.details })

  // ─── Phase 4.x Vague 2 — Rétroaction tiers_id sur opérations existantes ───
  //
  // Le champ `tiers_id` (et lui seul) peut être modifié sur n'importe quelle
  // opération, même validée / annulée / issue de reprise. C'est la rétroaction
  // manuelle décrite dans la spec §5.2.
  //
  // Toute autre modification reste soumise aux restrictions standard
  // (brouillon + source manuelle).
  const submittedKeys = Object.keys(parsed.data) as Array<keyof typeof parsed.data>
  const isTiersOnly = submittedKeys.length > 0 && submittedKeys.every(k => k === "tiers_id")
  if (isTiersOnly) {
    const tiersId = parsed.data.tiers_id ?? null
    // Si on lie à un tiers, vérifier qu'il existe et est actif
    if (tiersId) {
      const { data: t } = await supabaseAdmin
        .from("tiers").select("id, actif").eq("id", tiersId).maybeSingle()
      if (!t)       return comptaError("NOT_FOUND",         { field: "tiers_id" }, "Tiers introuvable")
      if (!t.actif) return comptaError("RESOURCE_INVALID",  { field: "tiers_id" }, "Tiers désactivé — choisis un tiers actif")
    }
    const { data, error } = await supabaseAdmin
      .from("operations")
      .update({ tiers_id: tiersId, updated_at: new Date().toISOString(), updated_by: auth.user.id })
      .eq("id", id)
      .select("id, tiers_id")
      .single()
    if (error || !data) return comptaError("DB_ERROR", { hint: error?.message })

    await logActivity({
      token:   auth.token,
      action:  tiersId ? "compta.operation.tiers_lier" : "compta.operation.tiers_delier",
      entity:  id,
      details: { tiers_id: tiersId, retroaction: existing.statut !== "brouillon" || existing.source !== "manuel" },
    })
    return comptaOk(data)
  }

  // ─── Logique standard (modification autres champs) : brouillon + manuel ──
  if (existing.statut === "valide") return comptaError("OPERATION_VALIDATED")
  if (existing.statut === "annule") return comptaError("OPERATION_CANCELLED")
  if (existing.source !== "manuel") {
    return comptaError(
      "CONFLICT",
      { source: existing.source },
      "Les opérations issues de la reprise auto ne se modifient pas individuellement. Modifiez la donnée source.",
    )
  }

  const updates = parsed.data
  if (Object.keys(updates).length === 0) {
    return comptaError("INVALID_PAYLOAD", undefined, "Aucun champ à mettre à jour")
  }

  // Recompute final compte_id / caisse_id pour valider le XOR
  const finalCompte = updates.compte_id !== undefined ? updates.compte_id : existing.compte_id
  const finalCaisse = updates.caisse_id !== undefined ? updates.caisse_id : existing.caisse_id
  const xorOk = (!!finalCompte && !finalCaisse) || (!finalCompte && !!finalCaisse)
  if (!xorOk) {
    return comptaError(
      "INVALID_PAYLOAD",
      { compte_id: finalCompte, caisse_id: finalCaisse },
      "Doit fournir EXACTEMENT un de compte_id OU caisse_id",
    )
  }

  // Si compte/caisse changent → vérifier l'activité
  if (updates.compte_id !== undefined && updates.compte_id !== null) {
    const { data: c } = await supabaseAdmin
      .from("comptes").select("id, actif").eq("id", updates.compte_id).maybeSingle()
    if (!c)       return comptaError("NOT_FOUND", { field: "compte_id" })
    if (!c.actif) return comptaError("ACCOUNT_INACTIVE", { compte_id: c.id })
  }
  if (updates.caisse_id !== undefined && updates.caisse_id !== null) {
    const { data: c } = await supabaseAdmin
      .from("caisses").select("id, actif").eq("id", updates.caisse_id).maybeSingle()
    if (!c)       return comptaError("NOT_FOUND", { field: "caisse_id" })
    if (!c.actif) return comptaError("ACCOUNT_INACTIVE", { caisse_id: c.id })
  }

  // Si catégorie change → existence + activité + cohérence type
  const finalCategorieId = updates.categorie_id ?? existing.categorie_id
  const finalType        = updates.type         ?? existing.type
  if (updates.categorie_id || updates.type) {
    const { data: cat } = await supabaseAdmin
      .from("categories_operations")
      .select("id, type, actif")
      .eq("id", finalCategorieId)
      .maybeSingle()
    if (!cat)       return comptaError("NOT_FOUND", { field: "categorie_id" })
    if (!cat.actif) return comptaError("CATEGORY_INACTIVE", { categorie_id: cat.id })
    if (finalType === "entree" && !ENTREE_OK.has(cat.type)) {
      return comptaError("INVALID_PAYLOAD", { hint: "type/categorie incompatible" })
    }
    if (finalType === "sortie" && !SORTIE_OK.has(cat.type)) {
      return comptaError("INVALID_PAYLOAD", { hint: "type/categorie incompatible" })
    }
  }

  // Si la date change → réévaluer exercice / clôture
  let newExerciceId = existing.exercice_id
  if (updates.date_operation && updates.date_operation !== existing.date_operation) {
    let ex
    try {
      ex = await getExerciceForDate(updates.date_operation)
    } catch (e) {
      return comptaError("INVALID_PAYLOAD", { hint: (e as Error).message }, "Aucun exercice pour cette date")
    }
    if (ex.cloture) return comptaError("EXERCICE_CLOSED", { exercice_id: ex.id })
    const periodeMois = updates.date_operation.slice(0, 7)
    const { data: cloture } = await supabaseAdmin
      .from("clotures")
      .select("id")
      .eq("exercice_id", ex.id)
      .eq("type", "mensuelle")
      .eq("periode", periodeMois)
      .maybeSingle()
    if (cloture) return comptaError("PERIOD_CLOSED", { periode: periodeMois })
    newExerciceId = ex.id
  }

  const { data, error } = await supabaseAdmin
    .from("operations")
    .update({
      ...updates,
      // Forcer la cohérence XOR si compte_id/caisse_id reset
      compte_id:   finalCompte ?? null,
      caisse_id:   finalCaisse ?? null,
      exercice_id: newExerciceId,
      updated_at:  new Date().toISOString(),
      updated_by:  auth.user.id,
    })
    .eq("id", id)
    .select()
    .single()

  if (error || !data) return comptaError("DB_ERROR", { hint: error?.message })

  await logActivity({
    token:   auth.token,
    action:  "compta.operation.update",
    entity:  id,
    details: { champs_modifies: Object.keys(updates) },
  })

  return comptaOk(data)
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  const { id } = await ctx.params

  const { data: existing } = await supabaseAdmin
    .from("operations")
    .select("id, statut, source, libelle")
    .eq("id", id)
    .maybeSingle()
  if (!existing) return comptaError("NOT_FOUND")

  if (existing.statut !== "brouillon") {
    return comptaError("OPERATION_VALIDATED", { statut: existing.statut })
  }
  if (existing.source !== "manuel") {
    return comptaError(
      "CONFLICT",
      { source: existing.source },
      "Une opération issue de la reprise auto ne peut être supprimée individuellement",
    )
  }

  const { error } = await supabaseAdmin.from("operations").delete().eq("id", id)
  if (error) return comptaError("DB_ERROR", { hint: error.message })

  await logActivity({
    token:   auth.token,
    action:  "compta.operation.delete",
    entity:  id,
    details: { libelle: existing.libelle },
  })

  return comptaOk({ deleted: true, mode: "physique" })
}
