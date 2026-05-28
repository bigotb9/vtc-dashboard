/**
 * GET /api/cockpit/kpis
 *
 * Retourne en 1 appel les 4 KPIs vitaux du Cockpit Boyah :
 *   - cashflow_jour   : recettes - dépenses du jour
 *   - activite_flotte : nb courses Yango du jour / objectif
 *   - vehicules_retard : count + montant_du_total + chauffeurs_a_contacter
 *   - dette_clients   : montant_total + jours_horizon (rythme de remboursement)
 *
 * Cockpit Boyah — Étape 1/3 backend (27/05/2026).
 */

import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { requirePermission } from "@/lib/requirePermission"
import { getVehiculesEnRetard } from "@/lib/cockpit/retardsVehicules"

export const dynamic     = "force-dynamic"
export const maxDuration = 30

// Objectif journalier nb courses Yango (à passer en BD plus tard).
const OBJECTIF_COURSES_JOUR = 320

type KpiPayload = {
  cashflow_jour: {
    value:    number
    recettes: number
    depenses: number
  }
  activite_flotte: {
    courses_jour:  number
    objectif_jour: number
    pourcentage:   number
  }
  vehicules_retard: {
    count:                 number
    montant_du_total:      number
    chauffeurs_a_contacter: number
  }
  dette_clients: {
    montant_total: number
    jours_horizon: number | null
  }
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "view_cockpit")
  if (!auth.ok) return auth.response

  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const todayStart = `${today}T00:00:00Z`
  const todayEnd   = `${today}T23:59:59Z`

  try {
    // ─── Toutes les sources indépendantes en parallèle ───────────────────
    const [
      recettesRes,
      depensesRes,
      coursesRes,
      vehiculesRetard,
    ] = await Promise.all([
      // 1. Recettes Wave du jour (Montant net > 0)
      supabaseAdmin
        .from("recettes_wave")
        .select("\"Montant net\"")
        .gte("Horodatage", todayStart)
        .lte("Horodatage", todayEnd)
        .gt("Montant net", 0),

      // 2. Dépenses véhicules du jour (hors reversements)
      supabaseAdmin
        .from("depenses_vehicules")
        .select("montant, type_depense")
        .eq("date_depense", today),

      // 3. Commandes Yango complétées aujourd'hui (filtre ended_at::date)
      supabaseAdmin
        .from("commandes_yango")
        .select("id", { count: "exact", head: true })
        .gte("ended_at", todayStart)
        .lte("ended_at", todayEnd)
        .eq("status", "complete"),

      // 4. Véhicules en retard via le helper
      getVehiculesEnRetard(supabaseAdmin, now),
    ])

    // ─── Cashflow ────────────────────────────────────────────────────────
    const recettes = (recettesRes.data ?? []).reduce((s, r) => {
      const m = Number((r as Record<string, unknown>)["Montant net"] ?? 0)
      return s + (Number.isFinite(m) ? m : 0)
    }, 0)
    const depenses = (depensesRes.data ?? [])
      .filter(d => {
        const t = String((d as { type_depense?: string | null }).type_depense ?? "")
          .toLowerCase()
        return !t.includes("reversement")
      })
      .reduce((s, d) => s + Number((d as { montant?: number }).montant ?? 0), 0)

    // ─── Activité flotte ─────────────────────────────────────────────────
    const coursesJour = coursesRes.count ?? 0
    const pourcentage = OBJECTIF_COURSES_JOUR > 0
      ? Math.round((coursesJour / OBJECTIF_COURSES_JOUR) * 100)
      : 0

    // ─── Véhicules en retard ─────────────────────────────────────────────
    const montantDuTotal = vehiculesRetard.reduce((s, v) => s + v.montant_du, 0)
    const chauffeursIds  = new Set<number>()
    for (const v of vehiculesRetard) {
      for (const c of v.chauffeurs_affectes) chauffeursIds.add(c.id)
    }

    // ─── Dette clients ───────────────────────────────────────────────────
    // TODO : sortir le calcul dans une fonction réutilisable
    // (cf. lib/clients/calculBeneficeCumule.ts et app/api/clients/route.ts
    // pour la logique loyer dû - reversé par client). Pour l'étape 1, on
    // retourne 0 et jours_horizon null pour ne pas bloquer.
    const detteMontantTotal = 0
    const detteJoursHorizon = null

    const payload: KpiPayload = {
      cashflow_jour: {
        value:    Math.round(recettes - depenses),
        recettes: Math.round(recettes),
        depenses: Math.round(depenses),
      },
      activite_flotte: {
        courses_jour:  coursesJour,
        objectif_jour: OBJECTIF_COURSES_JOUR,
        pourcentage,
      },
      vehicules_retard: {
        count:                  vehiculesRetard.length,
        montant_du_total:       Math.round(montantDuTotal),
        chauffeurs_a_contacter: chauffeursIds.size,
      },
      dette_clients: {
        montant_total: detteMontantTotal,
        jours_horizon: detteJoursHorizon,
      },
    }

    return NextResponse.json({ ok: true, data: payload })
  } catch (e) {
    console.error("[cockpit/kpis]", e)
    return NextResponse.json(
      { ok: false, error: (e as Error).message || "Erreur serveur" },
      { status: 500 },
    )
  }
}
