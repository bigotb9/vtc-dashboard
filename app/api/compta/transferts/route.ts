/**
 * POST /api/compta/transferts — Création atomique d'un transfert interne (Phase 4.x Vague 1).
 * GET  /api/compta/transferts — Liste paginée avec filtres optionnels.
 *
 * POST body : TransfertPayload (cf. types/compta-ui.ts).
 * Réponse : { data: TransfertCreateResult }
 *
 * GET query :
 *   - date_from / date_to
 *   - caisse_id / compte_id  (transferts impliquant cette caisse OU compte,
 *                             source OU destination)
 *   - statut (valide | annule | brouillon)
 *   - page / page_size
 */

import type { NextRequest } from "next/server"
import { logActivity } from "@/lib/logActivity"
import { requireDirecteurCompta } from "@/lib/compta/auth"
import { comptaError, comptaOk, comptaOkList } from "@/lib/compta/errors"
import { safeParse, transfertSchema } from "@/lib/compta/validators"
import { createTransfertInterne } from "@/lib/compta/transferts/createTransfert"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import type { TransfertListItem } from "@/types/compta-ui"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// ─── POST : créer un transfert ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  let body: unknown = {}
  try { body = await req.json() } catch { /* body vide */ }

  const parsed = safeParse(transfertSchema, body)
  if (!parsed.ok) {
    return comptaError("INVALID_PAYLOAD", { issues: parsed.details })
  }

  const result = await createTransfertInterne(parsed.data, auth.user.id)
  if (!result.ok) {
    const e = result.error
    const code = e.code
    if (code === "INVALID_PAYLOAD" || code === "EXERCICE_CLOSED"
        || code === "CATEGORY_NO_MAPPING" || code === "ACCOUNT_NO_MAPPING"
        || code === "ECRITURE_DESEQUILIBREE") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return comptaError(code as any, e.details, e.message)
    }
    if (code === "DB_ERROR" || code === "INTERNAL_ERROR") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return comptaError(code as any, e.details, e.message)
    }
    return comptaError("INTERNAL_ERROR", { hint: e.message })
  }

  await logActivity({
    token:   auth.token,
    action:  "compta.transfert_interne.create",
    entity:  result.result.transfert_id,
    details: {
      montant:             parsed.data.montant,
      date_transfert:      parsed.data.date_transfert,
      source_caisse_id:    parsed.data.source_caisse_id ?? null,
      source_compte_id:    parsed.data.source_compte_id ?? null,
      dest_caisse_id:      parsed.data.dest_caisse_id ?? null,
      dest_compte_id:      parsed.data.dest_compte_id ?? null,
      operation_sortie_id: result.result.operation_sortie_id,
      operation_entree_id: result.result.operation_entree_id,
      ecriture_id:         result.result.ecriture_id,
      numero_ecriture:     result.result.numero_ecriture,
    },
  })

  return comptaOk(result.result, { status: 201 })
}

// ─── GET : lister les transferts ─────────────────────────────────────────────

interface TransfertRow {
  id:                  string
  date_transfert:      string
  montant:             number | string
  libelle:             string
  statut:              string
  source_caisse_id:    string | null
  source_compte_id:    string | null
  dest_caisse_id:      string | null
  dest_compte_id:      string | null
  operation_sortie_id: string | null
  operation_entree_id: string | null
  ecriture_id:         string | null
  created_at:          string
}

export async function GET(req: NextRequest) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  const url      = new URL(req.url)
  const dateFrom = url.searchParams.get("date_from")
  const dateTo   = url.searchParams.get("date_to")
  const caisseId = url.searchParams.get("caisse_id")
  const compteId = url.searchParams.get("compte_id")
  const statut   = url.searchParams.get("statut")
  const page     = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10))
  const pageSize = Math.min(200, Math.max(1, parseInt(url.searchParams.get("page_size") ?? "50", 10)))
  const offset   = (page - 1) * pageSize

  let q = supabaseAdmin
    .from("transferts_internes")
    .select(`
      id, date_transfert, montant, libelle, statut,
      source_caisse_id, source_compte_id, dest_caisse_id, dest_compte_id,
      operation_sortie_id, operation_entree_id, ecriture_id, created_at
    `, { count: "exact" })
    .order("date_transfert", { ascending: false })
    .order("created_at",     { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (dateFrom) q = q.gte("date_transfert", dateFrom)
  if (dateTo)   q = q.lte("date_transfert", dateTo)
  if (statut)   q = q.eq("statut", statut)
  if (caisseId) q = q.or(`source_caisse_id.eq.${caisseId},dest_caisse_id.eq.${caisseId}`)
  if (compteId) q = q.or(`source_compte_id.eq.${compteId},dest_compte_id.eq.${compteId}`)

  const { data, count, error } = await q
  if (error) {
    console.error("[transferts.list] error:", error)
    return comptaError("DB_ERROR", { message: error.message })
  }

  const rows = (data ?? []) as TransfertRow[]

  // Charger les libellés des caisses/comptes référencés (en bulk pour éviter N+1)
  const caisseIds = new Set<string>()
  const compteIds = new Set<string>()
  for (const r of rows) {
    if (r.source_caisse_id) caisseIds.add(r.source_caisse_id)
    if (r.dest_caisse_id)   caisseIds.add(r.dest_caisse_id)
    if (r.source_compte_id) compteIds.add(r.source_compte_id)
    if (r.dest_compte_id)   compteIds.add(r.dest_compte_id)
  }

  type Ref = { id: string; libelle: string; code: string | null }
  const caissesMap = new Map<string, Ref>()
  const comptesMap = new Map<string, Ref>()
  if (caisseIds.size > 0) {
    const { data: cs } = await supabaseAdmin
      .from("caisses")
      .select("id, libelle, code")
      .in("id", Array.from(caisseIds))
    for (const c of (cs ?? []) as Ref[]) caissesMap.set(c.id, c)
  }
  if (compteIds.size > 0) {
    const { data: cs } = await supabaseAdmin
      .from("comptes")
      .select("id, libelle, code")
      .in("id", Array.from(compteIds))
    for (const c of (cs ?? []) as Ref[]) comptesMap.set(c.id, c)
  }

  const items: TransfertListItem[] = rows.map(r => ({
    id:                  r.id,
    date_transfert:      r.date_transfert,
    montant:             Number(r.montant),
    libelle:             r.libelle,
    statut:              (r.statut as TransfertListItem["statut"]),
    source: refOf(r.source_caisse_id, r.source_compte_id, caissesMap, comptesMap),
    dest:   refOf(r.dest_caisse_id,   r.dest_compte_id,   caissesMap, comptesMap),
    operation_sortie_id: r.operation_sortie_id,
    operation_entree_id: r.operation_entree_id,
    ecriture_id:         r.ecriture_id,
    created_at:          r.created_at,
  }))

  return comptaOkList(items, { total: count ?? items.length, page, page_size: pageSize })
}

function refOf(
  caisseId: string | null,
  compteId: string | null,
  caissesMap: Map<string, { id: string; libelle: string; code: string | null }>,
  comptesMap: Map<string, { id: string; libelle: string; code: string | null }>,
): TransfertListItem["source"] {
  if (caisseId) {
    const c = caissesMap.get(caisseId)
    return { kind: "caisse", id: caisseId, libelle: c?.libelle ?? "(introuvable)", code: c?.code ?? null }
  }
  if (compteId) {
    const c = comptesMap.get(compteId)
    return { kind: "compte", id: compteId, libelle: c?.libelle ?? "(introuvable)", code: c?.code ?? null }
  }
  return { kind: "caisse", id: "", libelle: "(vide)", code: null }
}
