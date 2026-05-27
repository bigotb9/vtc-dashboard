/**
 * POST /api/recettes/import
 *
 * Import batch (CSV Wave) dans la table legacy `recettes_wave`, puis
 * déclenche la reprise automatique vers `operations` sur la fenêtre
 * temporelle min(Horodatage) → max(Horodatage) du batch.
 *
 * Idempotent grâce à UNIQUE(source, source_ref) côté operations + à
 * l'upsert onConflict côté recettes_wave.
 *
 * Phase 4.x patch sync legacy → operations.
 */

import { NextRequest, NextResponse } from "next/server"
import { logActivity } from "@/lib/logActivity"
import { requirePermission } from "@/lib/requirePermission"
import { supabase } from "@/lib/supabaseClient"
import { repriseRecettesWave } from "@/lib/compta/reprise"

/** Extrait une date YYYY-MM-DD depuis un horodatage Wave (ISO ou timestamp). */
function extractDateYmd(horodatage: unknown): string | null {
  if (!horodatage) return null
  const s = String(horodatage).trim()
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s)
  if (m) return m[1]
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

export async function POST(req: NextRequest) {
  // ─── Auth (cohérent avec /api/recettes/create) ─────────────────────────────
  const auth = await requirePermission(req, "manage_recettes")
  if (!auth.ok) return auth.response

  const token = req.headers.get("authorization")?.replace("Bearer ", "") || ""

  const rows = await req.json()

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ success: false, error: "Fichier CSV vide ou invalide" }, { status: 400 })
  }

  // ─── INSERT legacy (existant, par chunks de 500) ───────────────────────────
  const chunkSize = 500
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await supabase
      .from("recettes_wave")
      .upsert(chunk, { onConflict: "Identifiant de transaction" })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
  }

  // ─── Reprise auto legacy → operations (non bloquant) ──────────────────────
  // Calcul des bornes min/max d'horodatage du batch pour cibler la fenêtre.
  let minYmd: string | null = null
  let maxYmd: string | null = null
  for (const r of rows as Array<Record<string, unknown>>) {
    const ymd = extractDateYmd(r["Horodatage"])
    if (!ymd) continue
    if (minYmd === null || ymd < minYmd) minYmd = ymd
    if (maxYmd === null || ymd > maxYmd) maxYmd = ymd
  }

  let repriseStats: { creees: number; deja_existantes: number } | null = null

  if (minYmd && maxYmd) {
    try {
      const stats = await repriseRecettesWave(auth.user.id, {
        date_from: minYmd,
        date_to:   maxYmd,
      })
      repriseStats = { creees: stats.creees, deja_existantes: stats.deja_existantes }

      if (stats.warnings.length > 0 || stats.ecritures_echouees > 0) {
        await logActivity({
          token,
          action:  "compta.reprise_auto.warnings",
          entity:  null,
          details: {
            source:   "recettes_wave.import",
            date_from: minYmd,
            date_to:   maxYmd,
            batch_size: rows.length,
            creees:     stats.creees,
            deja_existantes: stats.deja_existantes,
            ecritures_echouees: stats.ecritures_echouees,
            warnings:  stats.warnings.slice(0, 10),
          },
        })
      }
    } catch (repriseErr) {
      await logActivity({
        token,
        action:  "compta.reprise_auto.failed",
        entity:  null,
        details: {
          source:   "recettes_wave.import",
          date_from: minYmd,
          date_to:   maxYmd,
          batch_size: rows.length,
          error: (repriseErr as Error).message,
        },
      })
      console.error("[recettes/import] reprise échouée (non bloquant) :", repriseErr)
    }
  }

  return NextResponse.json({
    success: true,
    count:   rows.length,
    // Stats reprise auto, exposées pour debug client (optionnel).
    reprise: repriseStats,
  })
}
