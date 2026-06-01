/**
 * GET /api/cockpit/finances
 *
 * Données financières SENSIBLES du Cockpit, gardées par une permission
 * DISTINCTE de view_cockpit : `view_finances_cockpit` (lecture seule).
 *
 * Source unique : helper getMargeConsolidee (lib/finance/margeConsolidee.ts).
 * On l'appelle pour le mois courant ET le mois précédent (marge_baisse).
 *
 * Retourne :
 *   - marge_mois            : marge réelle + total consolidé du mois courant
 *   - marge_prec            : marge réelle du mois précédent
 *   - variation_pct         : (courant - précédent) / précédent (null si <= 0)
 *   - marge_en_baisse       : courant < précédent (et précédent > 0)
 *   - loyers_dus_ce_mois    : Σ loyers nets À VERSER (le DÛ, pas le versé)
 *   - verses_ce_mois        : Σ versements_clients du mois courant (effectifs)
 *   - arriere_mois_courant  : max(0, dus - versés)  [version minimale, mois courant]
 *   - deficitaires          : véhicules clients à résultat < 0 (triés croissant)
 *   - avertissements        : remontés du helper (charges structure, Yango…)
 *
 * Cockpit Boyah — Étape 2 : branchement marge consolidée (01/06/2026).
 */

import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { requirePermission } from "@/lib/requirePermission"
import { getMargeConsolidee } from "@/lib/finance/margeConsolidee"

export const dynamic     = "force-dynamic"
export const maxDuration = 60

/** Renvoie 'YYYY-MM' du mois courant et du mois précédent (calendaire, UTC). */
function moisCourantEtPrecedent(now: Date): { courant: string; precedent: string } {
  const courant = now.toISOString().slice(0, 7)
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const precedent = prev.toISOString().slice(0, 7)
  return { courant, precedent }
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "view_finances_cockpit")
  if (!auth.ok) return auth.response

  const { courant, precedent } = moisCourantEtPrecedent(new Date())

  try {
    // ── Marge consolidée : mois courant + précédent (+ versements du mois) ──
    const [margeCourant, margePrec, versementsRes] = await Promise.all([
      getMargeConsolidee(supabaseAdmin, courant),
      getMargeConsolidee(supabaseAdmin, precedent),
      supabaseAdmin
        .from("versements_clients")       // RLS : supabaseAdmin obligatoire
        .select("montant")
        .eq("mois", courant),
    ])

    // ── Loyers dus / versés / arriéré (version minimale : mois courant) ────
    // ATTENTION sémantique : bloc2.loyers_nets_a_verser = le DÛ du mois
    // (Σ calculLoyerNet), PAS ce qui a été versé. Le versé vient de
    // versements_clients.
    const loyersDus = margeCourant.bloc2_gestion_clients.loyers_nets_a_verser
    const verses = (versementsRes.data ?? [])
      .reduce((s, v) => s + Number((v as { montant?: number }).montant ?? 0), 0)
    const arriere = Math.max(0, loyersDus - verses)

    // ── Marge en baisse : courant vs précédent (sur marge_reelle, le bon
    //    chiffre — remplace le calcul ad-hoc de /api/cockpit/alertes) ───────
    const margeCur  = margeCourant.marge_reelle
    const margePre  = margePrec.marge_reelle
    const margeEnBaisse = margePre > 0 && margeCur < margePre
    const variationPct = margePre > 0
      ? Math.round(((margeCur - margePre) / margePre) * 100)
      : null

    // ── Véhicules clients déficitaires (résultat < 0), déjà triés croissant
    //    dans le helper (pire en tête) ; on filtre simplement ──────────────
    const deficitaires = margeCourant.bloc2_gestion_clients.detail_par_vehicule
      .filter(v => v.resultat < 0)

    return NextResponse.json({
      ok: true,
      data: {
        marge_mois: {
          mois:            margeCourant.mois,
          marge_reelle:    Math.round(margeCur),
          total_consolide: Math.round(margeCourant.total_consolide),
        },
        marge_prec: {
          mois:         margePrec.mois,
          marge_reelle: Math.round(margePre),
        },
        variation_pct:        variationPct,
        marge_en_baisse:      margeEnBaisse,
        loyers_dus_ce_mois:   Math.round(loyersDus),
        verses_ce_mois:       Math.round(verses),
        arriere_mois_courant: Math.round(arriere),
        deficitaires,
        avertissements:       margeCourant.avertissements,
      },
    })
  } catch (e) {
    console.error("[cockpit/finances]", e)
    return NextResponse.json(
      { ok: false, error: (e as Error).message || "Erreur serveur" },
      { status: 500 },
    )
  }
}
