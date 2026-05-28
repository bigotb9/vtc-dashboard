/**
 * GET  /api/compta/categories
 * POST /api/compta/categories
 *
 * Catégories d'opérations. Réservé directeur. Référence : doc Phase 2 §6.1 / §6.2.
 *
 * Règles de cohérence sens / classe SYSCOHADA (mode Avancé) :
 *  - mapping vers classe 6 (charges)  → sens DOIT être 'debit'
 *  - mapping vers classe 7 (produits) → sens DOIT être 'credit'
 *  - autres classes (1, 4, 5)         → sens libre
 *  - si compte_syscohada_code fourni → sens OBLIGATOIRE
 */

import type { NextRequest } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { logActivity } from "@/lib/logActivity"
import { requireComptaPermission } from "@/lib/compta/auth"
import { comptaError, comptaOk, comptaOkList } from "@/lib/compta/errors"
import { categorieSchema, safeParse } from "@/lib/compta/validators"

export const dynamic = "force-dynamic"

const ALLOWED_TYPES = new Set([
  "recette", "depense", "apport", "reversement", "avance",
  "investissement", "remboursement", "dotation", "transfert", "autre",
])
const ALLOWED_JOURNALS = new Set(["BQ", "CA", "AC", "VE", "PA", "OD"])

/** Vérifie la cohérence (sens, classe SYSCOHADA, journal). */
async function checkMappingCoherence(
  compte_syscohada_code: string | null | undefined,
  sens: "debit" | "credit" | null | undefined,
  journal_par_defaut: string | null | undefined,
): Promise<{ ok: true } | { ok: false; error: ReturnType<typeof comptaError> }> {
  if (compte_syscohada_code) {
    const { data: cs } = await supabaseAdmin
      .from("comptes_syscohada")
      .select("code, classe")
      .eq("code", compte_syscohada_code)
      .maybeSingle()
    if (!cs) {
      return { ok: false, error: comptaError(
        "INVALID_PAYLOAD",
        { field: "compte_syscohada_code" },
        "Code SYSCOHADA inconnu",
      ) }
    }
    if (!sens) {
      return { ok: false, error: comptaError(
        "INVALID_PAYLOAD",
        { field: "sens" },
        "Le sens (debit/credit) est obligatoire quand un compte SYSCOHADA est mappé",
      ) }
    }
    if (cs.classe === 6 && sens !== "debit") {
      return { ok: false, error: comptaError(
        "INVALID_PAYLOAD",
        { field: "sens", classe: 6, sens_attendu: "debit" },
        "Une catégorie mappée à la classe 6 (charges) doit être de sens 'debit'",
      ) }
    }
    if (cs.classe === 7 && sens !== "credit") {
      return { ok: false, error: comptaError(
        "INVALID_PAYLOAD",
        { field: "sens", classe: 7, sens_attendu: "credit" },
        "Une catégorie mappée à la classe 7 (produits) doit être de sens 'credit'",
      ) }
    }
  }
  if (journal_par_defaut && !ALLOWED_JOURNALS.has(journal_par_defaut)) {
    return { ok: false, error: comptaError(
      "INVALID_PAYLOAD",
      { field: "journal_par_defaut" },
      "Code de journal inconnu (attendu : BQ, CA, AC, VE, PA, OD)",
    ) }
  }
  return { ok: true }
}

export { checkMappingCoherence }   // exporté pour la route [id]/route.ts

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireComptaPermission(req, "view_comptabilite")
  if (!auth.ok) return auth.response

  const url           = new URL(req.url)
  const typeRaw       = url.searchParams.get("type")
  const actifRaw      = url.searchParams.get("actif")
  const sensRaw       = url.searchParams.get("sens")
  const avecMapping   = url.searchParams.get("avec_mapping") !== "false"   // défaut true
  const avecStats     = url.searchParams.get("avec_stats")   === "true"    // défaut false

  if (typeRaw && !ALLOWED_TYPES.has(typeRaw)) {
    return comptaError("INVALID_PAYLOAD", { field: "type" }, "Type de catégorie inconnu")
  }
  if (sensRaw && sensRaw !== "debit" && sensRaw !== "credit") {
    return comptaError("INVALID_PAYLOAD", { field: "sens" }, "Sens doit valoir 'debit' ou 'credit'")
  }

  let q = supabaseAdmin
    .from("categories_operations")
    .select(`
      id, libelle, type, compte_syscohada_code, sens, journal_par_defaut,
      actif, ordre, description, created_at,
      compte_syscohada:compte_syscohada_code ( libelle, classe ),
      journal:journal_par_defaut ( libelle )
    `, { count: "exact" })
    .order("ordre",   { ascending: true })
    .order("libelle", { ascending: true })

  if (typeRaw)              q = q.eq("type", typeRaw)
  if (sensRaw)              q = q.eq("sens", sensRaw)
  if (actifRaw === "true")  q = q.eq("actif", true)
  if (actifRaw === "false") q = q.eq("actif", false)

  const { data, count, error } = await q
  if (error) return comptaError("DB_ERROR", { hint: error.message })

  // Si avec_stats=true : agréger nb_ops + volume par catégorie en mémoire.
  // On charge les operations valides paginées et on compte/somme.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statsMap = new Map<string, { nb_operations: number; volume_total: number }>()
  if (avecStats) {
    const PAGE = 5000
    let from = 0
    while (from < 1_000_000) {
      const { data: ops, error: opsErr } = await supabaseAdmin
        .from("operations")
        .select("categorie_id, montant")
        .eq("statut", "valide")
        .range(from, from + PAGE - 1)
      if (opsErr) return comptaError("DB_ERROR", { hint: opsErr.message })
      if (!ops || ops.length === 0) break
      for (const o of ops) {
        if (!o.categorie_id) continue
        const k = String(o.categorie_id)
        const cur = statsMap.get(k) ?? { nb_operations: 0, volume_total: 0 }
        cur.nb_operations += 1
        cur.volume_total  += Number(o.montant || 0)
        statsMap.set(k, cur)
      }
      if (ops.length < PAGE) break
      from += PAGE
    }
  }

  const enriched = (data ?? []).map(row => {
    const stats = avecStats ? (statsMap.get(String(row.id)) ?? { nb_operations: 0, volume_total: 0 }) : null
    return {
      ...row,
      compte_syscohada_libelle:
        avecMapping ? (row.compte_syscohada as { libelle?: string } | null)?.libelle ?? null : undefined,
      compte_syscohada_classe:
        avecMapping ? (row.compte_syscohada as { classe?: number } | null)?.classe ?? null : undefined,
      journal_libelle:
        avecMapping ? (row.journal as { libelle?: string } | null)?.libelle ?? null : undefined,
      mapping_complet:
        !!row.compte_syscohada_code && !!row.sens,
      nb_operations: stats?.nb_operations ?? undefined,
      volume_total:  stats?.volume_total  ?? undefined,
    }
  })

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

  const parsed = safeParse(categorieSchema, payload)
  if (!parsed.ok) return comptaError("INVALID_PAYLOAD", { issues: parsed.details })

  const input = parsed.data

  // Unicité du libellé (insensible à la casse via lower())
  const { data: dup } = await supabaseAdmin
    .from("categories_operations")
    .select("id")
    .ilike("libelle", input.libelle)
    .maybeSingle()
  if (dup) {
    return comptaError(
      "ALREADY_EXISTS",
      { field: "libelle", libelle: input.libelle },
      "Une catégorie avec ce libellé existe déjà",
    )
  }

  const check = await checkMappingCoherence(
    input.compte_syscohada_code ?? null,
    input.sens ?? null,
    input.journal_par_defaut ?? null,
  )
  if (!check.ok) return check.error

  const { data, error } = await supabaseAdmin
    .from("categories_operations")
    .insert({
      libelle:                input.libelle,
      type:                   input.type,
      compte_syscohada_code:  input.compte_syscohada_code ?? null,
      sens:                   input.sens ?? null,
      journal_par_defaut:     input.journal_par_defaut ?? null,
      description:            input.description ?? null,
      actif:                  input.actif ?? true,
      ordre:                  input.ordre ?? 0,
    })
    .select()
    .single()

  if (error || !data) return comptaError("DB_ERROR", { hint: error?.message })

  await logActivity({
    token:   auth.token,
    action:  "compta.categorie.create",
    entity:  data.id,
    details: { libelle: data.libelle, type: data.type, mapping: data.compte_syscohada_code },
  })

  return comptaOk(data, { status: 201 })
}
