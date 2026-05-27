/**
 * PATCH  /api/compta/categories/[id]
 * DELETE /api/compta/categories/[id]
 *
 * Réservé directeur. Référence : doc Phase 2 §6.3 / §6.4.
 *
 * Règle critique (§6.3) :
 *   Quand le mapping d'une catégorie change, les écritures déjà générées sur
 *   les opérations passées ne sont PAS rééditées. Les NOUVELLES opérations
 *   utiliseront le nouveau mapping. C'est intentionnel pour préserver
 *   l'historique comptable.
 *
 * DELETE : ops liées → soft (actif=false), sinon DELETE physique.
 */

import type { NextRequest } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { logActivity } from "@/lib/logActivity"
import { requireDirecteurCompta } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { categorieUpdateSchema, safeParse } from "@/lib/compta/validators"
import { checkMappingCoherence } from "../route"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

// ─── GET ──────────────────────────────────────────────────────────────────────
// Détail enrichi d'une catégorie (Écran 6 Phase 3 §4.7).
// Renvoie : meta + mapping SYSCOHADA + journal + 4 stats d'usage (volume,
// nb_ops, montant_moyen, dernière utilisation) + 5 dernières opérations.
export async function GET(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  const { id } = await ctx.params

  // 1. Catégorie + mapping joints
  const { data: cat, error: catErr } = await supabaseAdmin
    .from("categories_operations")
    .select(`
      id, libelle, type, sens, compte_syscohada_code, journal_par_defaut,
      actif, ordre, description, created_at,
      compte_syscohada:compte_syscohada_code ( libelle, classe ),
      journal:journal_par_defaut ( libelle )
    `)
    .eq("id", id)
    .maybeSingle()
  if (catErr) return comptaError("DB_ERROR", { hint: catErr.message })
  if (!cat)   return comptaError("NOT_FOUND")

  // 2. Stats agrégées (volume, nb, moyenne, première/dernière utilisation)
  let volume_cumule       = 0
  let nb_operations       = 0
  let premiere_utilisation: string | null = null
  let derniere_utilisation: string | null = null
  {
    const PAGE = 5000
    let from = 0
    while (from < 1_000_000) {
      const { data, error } = await supabaseAdmin
        .from("operations")
        .select("montant, date_operation")
        .eq("categorie_id", id)
        .eq("statut", "valide")
        .range(from, from + PAGE - 1)
      if (error) return comptaError("DB_ERROR", { hint: error.message })
      if (!data || data.length === 0) break
      for (const o of data) {
        nb_operations += 1
        volume_cumule += Number(o.montant || 0)
        const dop = String(o.date_operation)
        if (!premiere_utilisation || dop < premiere_utilisation) premiere_utilisation = dop
        if (!derniere_utilisation || dop > derniere_utilisation) derniere_utilisation = dop
      }
      if (data.length < PAGE) break
      from += PAGE
    }
  }
  const montant_moyen = nb_operations > 0 ? volume_cumule / nb_operations : 0

  // 3. 5 dernières opérations
  const { data: lastOpsRaw } = await supabaseAdmin
    .from("operations")
    .select(`
      id, date_operation, libelle, type, montant, caisse_id, compte_id,
      caisse:caisse_id ( libelle, code ),
      compte:compte_id ( libelle, code )
    `)
    .eq("categorie_id", id)
    .eq("statut", "valide")
    .order("date_operation", { ascending: false })
    .order("created_at",     { ascending: false })
    .limit(5)

  const dernieres_operations = (lastOpsRaw ?? []).map(o => {
    const caisse = o.caisse as { libelle?: string; code?: string | null } | null
    const compte = o.compte as { libelle?: string; code?: string | null } | null
    return {
      id:              String(o.id),
      date_operation:  o.date_operation,
      libelle:         o.libelle,
      type:            o.type as "entree" | "sortie",
      montant:         Number(o.montant),
      caisse_libelle:  caisse?.libelle ?? compte?.libelle ?? null,
      caisse_code:     caisse?.code    ?? compte?.code    ?? null,
    }
  })

  return comptaOk({
    id:                       cat.id,
    libelle:                  cat.libelle,
    type:                     cat.type,
    sens:                     cat.sens,
    compte_syscohada_code:    cat.compte_syscohada_code,
    compte_syscohada_libelle: (cat.compte_syscohada as { libelle?: string } | null)?.libelle ?? null,
    compte_syscohada_classe:  (cat.compte_syscohada as { classe?: number } | null)?.classe ?? null,
    journal_par_defaut:       cat.journal_par_defaut,
    journal_libelle:          (cat.journal as { libelle?: string } | null)?.libelle ?? null,
    description:              cat.description ?? null,
    actif:                    !!cat.actif,
    ordre:                    cat.ordre ?? 0,
    created_at:               cat.created_at ?? null,
    mapping_complet:          !!cat.compte_syscohada_code && !!cat.sens,
    volume_cumule,
    nb_operations,
    montant_moyen,
    premiere_utilisation,
    derniere_utilisation,
    dernieres_operations,
  })
}

// ─── PATCH ────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  const { id } = await ctx.params

  const { data: existing } = await supabaseAdmin
    .from("categories_operations")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (!existing) return comptaError("NOT_FOUND")

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return comptaError("INVALID_PAYLOAD", { reason: "JSON malformé" })
  }

  const parsed = safeParse(categorieUpdateSchema, payload)
  if (!parsed.ok) return comptaError("INVALID_PAYLOAD", { issues: parsed.details })

  const updates = parsed.data
  if (Object.keys(updates).length === 0) {
    return comptaError("INVALID_PAYLOAD", undefined, "Aucun champ à mettre à jour")
  }

  // Unicité du libellé si modifié (insensible à la casse)
  if (updates.libelle !== undefined && updates.libelle !== existing.libelle) {
    const { data: dup } = await supabaseAdmin
      .from("categories_operations")
      .select("id")
      .ilike("libelle", updates.libelle)
      .neq("id", id)
      .maybeSingle()
    if (dup) {
      return comptaError(
        "ALREADY_EXISTS",
        { field: "libelle", libelle: updates.libelle },
        "Une catégorie avec ce libellé existe déjà",
      )
    }
  }

  // Cohérence sens/classe revérifiée si mapping touché
  const finalCode    = updates.compte_syscohada_code ?? existing.compte_syscohada_code
  const finalSens    = updates.sens                  ?? existing.sens
  const finalJournal = updates.journal_par_defaut    ?? existing.journal_par_defaut
  const check = await checkMappingCoherence(finalCode, finalSens, finalJournal)
  if (!check.ok) return check.error

  const { data, error } = await supabaseAdmin
    .from("categories_operations")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error || !data) return comptaError("DB_ERROR", { hint: error?.message })

  // Si le mapping a changé : on log que les écritures historiques ne sont pas
  // rééditées (comportement intentionnel — rappel pour audit).
  const mappingChanged =
    updates.compte_syscohada_code !== undefined ||
    updates.sens                  !== undefined ||
    updates.journal_par_defaut    !== undefined

  await logActivity({
    token:   auth.token,
    action:  "compta.categorie.update",
    entity:  id,
    details: {
      champs_modifies: Object.keys(updates),
      mapping_change:  mappingChanged,
      note: mappingChanged
        ? "Les écritures déjà générées ne sont pas rééditées. Le nouveau mapping s'applique uniquement aux futures opérations."
        : undefined,
    },
  })

  return comptaOk(data)
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
// Suppression STRICTE (Écran 6 §3.6 + §6.6).
// Conditions cumulées requises :
//   - actif = false   (la catégorie doit être désactivée d'abord)
//   - nb_ops = 0      (aucune opération ne l'utilise)
// Sinon → 409 CONFLICT explicite (pas de soft-archive silencieux ici).
// Pour désactiver une catégorie, passer par PATCH { actif: false }.
export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  const { id } = await ctx.params

  const { data: existing } = await supabaseAdmin
    .from("categories_operations")
    .select("id, libelle, actif")
    .eq("id", id)
    .maybeSingle()
  if (!existing) return comptaError("NOT_FOUND")

  if (existing.actif) {
    return comptaError(
      "CONFLICT",
      { actif: true, hint: "Désactiver la catégorie avant suppression (PATCH { actif: false })." },
      "Impossible de supprimer une catégorie active",
    )
  }

  const { count } = await supabaseAdmin
    .from("operations")
    .select("id", { count: "exact", head: true })
    .eq("categorie_id", id)

  if ((count ?? 0) > 0) {
    return comptaError(
      "CONFLICT",
      { operations_liees: count },
      `Impossible de supprimer : ${count} opération${count! > 1 ? "s" : ""} utilise${count! > 1 ? "nt" : ""} cette catégorie`,
    )
  }

  const { error } = await supabaseAdmin
    .from("categories_operations")
    .delete()
    .eq("id", id)
  if (error) return comptaError("DB_ERROR", { hint: error.message })

  await logActivity({
    token:   auth.token,
    action:  "compta.categorie.delete",
    entity:  id,
    details: { libelle: existing.libelle, mode: "physique" },
  })
  return comptaOk({ deleted: true, mode: "physique" })
}
