/**
 * POST /api/recettes/create
 *
 * Crée une recette manuelle dans la table legacy `recettes_wave`,
 * puis déclenche la reprise automatique vers `operations` (Phase 4.x patch
 * sync legacy → operations — corrige le bug des 455 recettes orphelines).
 *
 * Sync inverse (operations → legacy) déjà couverte par le trigger Vague 3.6.
 * Cette route alimente le sens manquant : legacy → operations.
 */

import { NextRequest, NextResponse } from "next/server"
import { logActivity } from "@/lib/logActivity"
import { requirePermission } from "@/lib/requirePermission"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { repriseRecettesWave } from "@/lib/compta/reprise"

/** Extrait une date YYYY-MM-DD depuis un horodatage Wave (ISO ou timestamp). */
function extractDateYmd(horodatage: unknown): string | null {
  if (!horodatage) return null
  const s = String(horodatage).trim()
  // Format attendu : "YYYY-MM-DD..." (ISO) ou "YYYY-MM-DD HH:MM:SS"
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s)
  if (m) return m[1]
  // Fallback : tenter un parse Date
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10)
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, "manage_recettes")
    if (!auth.ok) return auth.response

    const token = req.headers.get("authorization")?.replace("Bearer ", "") || ""

    const body = await req.json()

    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "Corps de requête invalide" }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from("recettes_wave")
      .insert([body])

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }

    await logActivity({
      token,
      action:  "create_recette",
      entity:  null,
      details: { montant: body["Montant net"], horodatage: body["Horodatage"] },
    })

    // ─── Reprise auto legacy → operations (non bloquant) ─────────────────────
    // Sur exactement 1 ligne créée : on cible la journée de l'horodatage.
    // Si la reprise échoue (exercice clos, mapping manquant, fixtures KO…),
    // l'INSERT legacy reste effectué et on retourne succès au client.
    const dateYmd = extractDateYmd(body["Horodatage"])
    if (dateYmd) {
      try {
        const stats = await repriseRecettesWave(auth.user.id, {
          date_from: dateYmd,
          date_to:   dateYmd,
        })
        // Warnings non bloquants → log info pour traçabilité
        if (stats.warnings.length > 0 || stats.ecritures_echouees > 0) {
          await logActivity({
            token,
            action:  "compta.reprise_auto.warnings",
            entity:  null,
            details: {
              source: "recettes_wave",
              date:   dateYmd,
              creees: stats.creees,
              ecritures_echouees: stats.ecritures_echouees,
              warnings: stats.warnings.slice(0, 10),
            },
          })
        }
      } catch (repriseErr) {
        // Échec total de la reprise : on log mais on n'échoue pas le client.
        await logActivity({
          token,
          action:  "compta.reprise_auto.failed",
          entity:  null,
          details: {
            source: "recettes_wave",
            date:   dateYmd,
            error:  (repriseErr as Error).message,
          },
        })
        console.error("[recettes/create] reprise échouée (non bloquant) :", repriseErr)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
}
