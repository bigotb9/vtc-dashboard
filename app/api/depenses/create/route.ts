/**
 * POST /api/depenses/create
 *
 * Cree une depense manuelle dans la table legacy `depenses_vehicules`,
 * puis declenche la reprise automatique vers `operations`.
 *
 * Phase 4.x patch sync legacy -> operations.
 */

import { NextRequest, NextResponse } from "next/server"
import { logActivity } from "@/lib/logActivity"
import { requirePermission } from "@/lib/requirePermission"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { repriseDepensesVehicules } from "@/lib/compta/reprise"

/** Extrait une date YYYY-MM-DD depuis une date_depense (string YYYY-MM-DD ou ISO). */
function extractDateYmd(dateDepense: unknown): string | null {
  if (!dateDepense) return null
  const s = String(dateDepense).trim()
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s)
  if (m) return m[1]
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, "manage_depenses")
    if (!auth.ok) return auth.response

    const token = req.headers.get("authorization")?.replace("Bearer ", "") || ""

    const body = await req.json()

    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "Corps de requete invalide" }, { status: 400 })
    }

    // L4 patch 18/05/2026 - Refus type='Reversement client'.
    // Les reversements clients ne doivent jamais passer par /api/depenses/create
    // (qui alimente depenses_vehicules). Les reversements clients ont leur
    // propre table (`versements_clients`) avec categorie comptable dediee
    // (4119 - Reversement client sous gestion) et leur propre flux.
    const typeDepenseStr = String(body.type_depense ?? "").toLowerCase()
    if (typeDepenseStr.includes("reversement")) {
      return NextResponse.json({
        success: false,
        error:   "Les reversements clients ne se saisissent pas ici. Utilisez la page Versements Clients.",
        code:    "INVALID_TYPE_DEPENSE",
      }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from("depenses_vehicules")
      .insert([body])

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }

    await logActivity({
      token,
      action:  "create_depense",
      entity:  body.immatriculation || null,
      details: { type: body.type_depense, montant: body.montant, immatriculation: body.immatriculation },
    })

    // Reprise auto legacy -> operations (non bloquant).
    // Si la reprise echoue (exercice clos, mapping manquant, fixtures KO),
    // l'INSERT legacy reste effectue et on retourne succes au client.
    const dateYmd = extractDateYmd(body.date_depense)
    if (dateYmd) {
      try {
        const stats = await repriseDepensesVehicules(auth.user.id, {
          date_from: dateYmd,
          date_to:   dateYmd,
        })
        if (stats.warnings.length > 0 || stats.ecritures_echouees > 0) {
          await logActivity({
            token,
            action:  "compta.reprise_auto.warnings",
            entity:  null,
            details: {
              source: "depenses_vehicules",
              date:   dateYmd,
              creees: stats.creees,
              ecritures_echouees: stats.ecritures_echouees,
              warnings: stats.warnings.slice(0, 10),
            },
          })
        }
      } catch (repriseErr) {
        await logActivity({
          token,
          action:  "compta.reprise_auto.failed",
          entity:  null,
          details: {
            source: "depenses_vehicules",
            date:   dateYmd,
            error:  (repriseErr as Error).message,
          },
        })
        console.error("[depenses/create] reprise echouee (non bloquant) :", repriseErr)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
}
