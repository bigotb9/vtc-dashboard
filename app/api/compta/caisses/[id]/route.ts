/**
 * PATCH  /api/compta/caisses/[id]
 * DELETE /api/compta/caisses/[id]
 *
 * Réservé directeur. Référence : doc Phase 2 §5.3 / §5.4.
 *
 * Mêmes règles que pour les comptes :
 *  - PATCH : si solde_initial / date_solde_initial change ET ops antérieures → 409.
 *  - DELETE : ops liées → soft (actif=false), sinon DELETE physique.
 *
 * Cohérence type ↔ operateur revérifiée si l'un des deux change :
 *  - type='cash'         → operateur DOIT être null
 *  - type='mobile_money' → operateur OBLIGATOIRE
 */

import type { NextRequest } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { logActivity } from "@/lib/logActivity"
import { requireComptaPermission } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { caisseUpdateSchema, safeParse } from "@/lib/compta/validators"
import { buildCaisseCompteDetail } from "@/lib/compta/detailHelpers"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

// ─── GET ──────────────────────────────────────────────────────────────────────
// Détail enrichi d'une caisse (Écran 5 Phase 3).
// Renvoie : meta + solde courant + KPIs 12 mois + evolution_solde_12_mois +
// 5 dernières opérations.
export async function GET(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireComptaPermission(req, "view_comptabilite")
  if (!auth.ok) return auth.response

  const { id } = await ctx.params
  try {
    const detail = await buildCaisseCompteDetail({ kind: "caisse", id })
    if (!detail) return comptaError("NOT_FOUND")
    return comptaOk(detail)
  } catch (e) {
    return comptaError("DB_ERROR", { hint: (e as Error).message })
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireComptaPermission(req, "manage_comptabilite")
  if (!auth.ok) return auth.response

  const { id } = await ctx.params

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from("caisses")
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

  const parsed = safeParse(caisseUpdateSchema, payload)
  if (!parsed.ok) return comptaError("INVALID_PAYLOAD", { issues: parsed.details })

  const updates = parsed.data
  if (Object.keys(updates).length === 0) {
    return comptaError("INVALID_PAYLOAD", undefined, "Aucun champ à mettre à jour")
  }

  // Cohérence type ↔ operateur (revérifiée si l'un des deux change)
  const finalType      = updates.type      ?? existing.type
  const finalOperateur = updates.operateur ?? existing.operateur
  if (finalType === "cash" && finalOperateur) {
    return comptaError(
      "INVALID_PAYLOAD",
      { field: "operateur" },
      "Une caisse de type 'cash' ne doit pas avoir d'opérateur",
    )
  }
  if (finalType === "mobile_money" && !finalOperateur) {
    return comptaError(
      "INVALID_PAYLOAD",
      { field: "operateur" },
      "Une caisse de type 'mobile_money' doit avoir un opérateur",
    )
  }

  // Vérifier le code SYSCOHADA si modifié
  if (updates.compte_syscohada_code !== undefined && updates.compte_syscohada_code !== null) {
    const { data: cs } = await supabaseAdmin
      .from("comptes_syscohada")
      .select("code, classe")
      .eq("code", updates.compte_syscohada_code)
      .maybeSingle()
    if (!cs) return comptaError("INVALID_PAYLOAD", { field: "compte_syscohada_code" }, "Code SYSCOHADA inconnu")
    if (cs.classe !== 5) {
      return comptaError(
        "INVALID_PAYLOAD",
        { field: "compte_syscohada_code", classe_recue: cs.classe },
        "Le code SYSCOHADA d'une caisse doit appartenir à la classe 5 (trésorerie)",
      )
    }
  }

  // Si solde_initial ou date_solde_initial changent : 409 si opérations antérieures
  const newDate = updates.date_solde_initial ?? existing.date_solde_initial
  const soldeChange = updates.solde_initial !== undefined && Number(updates.solde_initial) !== Number(existing.solde_initial)
  const dateChange  = updates.date_solde_initial !== undefined && updates.date_solde_initial !== existing.date_solde_initial

  if (soldeChange || dateChange) {
    const { count } = await supabaseAdmin
      .from("operations")
      .select("id", { count: "exact", head: true })
      .eq("caisse_id", id)
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
    .from("caisses")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error || !data) return comptaError("DB_ERROR", { hint: error?.message })

  await logActivity({
    token:   auth.token,
    action:  "compta.caisse.update",
    entity:  id,
    details: { champs_modifies: Object.keys(updates) },
  })

  return comptaOk(data)
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireComptaPermission(req, "manage_comptabilite")
  if (!auth.ok) return auth.response

  const { id } = await ctx.params

  const { data: existing } = await supabaseAdmin
    .from("caisses")
    .select("id, libelle, actif")
    .eq("id", id)
    .maybeSingle()
  if (!existing) return comptaError("NOT_FOUND")

  const { count } = await supabaseAdmin
    .from("operations")
    .select("id", { count: "exact", head: true })
    .eq("caisse_id", id)

  if ((count ?? 0) === 0) {
    const { error } = await supabaseAdmin.from("caisses").delete().eq("id", id)
    if (error) return comptaError("DB_ERROR", { hint: error.message })

    await logActivity({
      token:   auth.token,
      action:  "compta.caisse.delete",
      entity:  id,
      details: { libelle: existing.libelle, mode: "physique" },
    })
    return comptaOk({ deleted: true, mode: "physique" })
  }

  const { data, error } = await supabaseAdmin
    .from("caisses")
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
    action:  "compta.caisse.archive",
    entity:  id,
    details: { libelle: existing.libelle, mode: "soft", operations_liees: count },
  })

  return comptaOk({ ...data, mode: "soft" })
}
