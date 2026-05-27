/**
 * GET   /api/compta/tiers/[id] — Détail enrichi + KPIs (Phase 4.x Vague 2).
 * PATCH /api/compta/tiers/[id] — Modifier un tiers.
 *
 * Le PATCH ne réinjecte PAS le suffixe via la RPC ; il met à jour directement
 * les champs simples + (optionnellement) `compte_syscohada_suffix` en
 * laissant la BD recalculer `compte_syscohada_code` (colonne générée).
 * En cas de collision, on remonte une erreur typée CONFLICT.
 */

import type { NextRequest } from "next/server"
import { logActivity } from "@/lib/logActivity"
import { requireDirecteurCompta } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { safeParse, tiersUpdateSchema } from "@/lib/compta/validators"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { TIERS_SYSCOHADA_PARENT, type TiersDetail, type TiersType } from "@/types/compta-ui"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteCtx = { params: Promise<{ id: string }> }

// ─── GET : détail enrichi ────────────────────────────────────────────────────

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  const { id } = await ctx.params

  const { data: t, error } = await supabaseAdmin
    .from("tiers")
    .select(`
      id, nom, type, telephone, email, adresse,
      raison_sociale, numero_rccm, numero_contribuable,
      compte_syscohada_parent, compte_syscohada_suffix, compte_syscohada_code,
      actif, notes, created_at, updated_at
    `)
    .eq("id", id)
    .maybeSingle()
  if (error) return comptaError("DB_ERROR", { message: error.message })
  if (!t)    return comptaError("NOT_FOUND", undefined, "Tiers introuvable")

  // KPIs (année en cours)
  const yearStart = `${new Date().getFullYear()}-01-01`
  const { data: ops } = await supabaseAdmin
    .from("operations")
    .select("type, montant, date_operation")
    .eq("tiers_id", id)
    .eq("statut", "valide")
    .gte("date_operation", yearStart)

  let entrees = 0, sorties = 0, derniere: string | null = null
  for (const r of (ops ?? []) as Array<{ type: "entree"|"sortie"; montant: number|string; date_operation: string }>) {
    const m = Number(r.montant)
    if (r.type === "entree") entrees += m
    else                      sorties += m
    if (!derniere || r.date_operation > derniere) derniere = r.date_operation
  }

  // Solde courant (toutes périodes, toutes ops valides)
  const { data: allOps } = await supabaseAdmin
    .from("operations")
    .select("type, montant")
    .eq("tiers_id", id)
    .eq("statut", "valide")
  let soldeCourant = 0
  for (const r of (allOps ?? []) as Array<{ type: "entree"|"sortie"; montant: number|string }>) {
    const m = Number(r.montant)
    soldeCourant += (r.type === "entree" ? m : -m)
  }

  const detail: TiersDetail = {
    id:                      t.id,
    nom:                     t.nom,
    type:                    t.type as TiersType,
    telephone:               t.telephone,
    email:                   t.email,
    adresse:                 t.adresse,
    raison_sociale:          t.raison_sociale,
    numero_rccm:             t.numero_rccm,
    numero_contribuable:     t.numero_contribuable,
    compte_syscohada_parent: t.compte_syscohada_parent,
    compte_syscohada_suffix: t.compte_syscohada_suffix,
    compte_syscohada_code:   t.compte_syscohada_code,
    actif:                   !!t.actif,
    notes:                   t.notes,
    created_at:              t.created_at,
    updated_at:              t.updated_at,
    kpis: {
      nb_operations:    (ops ?? []).length,
      total_entrees:    entrees,
      total_sorties:    sorties,
      total_flux_signe: entrees - sorties,
      derniere_op_date: derniere,
      solde_courant:    soldeCourant,
    },
  }
  return comptaOk(detail)
}

// ─── PATCH : modification ────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  const { id } = await ctx.params

  let body: unknown = {}
  try { body = await req.json() } catch { /* body vide */ }
  const parsed = safeParse(tiersUpdateSchema, body)
  if (!parsed.ok) return comptaError("INVALID_PAYLOAD", { issues: parsed.details })

  // Construire l'objet à update
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = {}
  if (parsed.data.nom                  !== undefined) patch.nom                  = parsed.data.nom?.trim()
  if (parsed.data.telephone            !== undefined) patch.telephone            = nullify(parsed.data.telephone)
  if (parsed.data.email                !== undefined) patch.email                = nullify(parsed.data.email)
  if (parsed.data.adresse              !== undefined) patch.adresse              = nullify(parsed.data.adresse)
  if (parsed.data.raison_sociale       !== undefined) patch.raison_sociale       = nullify(parsed.data.raison_sociale)
  if (parsed.data.numero_rccm          !== undefined) patch.numero_rccm          = nullify(parsed.data.numero_rccm)
  if (parsed.data.numero_contribuable  !== undefined) patch.numero_contribuable  = nullify(parsed.data.numero_contribuable)
  if (parsed.data.notes                !== undefined) patch.notes                = nullify(parsed.data.notes)
  if (parsed.data.actif                !== undefined) patch.actif                = parsed.data.actif

  // Si on change le type → recaler le parent SYSCOHADA
  if (parsed.data.type !== undefined) {
    patch.type                    = parsed.data.type
    patch.compte_syscohada_parent = TIERS_SYSCOHADA_PARENT[parsed.data.type]
  }
  // Si on change le suffixe explicitement
  if (parsed.data.suffix_manuel !== undefined) {
    patch.compte_syscohada_suffix = parsed.data.suffix_manuel
      ? parsed.data.suffix_manuel.toUpperCase()
      : null
  }
  patch.updated_at = new Date().toISOString()
  patch.updated_by = auth.user.id

  const { data, error } = await supabaseAdmin
    .from("tiers")
    .update(patch)
    .eq("id", id)
    .select("id, compte_syscohada_code, actif")
    .maybeSingle()

  if (error) {
    if (/duplicate key/i.test(error.message)) {
      return comptaError("CONFLICT", { message: error.message }, "Un autre tiers actif utilise déjà ce code SYSCOHADA. Choisis un autre suffixe.")
    }
    console.error("[tiers.patch] error:", error)
    return comptaError("DB_ERROR", { message: error.message })
  }
  if (!data) return comptaError("NOT_FOUND", undefined, "Tiers introuvable")

  await logActivity({
    token:   auth.token,
    action:  "compta.tiers.update",
    entity:  id,
    details: {
      patched_keys:          Object.keys(patch).filter(k => k !== "updated_at" && k !== "updated_by"),
      compte_syscohada_code: data.compte_syscohada_code,
    },
  })

  return comptaOk({ id, compte_syscohada_code: data.compte_syscohada_code, actif: data.actif })
}

function nullify(v: string | null | undefined): string | null {
  if (v === undefined) return null
  if (v === null)      return null
  const t = v.trim()
  return t === "" ? null : t
}
