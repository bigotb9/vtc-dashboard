/**
 * GET /api/compta/exports/metadata?date_from=&date_to=
 *
 * Renvoie les compteurs nécessaires à la page Exports pour estimer les
 * volumes par rapport (pages estimées, nb écritures, nb opérations, etc.).
 */

import type { NextRequest } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { requireComptaPermission } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { validatePeriod } from "@/lib/compta/exports/common"

export const dynamic     = "force-dynamic"
export const maxDuration = 10

export async function GET(req: NextRequest) {
  const auth = await requireComptaPermission(req, "view_comptabilite")
  if (!auth.ok) return auth.response

  const url      = new URL(req.url)
  const dateFrom = url.searchParams.get("date_from") ?? defaultDateFrom()
  const dateTo   = url.searchParams.get("date_to")   ?? defaultDateTo()

  const check = validatePeriod(dateFrom, dateTo)
  if (!check.ok) return comptaError("INVALID_PAYLOAD", { reason: check.error })

  try {
    // En parallèle :
    const [opsCount, ecrCount, lignesAgg, caissesCount, journauxRows] = await Promise.all([
      supabaseAdmin
        .from("operations")
        .select("id", { count: "exact", head: true })
        .eq("statut", "valide")
        .gte("date_operation", dateFrom)
        .lte("date_operation", dateTo),
      supabaseAdmin
        .from("ecritures_comptables")
        .select("id", { count: "exact", head: true })
        .eq("statut", "valide")
        .gte("date_ecriture", dateFrom)
        .lte("date_ecriture", dateTo),
      supabaseAdmin
        .from("ecritures_comptables")
        .select("journal_code")
        .eq("statut", "valide")
        .gte("date_ecriture", dateFrom)
        .lte("date_ecriture", dateTo),
      supabaseAdmin
        .from("caisses")
        .select("id", { count: "exact", head: true })
        .eq("actif", true),
      supabaseAdmin
        .from("journaux")
        .select("code, libelle"),
    ])

    // Comptes SYSCOHADA utilisés sur la période (pour Grand Livre)
    const { data: lignes } = await supabaseAdmin
      .from("lignes_ecritures")
      .select("compte_syscohada_code, ecriture_id")
      .limit(20000)
    const codesUtilises = new Set<string>()
    if (lignes && lignes.length > 0) {
      // On a la liste des ecritures de la période → on filtre les lignes
      const { data: ecrIds } = await supabaseAdmin
        .from("ecritures_comptables")
        .select("id")
        .eq("statut", "valide")
        .gte("date_ecriture", dateFrom)
        .lte("date_ecriture", dateTo)
      const ecrSet = new Set((ecrIds ?? []).map(e => e.id as string))
      for (const l of lignes) {
        if (l.compte_syscohada_code && ecrSet.has(l.ecriture_id)) {
          codesUtilises.add(l.compte_syscohada_code)
        }
      }
    }

    // Journaux distincts utilisés sur la période
    const journauxUtilises = new Set<string>()
    for (const e of lignesAgg.data ?? []) {
      if (e.journal_code) journauxUtilises.add(e.journal_code)
    }

    const nbOps      = opsCount.count ?? 0
    const nbEcr      = ecrCount.count ?? 0
    const nbComptes  = codesUtilises.size
    const nbCaisses  = caissesCount.count ?? 0

    // Estimations de pagination (au doigt mouillé, OK pour MVP)
    const estPagesGL  = Math.max(1, Math.ceil(nbEcr / 20)        + Math.ceil(nbComptes / 10))
    const estPagesBL  = Math.max(1, Math.ceil(nbComptes / 30))
    const estPagesJN  = Math.max(1, Math.ceil(nbEcr / 25))
    const estPagesRV  = Math.max(1, nbCaisses + Math.ceil(nbEcr / 30))
    const estPagesRM  = 8  // toujours ~8 pages pour le rapport mensuel

    return comptaOk({
      periode: { date_from: dateFrom, date_to: dateTo },
      stats: {
        nb_operations:  nbOps,
        nb_ecritures:   nbEcr,
        nb_comptes:     nbComptes,
        nb_caisses:     nbCaisses,
        journaux_utilises: Array.from(journauxUtilises),
      },
      journaux_disponibles: (journauxRows.data ?? []).map(j => ({
        code:    j.code,
        libelle: j.libelle,
      })),
      estimations: {
        "grand-livre":    estPagesGL,
        "balance":        estPagesBL,
        "journaux":       estPagesJN,
        "releves-caisses": estPagesRV,
        "rapport-mensuel": estPagesRM,
      },
    })
  } catch (e) {
    return comptaError("DB_ERROR", { hint: (e as Error).message })
  }
}

function defaultDateFrom(): string {
  const d = new Date()
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1)
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-01`
}
function defaultDateTo(): string {
  const d = new Date()
  const prev = new Date(d.getFullYear(), d.getMonth(), 0)
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}`
}
