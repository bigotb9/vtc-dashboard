/**
 * GET /api/compta/comptes-syscohada
 *
 * Lecture seule du plan comptable SYSCOHADA seedé en Phase 1.
 * Réservé directeur. Référence : doc Phase 2 §6.5.
 *
 * Query params :
 *   - classe     : 1|2|4|5|6|7  (facultatif)
 *   - type       : capitaux_propres|tresorerie|charge_exploitation|... (facultatif)
 *   - recherche  : LIKE %recherche% sur code OU libellé (facultatif)
 *   - actif_only : true par défaut, false pour inclure les inactifs
 */

import type { NextRequest } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { requireComptaPermission } from "@/lib/compta/auth"
import { comptaError, comptaOkList } from "@/lib/compta/errors"

export const dynamic = "force-dynamic"

const ALLOWED_CLASSES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9])
const ALLOWED_TYPES = new Set([
  "capitaux_propres", "dettes_financieres",
  "immobilisation",   "amortissement",  "immobilisation_fin",
  "tiers_actif",      "tiers_passif",   "tiers",
  "tresorerie",
  "charge_exploitation", "charge_personnel", "charge_financiere", "dotation",
  "produit_exploitation","produit_financier","reprise",
])

export async function GET(req: NextRequest) {
  const auth = await requireComptaPermission(req, "view_comptabilite")
  if (!auth.ok) return auth.response

  const url = new URL(req.url)
  const classeRaw  = url.searchParams.get("classe")
  const type       = url.searchParams.get("type")
  const recherche  = url.searchParams.get("recherche")?.trim()
  const actifOnly  = url.searchParams.get("actif_only") !== "false"   // défaut true

  let q = supabaseAdmin
    .from("comptes_syscohada")
    .select("*", { count: "exact" })
    .order("classe", { ascending: true })
    .order("ordre",  { ascending: true })
    .order("code",   { ascending: true })

  if (classeRaw) {
    const classe = Number(classeRaw)
    if (!ALLOWED_CLASSES.has(classe)) {
      return comptaError("INVALID_PAYLOAD", { hint: "classe doit être 1..9" })
    }
    q = q.eq("classe", classe)
  }

  if (type) {
    if (!ALLOWED_TYPES.has(type)) {
      return comptaError("INVALID_PAYLOAD", { hint: "type inconnu" })
    }
    q = q.eq("type", type)
  }

  if (recherche) {
    // ILIKE pour insensible à la casse, sur code OU libellé
    const pattern = `%${recherche.replace(/[%_]/g, m => `\\${m}`)}%`
    q = q.or(`code.ilike.${pattern},libelle.ilike.${pattern}`)
  }

  if (actifOnly) q = q.eq("actif", true)

  const { data, count, error } = await q
  if (error) return comptaError("DB_ERROR", { hint: error.message })

  return comptaOkList(data ?? [], {
    total:     count ?? 0,
    page:      1,
    page_size: data?.length ?? 0,
  })
}
