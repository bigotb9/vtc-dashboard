/**
 * GET /api/compta/tiers/[id]/operations
 * Historique paginé des opérations rattachées à un tiers (Phase 4.x Vague 2).
 *
 * Query :
 *   - date_from / date_to
 *   - page / page_size
 */

import type { NextRequest } from "next/server"
import { requireComptaPermission } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import type { TiersOperationRow } from "@/types/compta-ui"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteCtx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireComptaPermission(req, "view_comptabilite")
  if (!auth.ok) return auth.response

  const { id } = await ctx.params
  const url      = new URL(req.url)
  const dateFrom = url.searchParams.get("date_from")
  const dateTo   = url.searchParams.get("date_to")
  const page     = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10))
  const pageSize = Math.min(200, Math.max(1, parseInt(url.searchParams.get("page_size") ?? "50", 10)))
  const offset   = (page - 1) * pageSize

  let q = supabaseAdmin
    .from("operations")
    .select(`
      id, date_operation, type, montant, libelle, statut, ecriture_id,
      caisse:caisse_id ( libelle ),
      compte:compte_id ( libelle ),
      categorie:categorie_id ( libelle )
    `, { count: "exact" })
    .eq("tiers_id", id)
    .order("date_operation", { ascending: false })
    .order("created_at",     { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (dateFrom) q = q.gte("date_operation", dateFrom)
  if (dateTo)   q = q.lte("date_operation", dateTo)

  const { data, count, error } = await q
  if (error) {
    console.error("[tiers.operations] error:", error)
    return comptaError("DB_ERROR", { message: error.message })
  }

  type OpRow = {
    id: string
    date_operation: string
    type: "entree" | "sortie"
    montant: number | string
    libelle: string
    statut: string
    ecriture_id: string | null
    caisse:    { libelle: string } | null
    compte:    { libelle: string } | null
    categorie: { libelle: string } | null
  }
  // Phase 4.x Vague 3 — compteur de justificatifs en bulk
  const allIds = (data ?? []).map(r => (r as unknown as { id: string }).id)
  const justifCount = new Map<string, number>()
  if (allIds.length > 0) {
    const { data: js } = await supabaseAdmin
      .from("justificatifs")
      .select("operation_id")
      .in("operation_id", allIds)
      .is("deleted_at", null)
    for (const r of (js ?? []) as Array<{ operation_id: string }>) {
      justifCount.set(r.operation_id, (justifCount.get(r.operation_id) ?? 0) + 1)
    }
  }

  const items: TiersOperationRow[] = (data ?? []).map(r => {
    const row = r as unknown as OpRow
    return {
      id:                  row.id,
      date_operation:      row.date_operation,
      type:                row.type,
      montant:             Number(row.montant),
      libelle:             row.libelle,
      caisse_libelle:      row.caisse?.libelle ?? null,
      compte_libelle:      row.compte?.libelle ?? null,
      categorie_libelle:   row.categorie?.libelle ?? null,
      ecriture_id:         row.ecriture_id,
      statut:              row.statut,
      justificatifs_count: justifCount.get(row.id) ?? 0,
    }
  })

  return comptaOk({
    data:      items,
    total:     count ?? items.length,
    page,
    page_size: pageSize,
  })
}
