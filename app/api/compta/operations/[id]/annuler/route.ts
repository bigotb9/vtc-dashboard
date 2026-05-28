/**
 * POST /api/compta/operations/[id]/annuler
 *
 * Transition statut : 'valide' → 'annule'.
 * En mode Avancé, génère AVANT le UPDATE l'écriture d'extourne
 * (genererEcritureExtourne). Si l'extourne échoue, on ne touche pas au statut
 * pour ne jamais avoir d'opération annulée sans extourne.
 *
 * Réservé directeur. Référence : doc Phase 2 Day 5 §4.
 *
 * Body (optionnel) : { "raison": "<texte ≤ 500 chars>" }
 *
 * Réponse 200 :
 *   { data: { id, statut, ecriture_extourne_id, ecriture_extourne_numero } }
 *   Les deux derniers sont null en mode Simple.
 */

import type { NextRequest } from "next/server"
import { z } from "zod"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { logActivity } from "@/lib/logActivity"
import { requireComptaPermission } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { getModeActif, genererEcritureExtourne, EcritureError } from "@/lib/compta/ecritures"
import { getExerciceForDate } from "@/lib/compta/soldes"
import { safeParse } from "@/lib/compta/validators"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

const annulerSchema = z.object({
  raison: z.string().max(500).optional(),
})

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireComptaPermission(req, "manage_comptabilite")
  if (!auth.ok) return auth.response

  const { id } = await ctx.params

  // 1. Body optionnel
  let raison: string | undefined
  try {
    const txt = await req.text()
    if (txt && txt.trim().length > 0) {
      const json = JSON.parse(txt)
      const parsed = safeParse(annulerSchema, json)
      if (!parsed.ok) return comptaError("INVALID_PAYLOAD", { issues: parsed.details })
      raison = parsed.data.raison
    }
  } catch {
    return comptaError("INVALID_PAYLOAD", { reason: "JSON malformé" })
  }

  // 2. Charger l'opération
  const { data: op, error: loadErr } = await supabaseAdmin
    .from("operations")
    .select("id, statut, ecriture_id, libelle, date_operation, notes")
    .eq("id", id)
    .maybeSingle()
  if (loadErr) return comptaError("DB_ERROR", { hint: loadErr.message })
  if (!op)     return comptaError("NOT_FOUND")

  // 3. Statut doit être 'valide'
  if (op.statut !== "valide") {
    return comptaError(
      "CONFLICT",
      { statut_actuel: op.statut },
      "Seules les opérations validées peuvent être annulées",
    )
  }

  // 4. Période / exercice de l'annulation = today (pas date_operation)
  const today   = new Date().toISOString().slice(0, 10)
  const periode = today.slice(0, 7)

  let exerciceAnn
  try {
    exerciceAnn = await getExerciceForDate(today)
  } catch (e) {
    return comptaError("EXERCICE_CLOSED", { hint: (e as Error).message }, "Aucun exercice ouvert pour la date du jour")
  }
  if (exerciceAnn.cloture) {
    return comptaError("EXERCICE_CLOSED", { exercice_id: exerciceAnn.id })
  }

  const { data: cloture } = await supabaseAdmin
    .from("clotures")
    .select("id")
    .eq("exercice_id", exerciceAnn.id)
    .eq("type", "mensuelle")
    .eq("periode", periode)
    .maybeSingle()
  if (cloture) return comptaError("PERIOD_CLOSED", { periode })

  // 5. Mode actif (informatif uniquement)
  const mode = await getModeActif()
  console.log(`[annuler] operation_id=${id} statut=${op.statut} ecriture_id=${op.ecriture_id} mode=${mode}`)

  // 6. Extourne AVANT le UPDATE — la création dépend de la présence d'une
  //    écriture d'origine, PAS du mode actif courant.
  let ecritureExtourneId:     string | null = null
  let ecritureExtourneNumero: string | null = null

  if (op.ecriture_id) {
    console.log(`[annuler] calling genererEcritureExtourne…`)
    try {
      ecritureExtourneId = await genererEcritureExtourne(id)
      console.log(`[annuler] genererEcritureExtourne returned id=${ecritureExtourneId}`)
    } catch (e) {
      console.error(`[annuler] genererEcritureExtourne THREW:`, e)
      if (e instanceof EcritureError) {
        const allowed = new Set([
          "PERIOD_CLOSED",
          "EXERCICE_CLOSED",
          "ECRITURE_DESEQUILIBREE",
          "NOT_FOUND",
          "CONFLICT",
        ])
        const code = allowed.has(e.code) ? e.code : "INTERNAL_ERROR"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return comptaError(code as any, e.details, e.message)
      }
      return comptaError("INTERNAL_ERROR", { hint: (e as Error).message }, `Génération extourne échouée : ${(e as Error).message}`)
    }

    // 6bis. DURE FAIL : sanity check post-création.
    //       L'extourne doit exister en BD, avoir extourne_de = ecriture_id de
    //       l'opération, et être en statut='valide'. Sinon → 500 sans toucher
    //       à l'opération source (pas de UPDATE statut='annule').
    if (!ecritureExtourneId) {
      console.error(`[annuler] genererEcritureExtourne returned falsy id`)
      return comptaError(
        "INTERNAL_ERROR",
        { operation_id: id },
        "Extourne non créée (helper a retourné un id invalide)",
      )
    }
    const { data: check, error: checkErr } = await supabaseAdmin
      .from("ecritures_comptables")
      .select("id, numero, extourne_de, statut")
      .eq("id", ecritureExtourneId)
      .maybeSingle()
    if (checkErr || !check) {
      console.error(`[annuler] post-create check FAILED:`, { checkErr, check })
      return comptaError(
        "INTERNAL_ERROR",
        { extourne_id: ecritureExtourneId, hint: checkErr?.message },
        "Extourne créée mais introuvable au re-SELECT",
      )
    }
    if (check.extourne_de !== op.ecriture_id || check.statut !== "valide") {
      console.error(`[annuler] post-create check INVALID:`, check)
      return comptaError(
        "INTERNAL_ERROR",
        { extourne_id: check.id, extourne_de: check.extourne_de, statut: check.statut, attendu_extourne_de: op.ecriture_id },
        "Extourne créée mais lien extourne_de ou statut invalides",
      )
    }
    ecritureExtourneNumero = check.numero
    console.log(`[annuler] extourne validée — id=${check.id} numero=${check.numero}`)
  } else {
    // Cas exceptionnel : opération `valide` SANS écriture d'origine.
    //
    // En théorie ne devrait arriver qu'en mode Simple natif (l'écriture n'a
    // jamais été générée). En pratique post-bootstrap+toggle Avancé, toutes les
    // opérations validées doivent avoir une écriture. Une op `valide` sans
    // `ecriture_id` traduit donc un état incohérent — on refuse l'annulation
    // pour ne pas masquer le problème (au lieu de skipper silencieusement).
    console.error(`[annuler] operation ${id} is valide but has NO ecriture_id — refusing.`)
    return comptaError(
      "CONFLICT",
      { operation_id: id, mode_actif: mode },
      "Opération validée sans écriture d'origine — impossible d'extourner. " +
      "Si on est en mode Simple natif, basculer en Avancé d'abord ; sinon, " +
      "vérifier la cohérence via /api/compta/health.",
    )
  }

  // 7. UPDATE statut='annule' + ajout du motif aux notes (conformément §3.4)
  const notesUpdated = (() => {
    if (!raison) return op.notes ?? null
    const prefix = `[Annulation] ${raison}`
    return op.notes && op.notes.trim().length > 0
      ? `${op.notes}\n${prefix}`
      : prefix
  })()

  console.log(`[annuler] UPDATE operation statut=annule (extourne_id=${ecritureExtourneId})`)
  const { error: updErr } = await supabaseAdmin
    .from("operations")
    .update({
      statut:     "annule",
      notes:      notesUpdated,
      updated_at: new Date().toISOString(),
      updated_by: auth.user.id,
    })
    .eq("id", id)
  if (updErr) {
    console.error(`[annuler] UPDATE operation FAILED:`, updErr)
    return comptaError("DB_ERROR", { hint: updErr.message })
  }
  console.log(`[annuler] DONE — operation_id=${id} extourne=${ecritureExtourneNumero}`)

  // 8. Log activité
  await logActivity({
    token:   auth.token,
    action:  "compta.operation.annuler",
    entity:  id,
    details: {
      libelle:               op.libelle,
      mode,
      ecriture_extourne_id:  ecritureExtourneId,
      raison:                raison ?? null,
    },
  })

  return comptaOk({
    id,
    statut:                    "annule",
    ecriture_extourne_id:      ecritureExtourneId,
    ecriture_extourne_numero:  ecritureExtourneNumero,
  })
}
