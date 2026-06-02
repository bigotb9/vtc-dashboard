/**
 * GET /api/cockpit/finances
 *
 * Données financières SENSIBLES du Cockpit, gardées par une permission
 * DISTINCTE de view_cockpit : `view_finances_cockpit` (lecture seule).
 *
 * Source unique : helper getMargeConsolidee (lib/finance/margeConsolidee.ts).
 * On l'appelle pour le mois courant ET le mois précédent (marge_baisse).
 *
 * DÉCALAGE DE PAIEMENT M+1 (correctif 01/06/2026) :
 *   Le loyer d'un mois M est versé entre le 5 et le 10 de M+1. Le « loyer à
 *   verser » que pilote le Cockpit n'est donc PAS celui du mois courant mais
 *   celui du mois PRÉCÉDENT (le mois à traiter). Voir lib/finance/loyerEcheance.
 *   L'arriéré devient l'arriéré CUMULÉ (Σ reliquats des mois en retard) calculé
 *   par lib/finance/getArriereLoyers. La marge, elle, reste imputée sur M
 *   (engagement comptable) — getMargeConsolidee n'est pas modifié.
 *
 * Retourne :
 *   - marge_mois        : marge réelle FLOTTE (hors Yango) + total consolidé
 *                         (avec commission Yango) + commission_yango du mois courant
 *   - marge_prec        : marge réelle du mois précédent
 *   - variation_pct     : (courant - précédent) / précédent (null si <= 0)
 *   - marge_en_baisse   : courant < précédent (et précédent > 0)
 *   - mois_concerne     : 'YYYY-MM' du loyer à traiter (= mois précédent)
 *   - etat              : état d'échéance du loyer du mois concerné (LoyerEtat)
 *   - loyer_a_verser    : Σ loyers nets dus du mois concerné (le DÛ)
 *   - deja_verse        : Σ versements_clients de période = mois concerné
 *   - reliquat_mois     : max(0, loyer_a_verser - deja_verse)
 *   - arriere_cumule    : Σ reliquats de TOUS les mois en retard (12 mois glissants)
 *   - deficitaires      : véhicules clients à résultat < 0 (triés croissant)
 *   - avertissements    : remontés du helper (charges structure, Yango…)
 *
 * Cockpit Boyah — Étape 2 : branchement marge consolidée (01/06/2026).
 */

import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { requirePermission } from "@/lib/requirePermission"
import { getMargeConsolidee } from "@/lib/finance/margeConsolidee"
import { getArriereLoyers } from "@/lib/finance/getArriereLoyers"
import { getLoyerStatus } from "@/lib/finance/loyerEcheance"

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

  const today = new Date()
  const { courant, precedent } = moisCourantEtPrecedent(today)

  try {
    // ── Marge consolidée : mois courant + précédent ; loyer à verser = mois
    //    PRÉCÉDENT (décalage M+1) ; arriéré cumulé ; versés du mois concerné ─
    const [margeCourant, margePrec, arriere, versementsRes] = await Promise.all([
      getMargeConsolidee(supabaseAdmin, courant),
      getMargeConsolidee(supabaseAdmin, precedent),
      getArriereLoyers(supabaseAdmin, today, 12),
      supabaseAdmin
        .from("versements_clients")       // RLS : supabaseAdmin obligatoire
        .select("montant")
        .eq("mois", precedent),           // période = mois à traiter (M−1)
    ])

    // ── Loyer à verser = DÛ du mois PRÉCÉDENT (le mois à traiter).
    //    bloc2.loyers_nets_a_verser = Σ calculLoyerNet, PAS le versé.
    const loyerAVerser = margePrec.bloc2_gestion_clients.loyers_nets_a_verser
    const dejaVerse = (versementsRes.data ?? [])
      .reduce((s, v) => s + Number((v as { montant?: number }).montant ?? 0), 0)
    const reliquatMois = Math.max(0, loyerAVerser - dejaVerse)

    // ── État d'échéance du loyer du mois concerné. Soldé si versé ≥ dû
    //    (loyer nul = rien à traiter → considéré soldé, badge "Versé"). ──────
    const solde = loyerAVerser <= 0 || dejaVerse >= loyerAVerser
    const etat = getLoyerStatus(precedent, today, solde)

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
          marge_reelle:    Math.round(margeCur),                                    // FLOTTE seule (hors Yango)
          total_consolide: Math.round(margeCourant.total_consolide),               // flotte + commission Yango
          commission_yango: Math.round(margeCourant.bloc3_yango_estime.commission), // part Yango générée du mois
        },
        marge_prec: {
          mois:         margePrec.mois,
          marge_reelle: Math.round(margePre),
        },
        variation_pct:   variationPct,
        marge_en_baisse: margeEnBaisse,
        // ── Loyer à verser (décalage M+1) : mois PRÉCÉDENT ──
        mois_concerne:   precedent,
        etat,
        loyer_a_verser:  Math.round(loyerAVerser),
        deja_verse:      Math.round(dejaVerse),
        reliquat_mois:   Math.round(reliquatMois),
        // ── Arriéré CUMULÉ (Σ reliquats des mois en retard, 12 mois glissants) ──
        arriere_cumule:  Math.round(arriere.arriere_total),
        deficitaires,
        avertissements:  margeCourant.avertissements,
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
