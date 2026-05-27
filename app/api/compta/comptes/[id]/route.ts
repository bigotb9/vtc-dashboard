/**
 * PATCH  /api/compta/comptes/[id]
 * DELETE /api/compta/comptes/[id]
 *
 * Réservé directeur. Référence : doc Phase 2 §4.3 / §4.4.
 *
 * PATCH : mise à jour partielle. Si solde_initial ou date_solde_initial change ET
 *         qu'il existe au moins une opération validée antérieure à la nouvelle
 *         date_solde_initial → 409 CONFLICT.
 *
 * DELETE : si aucune opération liée → DELETE physique. Sinon → soft delete
 *          (actif=false, archive_le, archive_par).
 */

import type { NextRequest } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { logActivity } from "@/lib/logActivity"
import { requireDirecteurCompta } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { compteUpdateSchema, safeParse } from "@/lib/compta/validators"
import { buildCaisseCompteDetail } from "@/lib/compta/detailHelpers"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

// ─── GET ──────────────────────────────────────────────────────────────────────
// Détail enrichi d'un compte bancaire (Écran 5 Phase 3).
export async function GET(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  const { id } = await ctx.params
  try {
    const detail = await buildCaisseCompteDetail({ kind: "compte", id })
    if (!detail) return comptaError("NOT_FOUND")
    return comptaOk(detail)
  } catch (e) {
    return comptaError("DB_ERROR", { hint: (e as Error).message })
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  const { id } = await ctx.params

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from("comptes")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (fetchErr) return comptaError("DB_ERROR", { hint: fetchErr.message })
  if (!existing) return comptaError("NOT_FOUND")

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return comptaError("INVALID_PAYLOAD", { reason: "JSON malformé" })
  }

  const parsed = safeParse(compteUpdateSchema, payload)
  if (!parsed.ok) return comptaError("INVALID_PAYLOAD", { issues: parsed.details })

  const updates = parsed.data
  if (Object.keys(updates).length === 0) {
    return comptaError("INVALID_PAYLOAD", undefined, "Aucun champ à mettre à jour")
  }

  // Vérifier le code SYSCOHADA si modifié
  if (updates.compte_syscohada_code !== undefined && updates.compte_syscohada_code !== null) {
    const { data: cs } = await supabaseAdmin
      .from("comptes_syscohada")
      .select("code, classe")
      .eq("code", updates.compte_syscohada_code)
      .maybeSingle()
    if (!cs) {
      return comptaError("INVALID_PAYLOAD", { field: "compte_syscohada_code" }, "Code SYSCOHADA inconnu")
    }
    if (cs.classe !== 5) {
      return comptaError(
        "INVALID_PAYLOAD",
        { field: "compte_syscohada_code", classe_recue: cs.classe },
        "Le code SYSCOHADA d'un compte bancaire doit appartenir à la classe 5 (trésorerie)",
      )
    }
  }

  // Si solde_initial ou date_solde_initial changent, vérifier qu'aucune opération
  // validée n'existe avant la nouvelle date_solde_initial.
  const newDate = updates.date_solde_initial ?? existing.date_solde_initial
  const soldeChange = updates.solde_initial !== undefined && Number(updates.solde_initial) !== Number(existing.solde_initial)
  const dateChange  = updates.date_solde_initial !== undefined && updates.date_solde_initial !== existing.date_solde_initial

  if (soldeChange || dateChange) {
    const { count } = await supabaseAdmin
      .from("operations")
      .select("id", { count: "exact", head: true })
      .eq("compte_id", id)
      .eq("statut", "valide")
      .lt("date_operation", newDate)
    if ((count ?? 0) > 0) {
      return comptaError(
        "CONFLICT",
        { operations_anterieures: count, date_solde: newDate },
        "Impossible de modifier le solde initial : des opérations validées existent avant cette date",
      )
    }
  }

  const { data, error } = await supabaseAdmin
    .from("comptes")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error || !data) return comptaError("DB_ERROR", { hint: error?.message })

  await logActivity({
    token:   auth.token,
    action:  "compta.compte.update",
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
    .from("comptes")
    .select("id, libelle, actif")
    .eq("id", id)
    .maybeSingle()
  if (!existing) return comptaError("NOT_FOUND")

  // Y a-t-il des opérations liées (toutes statuts confondus) ?
  const { count } = await supabaseAdmin
    .from("operations")
    .select("id", { count: "exact", head: true })
    .eq("compte_id", id)

  if ((count ?? 0) === 0) {
    // DELETE physique
    const { error } = await supabaseAdmin.from("comptes").delete().eq("id", id)
    if (error) return comptaError("DB_ERROR", { hint: error.message })

    await logActivity({
      token:   auth.token,
      action:  "compta.compte.delete",
      entity:  id,
      details: { libelle: existing.libelle, mode: "physique" },
    })
    return comptaOk({ deleted: true, mode: "physique" })
  }

  // Soft delete : archive
  const { data, error } = await supabaseAdmin
    .from("comptes")
    .update({
      actif:       false,
      archive_le:  new Date().toISOString(),
      archive_par: auth.user.id,
    })
    .eq("id", id)
    .select()
    .single()

  if (error || !data) return comptaError("DB_ERROR", { hint: error?.message })

  await logActivity({
    token:   auth.token,
    action:  "compta.compte.archive",
    entity:  id,
    details: { libelle: existing.libelle, mode: "soft", operations_liees: count },
  })

  return comptaOk({ ...data, mode: "soft" })
}
