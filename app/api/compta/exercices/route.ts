/**
 * GET  /api/compta/exercices — Liste enrichie (nb_operations + nb_brouillons).
 * POST /api/compta/exercices — Création d'un nouvel exercice (statut='ouvert').
 *
 * Phase 4.2 Module 2 §3.
 */

import type { NextRequest } from "next/server"
import { logActivity } from "@/lib/logActivity"
import { requireComptaPermission } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { safeParse, exerciceCreateSchema } from "@/lib/compta/validators"
import { listExercices } from "@/lib/compta/exercices/listExercices"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const auth = await requireComptaPermission(req, "view_comptabilite")
  if (!auth.ok) return auth.response
  try {
    const items = await listExercices()
    return comptaOk(items)
  } catch (e) {
    console.error("[exercices.list]", e)
    return comptaError("DB_ERROR", { hint: (e as Error).message })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireComptaPermission(req, "manage_exercices")
  if (!auth.ok) return auth.response

  let body: unknown = {}
  try { body = await req.json() } catch { /* body vide */ }
  const parsed = safeParse(exerciceCreateSchema, body)
  if (!parsed.ok) return comptaError("INVALID_PAYLOAD", { issues: parsed.details })

  const annee     = parsed.data.annee
  const dateDebut = parsed.data.date_debut ?? `${annee}-01-01`
  const dateFin   = parsed.data.date_fin   ?? `${annee}-12-31`
  const libelle   = `Exercice ${annee}`

  // Vérifier doublon
  const { data: existing } = await supabaseAdmin
    .from("exercices")
    .select("id")
    .eq("annee", annee)
    .maybeSingle()
  if (existing) {
    return comptaError("ALREADY_EXISTS", { annee }, `Exercice ${annee} existe déjà`)
  }

  const { data, error } = await supabaseAdmin
    .from("exercices")
    .insert({
      annee, libelle,
      date_debut: dateDebut,
      date_fin:   dateFin,
      statut:     "ouvert",
      cloture:    false,
    })
    .select("id")
    .single()
  if (error || !data) return comptaError("DB_ERROR", { hint: error?.message })

  await logActivity({
    token:   auth.token,
    action:  "compta.exercice.create",
    entity:  data.id,
    details: { annee, date_debut: dateDebut, date_fin: dateFin },
  })

  return comptaOk({ id: data.id, annee, libelle, date_debut: dateDebut, date_fin: dateFin, statut: "ouvert" }, { status: 201 })
}
