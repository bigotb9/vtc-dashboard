/**
 * GET /api/cockpit/flotte
 *
 * Mini-radar flotte pour le Cockpit Boyah :
 *   - 1 entrée par véhicule
 *   - statut = "a_jour" | "retard" | "pause"
 *   - meta_principale = libellé court (ex: "22 K hier", "retard 2j", "en pause")
 *
 * Pas de notion d'inactivité Yango (Yango = activité commerciale externe,
 * sans rapport avec la santé comptable de la flotte). Le retard est calculé
 * via getCompletude (même source que le widget Suivi versements).
 *
 * Cockpit Boyah — Étape 2/3.
 */

import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { requirePermission } from "@/lib/requirePermission"
import { getCompletude } from "@/lib/completude/calculCompletude"

export const dynamic     = "force-dynamic"
export const maxDuration = 30

type FlotteVehicule = {
  id_vehicule:      number
  immatriculation:  string
  statut:           "a_jour" | "retard" | "pause"
  meta_principale:  string
}

type FlotteResume = {
  total:        number
  a_jour:       number
  retard:       number
  pause:        number
  courses_jour: number
  cash_net:     number
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "view_cockpit")
  if (!auth.ok) return auth.response

  const now = new Date()
  const today    = now.toISOString().slice(0, 10)
  const yesterdayDate = new Date(now)
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1)
  const yesterday = yesterdayDate.toISOString().slice(0, 10)

  try {
    // ─── 1. Tous les véhicules (ACTIF + autres pour détecter "pause") ─────
    const { data: vehicules, error: vehErr } = await supabaseAdmin
      .from("vehicules")
      .select("id_vehicule, immatriculation, statut")
      .order("immatriculation")
    if (vehErr) throw vehErr

    const vehList = vehicules ?? []

    // ─── 2. Complétude sur les 2 derniers jours (hier + avant-hier) ───────
    // On regarde 2 jours en arrière pour avoir un fallback "hier était dimanche"
    // ou férié → on peut afficher l'avant-veille.
    const j2DaysAgo = new Date(now)
    j2DaysAgo.setUTCDate(j2DaysAgo.getUTCDate() - 2)
    const fromStr = j2DaysAgo.toISOString().slice(0, 10)

    const { cases } = await getCompletude(supabaseAdmin, {
      from: fromStr,
      to:   yesterday,
    })

    // Index par véhicule : on garde la case la plus récente (= hier si dispo)
    const caseByVeh = new Map<number, typeof cases[number]>()
    for (const c of cases) {
      const existing = caseByVeh.get(c.id_vehicule)
      if (!existing || c.date > existing.date) caseByVeh.set(c.id_vehicule, c)
    }

    // ─── 3. Courses Yango du jour pour le résumé (optionnel, non bloquant)
    let coursesJour = 0
    try {
      const { count } = await supabaseAdmin
        .from("commandes_yango")
        .select("id", { count: "exact", head: true })
        .gte("ended_at", `${today}T00:00:00Z`)
        .lte("ended_at", `${today}T23:59:59Z`)
        .eq("status", "complete")
      coursesJour = count ?? 0
    } catch {
      coursesJour = 0
    }

    // ─── 4. Cash net du jour (recettes - dépenses) ────────────────────────
    let cashNet = 0
    try {
      const [recRes, depRes] = await Promise.all([
        supabaseAdmin
          .from("recettes_wave")
          .select("\"Montant net\"")
          .gte("Horodatage", `${today}T00:00:00Z`)
          .lte("Horodatage", `${today}T23:59:59Z`)
          .gt("Montant net", 0),
        supabaseAdmin
          .from("depenses_vehicules")
          .select("montant, type_depense")
          .eq("date_depense", today),
      ])
      const recettes = (recRes.data ?? []).reduce((s, r) => {
        const m = Number((r as Record<string, unknown>)["Montant net"] ?? 0)
        return s + (Number.isFinite(m) ? m : 0)
      }, 0)
      const depenses = (depRes.data ?? [])
        .filter(d => {
          const t = String((d as { type_depense?: string | null }).type_depense ?? "").toLowerCase()
          return !t.includes("reversement")
        })
        .reduce((s, d) => s + Number((d as { montant?: number }).montant ?? 0), 0)
      cashNet = Math.round(recettes - depenses)
    } catch {
      cashNet = 0
    }

    // ─── 5. Construire la liste véhicules + résumé ─────────────────────────
    const list: FlotteVehicule[] = vehList.map(v => {
      // Véhicule non actif → "pause"
      if (v.statut !== "ACTIF") {
        return {
          id_vehicule:     v.id_vehicule,
          immatriculation: v.immatriculation,
          statut:          "pause",
          meta_principale: "en pause",
        }
      }

      const c = caseByVeh.get(v.id_vehicule)

      if (!c) {
        // Véhicule actif mais sans case dans la fenêtre récente
        return {
          id_vehicule:     v.id_vehicule,
          immatriculation: v.immatriculation,
          statut:          "a_jour",
          meta_principale: "aucune activité",
        }
      }

      // Retard : manquant ou paye_insuffisant
      if (c.statut === "manquant") {
        // Calcul jours de retard : aujourd'hui - jour exploitation
        const dDiff = Math.max(
          1,
          Math.floor((new Date(today).getTime() - new Date(c.date).getTime()) / 86_400_000),
        )
        return {
          id_vehicule:     v.id_vehicule,
          immatriculation: v.immatriculation,
          statut:          "retard",
          meta_principale: dDiff === 1 ? "retard 1j" : `retard ${dDiff}j`,
        }
      }
      if (c.statut === "paye_insuffisant") {
        const manque = Math.max(0, c.montant_attendu - c.montant_recu)
        return {
          id_vehicule:     v.id_vehicule,
          immatriculation: v.immatriculation,
          statut:          "retard",
          meta_principale: `manque ${formatK(manque)}`,
        }
      }

      // À jour (paye_complet / paye_justifie / manquant_justifie / jour_ferie / en_cours / pre_service)
      const meta = c.statut === "jour_ferie_auto"
        ? "férié"
        : c.statut === "manquant_justifie" || c.statut === "paye_justifie"
          ? "justifié"
          : c.statut === "en_cours"
            ? "en cours"
            : c.statut === "pre_service"
              ? "hors flotte"
              : `${formatK(c.montant_recu)} hier`
      return {
        id_vehicule:     v.id_vehicule,
        immatriculation: v.immatriculation,
        statut:          "a_jour",
        meta_principale: meta,
      }
    })

    const resume: FlotteResume = {
      total:        list.length,
      a_jour:       list.filter(v => v.statut === "a_jour").length,
      retard:       list.filter(v => v.statut === "retard").length,
      pause:        list.filter(v => v.statut === "pause").length,
      courses_jour: coursesJour,
      cash_net:     cashNet,
    }

    return NextResponse.json({ ok: true, data: { vehicules: list, resume } })
  } catch (e) {
    console.error("[cockpit/flotte]", e)
    return NextResponse.json(
      { ok: false, error: (e as Error).message || "Erreur serveur" },
      { status: 500 },
    )
  }
}

/** Format compact "22 K" / "1,2 M" pour les tuiles véhicule. */
function formatK(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} M`
  if (abs >= 1_000)     return `${Math.round(n / 1_000)} K`
  return `${Math.round(n)}`
}
