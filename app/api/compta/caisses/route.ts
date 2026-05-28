/**
 * GET  /api/compta/caisses
 * POST /api/compta/caisses
 *
 * Caisses opérationnelles (cash + mobile money). Réservé directeur.
 * Référence : doc Phase 2 §5.1 / §5.2.
 *
 * Règles :
 *  - type='cash'         → operateur DOIT être null
 *  - type='mobile_money' → operateur OBLIGATOIRE (Wave / OM / MTN / Moov)
 */

import type { NextRequest } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { logActivity } from "@/lib/logActivity"
import { requireComptaPermission } from "@/lib/compta/auth"
import { comptaError, comptaOk, comptaOkList } from "@/lib/compta/errors"
import { caisseSchema, safeParse } from "@/lib/compta/validators"
import { getSoldeCaisse, getDerniereOperationDate } from "@/lib/compta/soldes"

export const dynamic = "force-dynamic"

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireComptaPermission(req, "view_comptabilite")
  if (!auth.ok) return auth.response

  const url       = new URL(req.url)
  const typeRaw   = url.searchParams.get("type")
  const actifRaw  = url.searchParams.get("actif")
  const avecSolde = url.searchParams.get("avec_solde") !== "false"   // défaut true

  let q = supabaseAdmin
    .from("caisses")
    .select(`
      id, libelle, code, type, operateur, numero,
      solde_initial, date_solde_initial, plafond,
      compte_syscohada_code, responsable_id, actif,
      description,
      created_at, created_by, archive_le, archive_par,
      compte_syscohada:compte_syscohada_code ( libelle )
    `, { count: "exact" })
    .order("actif",   { ascending: false })
    .order("libelle", { ascending: true })

  if (typeRaw === "cash" || typeRaw === "mobile_money") q = q.eq("type", typeRaw)
  if (actifRaw === "true")  q = q.eq("actif", true)
  if (actifRaw === "false") q = q.eq("actif", false)

  const { data, count, error } = await q
  if (error) return comptaError("DB_ERROR", { hint: error.message })

  const list = data ?? []
  const enriched = await Promise.all(list.map(async row => {
    const base = {
      ...row,
      compte_syscohada_libelle:
        (row.compte_syscohada as { libelle?: string } | null)?.libelle ?? null,
    }
    if (!avecSolde) return { ...base, solde_courant: null, derniere_operation: null }
    const [solde, derniere] = await Promise.all([
      getSoldeCaisse(row.id).catch(() => null),
      getDerniereOperationDate("caisse", row.id),
    ])
    return { ...base, solde_courant: solde, derniere_operation: derniere }
  }))

  return comptaOkList(enriched, {
    total:     count ?? enriched.length,
    page:      1,
    page_size: enriched.length,
  })
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireComptaPermission(req, "manage_comptabilite")
  if (!auth.ok) return auth.response

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return comptaError("INVALID_PAYLOAD", { reason: "JSON malformé" })
  }

  const parsed = safeParse(caisseSchema, payload)
  if (!parsed.ok) return comptaError("INVALID_PAYLOAD", { issues: parsed.details })

  const input = parsed.data

  // Vérifier le code SYSCOHADA si fourni
  if (input.compte_syscohada_code) {
    const { data: cs } = await supabaseAdmin
      .from("comptes_syscohada")
      .select("code, classe")
      .eq("code", input.compte_syscohada_code)
      .maybeSingle()
    if (!cs) {
      return comptaError("INVALID_PAYLOAD", { field: "compte_syscohada_code" }, "Code SYSCOHADA inconnu")
    }
    if (cs.classe !== 5) {
      return comptaError(
        "INVALID_PAYLOAD",
        { field: "compte_syscohada_code", classe_recue: cs.classe },
        "Le code SYSCOHADA d'une caisse doit appartenir à la classe 5 (trésorerie)",
      )
    }
  }

  // Vérifier le responsable_id si fourni
  if (input.responsable_id) {
    const { data: u } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", input.responsable_id)
      .maybeSingle()
    if (!u) return comptaError("NOT_FOUND", { field: "responsable_id" }, "Utilisateur responsable introuvable")
  }

  // Unicité du code (si fourni)
  if (input.code) {
    const { data: dup } = await supabaseAdmin
      .from("caisses").select("id").eq("code", input.code).maybeSingle()
    if (dup) return comptaError("ALREADY_EXISTS", { field: "code", code: input.code }, "Ce code interne est déjà utilisé")
  }

  const { data, error } = await supabaseAdmin
    .from("caisses")
    .insert({
      libelle:                input.libelle,
      code:                   input.code ?? null,
      type:                   input.type,
      operateur:              input.operateur ?? null,
      numero:                 input.numero ?? null,
      solde_initial:          input.solde_initial ?? 0,
      date_solde_initial:     input.date_solde_initial ?? new Date().toISOString().slice(0, 10),
      plafond:                input.plafond ?? null,
      compte_syscohada_code:  input.compte_syscohada_code ?? null,
      responsable_id:         input.responsable_id ?? null,
      description:            input.description ?? null,
      actif:                  input.actif ?? true,
      created_by:             auth.user.id,
    })
    .select()
    .single()

  if (error || !data) return comptaError("DB_ERROR", { hint: error?.message })

  await logActivity({
    token:   auth.token,
    action:  "compta.caisse.create",
    entity:  data.id,
    details: { libelle: data.libelle, type: data.type, operateur: data.operateur },
  })

  return comptaOk(data, { status: 201 })
}
