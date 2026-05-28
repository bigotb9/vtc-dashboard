/**
 * GET  /api/compta/comptes
 * POST /api/compta/comptes
 *
 * Comptes bancaires de Boyah. Réservé directeur. Référence : doc Phase 2 §4.1 / §4.2.
 *
 * GET → liste avec solde courant et date de dernière opération (option avec_solde=true par défaut).
 * POST → création avec validation Zod + vérification du compte_syscohada_code éventuel.
 */

import type { NextRequest } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { logActivity } from "@/lib/logActivity"
import { requireComptaPermission } from "@/lib/compta/auth"
import { comptaError, comptaOk, comptaOkList } from "@/lib/compta/errors"
import { compteSchema, safeParse } from "@/lib/compta/validators"
import { getSoldeCompte, getDerniereOperationDate } from "@/lib/compta/soldes"

export const dynamic = "force-dynamic"

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireComptaPermission(req, "view_comptabilite")
  if (!auth.ok) return auth.response

  const url       = new URL(req.url)
  const actifRaw  = url.searchParams.get("actif")
  const avecSolde = url.searchParams.get("avec_solde") !== "false"   // défaut true

  let q = supabaseAdmin
    .from("comptes")
    .select(`
      id, libelle, code, banque, numero_compte, devise,
      solde_initial, date_solde_initial,
      compte_syscohada_code, actif,
      description,
      created_at, created_by, archive_le, archive_par,
      compte_syscohada:compte_syscohada_code ( libelle )
    `, { count: "exact" })
    .order("actif",   { ascending: false })
    .order("libelle", { ascending: true })

  if (actifRaw === "true")  q = q.eq("actif", true)
  if (actifRaw === "false") q = q.eq("actif", false)

  const { data, count, error } = await q
  if (error) return comptaError("DB_ERROR", { hint: error.message })

  const list = data ?? []
  // Enrichissement solde + dernière opération en parallèle
  const enriched = await Promise.all(list.map(async row => {
    const base = {
      ...row,
      compte_syscohada_libelle:
        (row.compte_syscohada as { libelle?: string } | null)?.libelle ?? null,
    }
    if (!avecSolde) return { ...base, solde_courant: null, derniere_operation: null }
    const [solde, derniere] = await Promise.all([
      getSoldeCompte(row.id).catch(() => null),
      getDerniereOperationDate("compte", row.id),
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

  const parsed = safeParse(compteSchema, payload)
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
    // Pour un compte bancaire on attend en général une classe 5 (trésorerie)
    if (cs.classe !== 5) {
      return comptaError(
        "INVALID_PAYLOAD",
        { field: "compte_syscohada_code", classe_recue: cs.classe },
        "Le code SYSCOHADA d'un compte bancaire doit appartenir à la classe 5 (trésorerie)",
      )
    }
  }

  // Unicité du code (si fourni)
  if (input.code) {
    const { data: dup } = await supabaseAdmin
      .from("comptes").select("id").eq("code", input.code).maybeSingle()
    if (dup) return comptaError("ALREADY_EXISTS", { field: "code", code: input.code }, "Ce code interne est déjà utilisé")
  }

  const { data, error } = await supabaseAdmin
    .from("comptes")
    .insert({
      libelle:                input.libelle,
      code:                   input.code ?? null,
      banque:                 input.banque ?? null,
      numero_compte:          input.numero_compte ?? null,
      devise:                 input.devise ?? "XOF",
      solde_initial:          input.solde_initial ?? 0,
      date_solde_initial:     input.date_solde_initial ?? new Date().toISOString().slice(0, 10),
      compte_syscohada_code:  input.compte_syscohada_code ?? null,
      description:            input.description ?? null,
      actif:                  input.actif ?? true,
      created_by:             auth.user.id,
    })
    .select()
    .single()

  if (error || !data) return comptaError("DB_ERROR", { hint: error?.message })

  await logActivity({
    token:   auth.token,
    action:  "compta.compte.create",
    entity:  data.id,
    details: { libelle: data.libelle, banque: data.banque, syscohada: data.compte_syscohada_code },
  })

  return comptaOk(data, { status: 201 })
}
