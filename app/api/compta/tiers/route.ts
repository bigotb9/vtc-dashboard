/**
 * GET  /api/compta/tiers — Liste paginée + KPIs globaux (Phase 4.x Vague 2).
 * POST /api/compta/tiers — Création atomique d'un tiers via RPC.
 *
 * GET query :
 *   - type=client|fournisseur|salarie|autre  (multi-valeurs ignorées, prend la 1ère)
 *   - q=<texte>                              (cherche dans nom / téléphone / RCCM / contribuable)
 *   - actifs_only=true|false                 (défaut true)
 *   - page / page_size
 *
 * GET response :
 *   {
 *     data:   TiersListItem[]
 *     kpis:   { total, clients, fournisseurs, salaries, autres }
 *     total, page, page_size
 *   }
 *
 * POST body : TiersPayload (cf. types/compta-ui.ts)
 * POST response : TiersCreateResult { tiers_id, suffix_final, compte_syscohada_code }
 */

import type { NextRequest } from "next/server"
import { logActivity } from "@/lib/logActivity"
import { requireDirecteurCompta } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { safeParse, tiersSchema } from "@/lib/compta/validators"
import { createTiersRpc } from "@/lib/compta/tiers/createTiers"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import type { TiersListItem, TiersListKpis, TiersType } from "@/types/compta-ui"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// ─── POST : créer un tiers ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  let body: unknown = {}
  try { body = await req.json() } catch { /* body vide */ }

  const parsed = safeParse(tiersSchema, body)
  if (!parsed.ok) return comptaError("INVALID_PAYLOAD", { issues: parsed.details })

  const result = await createTiersRpc(parsed.data, auth.user.id)
  if (!result.ok) {
    const e = result.error
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return comptaError(e.code as any, e.details, e.message)
  }

  await logActivity({
    token:   auth.token,
    action:  "compta.tiers.create",
    entity:  result.result.tiers_id,
    details: {
      nom:                   parsed.data.nom,
      type:                  parsed.data.type,
      compte_syscohada_code: result.result.compte_syscohada_code,
    },
  })

  return comptaOk(result.result, { status: 201 })
}

// ─── GET : liste paginée + KPIs ──────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  const url      = new URL(req.url)
  const type     = url.searchParams.get("type") as TiersType | null
  const q        = (url.searchParams.get("q") ?? "").trim()
  const actifsOnly = url.searchParams.get("actifs_only") !== "false"  // défaut true
  const page     = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10))
  const pageSize = Math.min(200, Math.max(1, parseInt(url.searchParams.get("page_size") ?? "50", 10)))
  const offset   = (page - 1) * pageSize

  // ── KPIs globaux (count par type, indépendamment des filtres) ──────────────
  // On compte sur actifs uniquement par défaut, mais sans le filtre `type`.
  const kpiQueries = await Promise.all([
    countTiers(actifsOnly, null),
    countTiers(actifsOnly, "client"),
    countTiers(actifsOnly, "fournisseur"),
    countTiers(actifsOnly, "salarie"),
    countTiers(actifsOnly, "autre"),
  ])
  const kpis: TiersListKpis = {
    total:        kpiQueries[0],
    clients:      kpiQueries[1],
    fournisseurs: kpiQueries[2],
    salaries:     kpiQueries[3],
    autres:       kpiQueries[4],
  }

  // ── Page courante ──────────────────────────────────────────────────────────
  let baseQ = supabaseAdmin
    .from("tiers")
    .select(`
      id, nom, type, telephone, email,
      numero_rccm, numero_contribuable, compte_syscohada_code, actif
    `, { count: "exact" })

  if (actifsOnly)            baseQ = baseQ.eq("actif", true)
  if (type && type !== ("tout" as TiersType)) baseQ = baseQ.eq("type", type)
  if (q) {
    // Recherche multicolonne case-insensitive
    const pattern = `%${q.replace(/[%_]/g, "\\$&")}%`
    baseQ = baseQ.or([
      `nom.ilike.${pattern}`,
      `telephone.ilike.${pattern}`,
      `numero_rccm.ilike.${pattern}`,
      `numero_contribuable.ilike.${pattern}`,
    ].join(","))
  }

  baseQ = baseQ.order("nom", { ascending: true }).range(offset, offset + pageSize - 1)

  const { data: rows, count, error } = await baseQ
  if (error) {
    console.error("[tiers.list] db error:", error)
    return comptaError("DB_ERROR", { message: error.message })
  }

  // ── Agrégats par tiers de la page (année en cours) ─────────────────────────
  const ids = (rows ?? []).map(r => r.id as string)
  type Agg = { nb_operations: number; total_flux_signe: number; derniere: string | null }
  const aggMap = new Map<string, Agg>()
  if (ids.length > 0) {
    const yearStart = `${new Date().getFullYear()}-01-01`
    const { data: opsAgg } = await supabaseAdmin
      .from("operations")
      .select("tiers_id, type, montant, date_operation")
      .in("tiers_id", ids)
      .eq("statut", "valide")
      .gte("date_operation", yearStart)
    for (const r of (opsAgg ?? []) as Array<{ tiers_id: string; type: "entree"|"sortie"; montant: number | string; date_operation: string }>) {
      const a = aggMap.get(r.tiers_id) ?? { nb_operations: 0, total_flux_signe: 0, derniere: null }
      a.nb_operations += 1
      const m = Number(r.montant)
      a.total_flux_signe += (r.type === "entree" ? m : -m)
      if (!a.derniere || r.date_operation > a.derniere) a.derniere = r.date_operation
      aggMap.set(r.tiers_id, a)
    }
  }

  const items: TiersListItem[] = (rows ?? []).map(r => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = r as any
    const a = aggMap.get(row.id as string)
    return {
      id:                    row.id,
      nom:                   row.nom,
      type:                  row.type as TiersType,
      telephone:             row.telephone,
      email:                 row.email,
      numero_rccm:           row.numero_rccm,
      numero_contribuable:   row.numero_contribuable,
      compte_syscohada_code: row.compte_syscohada_code,
      actif:                 !!row.actif,
      nb_operations:         a?.nb_operations ?? 0,
      total_flux_signe:      a?.total_flux_signe ?? 0,
      derniere_op_date:      a?.derniere ?? null,
    }
  })

  return comptaOk({
    data:      items,
    kpis,
    total:     count ?? items.length,
    page,
    page_size: pageSize,
  })
}

// ── Helper compteur KPI ─────────────────────────────────────────────────────
async function countTiers(actifsOnly: boolean, type: TiersType | null): Promise<number> {
  let q = supabaseAdmin.from("tiers").select("*", { count: "exact", head: true })
  if (actifsOnly) q = q.eq("actif", true)
  if (type)       q = q.eq("type", type)
  const { count } = await q
  return count ?? 0
}
