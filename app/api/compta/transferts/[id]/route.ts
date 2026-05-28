/**
 * GET /api/compta/transferts/[id] — Détail d'un transfert interne avec ses
 * 2 opérations et son écriture comptable inline (Phase 4.x Vague 1).
 */

import type { NextRequest } from "next/server"
import { requireComptaPermission } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import type { TransfertDetail, TransfertPreviewLigne } from "@/types/compta-ui"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type RouteCtx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireComptaPermission(req, "view_comptabilite")
  if (!auth.ok) return auth.response

  const { id } = await ctx.params

  // ── 1. Charger le transfert ────────────────────────────────────────────────
  const { data: t, error: tErr } = await supabaseAdmin
    .from("transferts_internes")
    .select(`
      id, date_transfert, montant, libelle, statut, notes,
      source_caisse_id, source_compte_id, dest_caisse_id, dest_compte_id,
      operation_sortie_id, operation_entree_id, ecriture_id, created_at
    `)
    .eq("id", id)
    .maybeSingle()
  if (tErr) {
    console.error("[transfert.detail] db error:", tErr)
    return comptaError("DB_ERROR", { message: tErr.message })
  }
  if (!t) return comptaError("NOT_FOUND", undefined, "Transfert introuvable")

  // ── 2. Charger les caisses/comptes référencés ──────────────────────────────
  const caisseIds = [t.source_caisse_id, t.dest_caisse_id].filter(Boolean) as string[]
  const compteIds = [t.source_compte_id, t.dest_compte_id].filter(Boolean) as string[]
  type Ref = { id: string; libelle: string; code: string | null }
  const caissesMap = new Map<string, Ref>()
  const comptesMap = new Map<string, Ref>()
  if (caisseIds.length > 0) {
    const { data } = await supabaseAdmin
      .from("caisses").select("id, libelle, code").in("id", caisseIds)
    for (const r of (data ?? []) as Ref[]) caissesMap.set(r.id, r)
  }
  if (compteIds.length > 0) {
    const { data } = await supabaseAdmin
      .from("comptes").select("id, libelle, code").in("id", compteIds)
    for (const r of (data ?? []) as Ref[]) comptesMap.set(r.id, r)
  }

  // ── 3. Charger l'écriture + ses lignes ─────────────────────────────────────
  let ecriture: TransfertDetail["ecriture"] = null
  if (t.ecriture_id) {
    const { data: ecr } = await supabaseAdmin
      .from("ecritures_comptables")
      .select("id, numero, journal_code, libelle, statut, lignes_ecritures (ordre, compte_syscohada_code, libelle, debit, credit)")
      .eq("id", t.ecriture_id)
      .maybeSingle()
    if (ecr) {
      const lignesRaw = (ecr.lignes_ecritures ?? []) as Array<{
        ordre: number; compte_syscohada_code: string; libelle: string | null; debit: number; credit: number
      }>
      const lignes: TransfertPreviewLigne[] = lignesRaw
        .sort((a, b) => a.ordre - b.ordre)
        .map(l => ({
          compte_code: l.compte_syscohada_code,
          libelle:     l.libelle ?? "",
          debit:       Number(l.debit),
          credit:      Number(l.credit),
        }))
      ecriture = {
        id:           ecr.id,
        numero:       ecr.numero,
        journal_code: ecr.journal_code,
        libelle:      ecr.libelle,
        statut:       ecr.statut,
        lignes,
      }
    }
  }

  const refOf = (caisseId: string | null, compteId: string | null) => {
    if (caisseId) {
      const c = caissesMap.get(caisseId)
      return { kind: "caisse" as const, id: caisseId, libelle: c?.libelle ?? "(introuvable)", code: c?.code ?? null }
    }
    if (compteId) {
      const c = comptesMap.get(compteId)
      return { kind: "compte" as const, id: compteId, libelle: c?.libelle ?? "(introuvable)", code: c?.code ?? null }
    }
    return { kind: "caisse" as const, id: "", libelle: "(vide)", code: null }
  }

  const detail: TransfertDetail = {
    id:                  t.id,
    date_transfert:      t.date_transfert,
    montant:             Number(t.montant),
    libelle:             t.libelle,
    statut:              t.statut as TransfertDetail["statut"],
    notes:               t.notes ?? null,
    source: refOf(t.source_caisse_id, t.source_compte_id),
    dest:   refOf(t.dest_caisse_id,   t.dest_compte_id),
    operation_sortie_id: t.operation_sortie_id,
    operation_entree_id: t.operation_entree_id,
    ecriture_id:         t.ecriture_id,
    created_at:          t.created_at,
    ecriture,
  }

  return comptaOk(detail)
}
