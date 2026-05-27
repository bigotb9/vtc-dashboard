/**
 * Workflow de clôture d'un exercice (Phase 4.2 Module 2 §3.4).
 *
 * Étapes :
 *   1. Vérifier qu'aucune opération de l'exercice n'est en `brouillon`
 *   2. Calculer le résultat net (Σ produits classe 7 − Σ charges classe 6,
 *      cohérent avec computeResultatNet partagé avec le Compte de résultat)
 *   3. Update exercices.statut='clos' + date_cloture + resultat_net
 *   4. Crée automatiquement l'exercice suivant en 'ouvert' s'il n'existe pas
 *   5. Retourne le résultat + les paths PDF (à générer en aval par les routes
 *      export)
 *
 * NB : la génération PDF Bilan / CR est déclenchée par les routes
 * /bilan/export-pdf et /compte-resultat/export-pdf. Pour V1, on n'archive
 * pas automatiquement à la clôture — l'utilisateur exporte manuellement.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { computeResultatNet } from "@/lib/compta/etats-financiers/computeResultatNet"
import { ajusterResultatExercice } from "@/lib/compta/etats-financiers/ajusterResultatExercice"

export type CloturerResult =
  | { ok: true; data: { exercice_id: string; resultat_net: number; next_exercice_id: string | null } }
  | { ok: false; code: "BROUILLONS_PRESENTS" | "ALREADY_CLOSED" | "NOT_FOUND" | "DB_ERROR"; message: string; details?: unknown }

export async function cloturerExercice(exerciceId: string, userId: string): Promise<CloturerResult> {
  // 1. Charger l'exercice
  const { data: ex, error: exErr } = await supabaseAdmin
    .from("exercices")
    .select("id, annee, date_debut, date_fin, statut")
    .eq("id", exerciceId)
    .maybeSingle()
  if (exErr) return { ok: false, code: "DB_ERROR", message: exErr.message }
  if (!ex)   return { ok: false, code: "NOT_FOUND", message: "Exercice introuvable" }
  if (ex.statut === "clos") return { ok: false, code: "ALREADY_CLOSED", message: "Exercice déjà clos" }

  // 2. Vérifier brouillons
  const { count: nbBrouillons, error: cErr } = await supabaseAdmin
    .from("operations")
    .select("*", { count: "exact", head: true })
    .eq("exercice_id", exerciceId)
    .eq("statut", "brouillon")
  if (cErr) return { ok: false, code: "DB_ERROR", message: cErr.message }
  if ((nbBrouillons ?? 0) > 0) {
    return {
      ok: false,
      code: "BROUILLONS_PRESENTS",
      message: `${nbBrouillons} opération(s) en brouillon. Validez ou supprimez-les avant de clôturer.`,
      details: { nb_brouillons: nbBrouillons },
    }
  }

  // 3. ✦ PHASE 4.3 — Une dernière fois AVANT le passage à 'clos', on
  //    (re)crée l'auto-écriture résultat au compte 13. Elle sera ensuite
  //    figée par le trigger enforce_exercice_clos_lock_ecriture.
  let resultatNet: number
  try {
    const adj = await ajusterResultatExercice(exerciceId)
    resultatNet = adj.resultat_net
  } catch (e) {
    console.warn("[cloturerExercice] ajusterResultatExercice échec, fallback computeResultatNet :", (e as Error).message)
    resultatNet = await computeResultatNet(exerciceId, ex.date_debut, ex.date_fin)
  }

  // 4. UPDATE statut + métadonnées
  const nowIso = new Date().toISOString()
  const { error: updErr } = await supabaseAdmin
    .from("exercices")
    .update({
      statut:       "clos",
      cloture:      true,                   // back-compat colonne Phase 1
      date_cloture: nowIso,
      cloture_le:   nowIso,                 // back-compat
      cloture_par:  userId,
      resultat_net: Math.round(resultatNet),
    })
    .eq("id", exerciceId)
  if (updErr) return { ok: false, code: "DB_ERROR", message: updErr.message }

  // 5. Créer l'exercice suivant si absent
  const nextYear = ex.annee + 1
  const { data: existingNext } = await supabaseAdmin
    .from("exercices")
    .select("id")
    .eq("annee", nextYear)
    .maybeSingle()
  let nextExerciceId: string | null = existingNext?.id ?? null
  if (!nextExerciceId) {
    const { data: created, error: nErr } = await supabaseAdmin
      .from("exercices")
      .insert({
        annee:      nextYear,
        libelle:    `Exercice ${nextYear}`,
        date_debut: `${nextYear}-01-01`,
        date_fin:   `${nextYear}-12-31`,
        statut:     "ouvert",
        cloture:    false,
      })
      .select("id")
      .single()
    if (!nErr && created) nextExerciceId = created.id
  }

  return {
    ok: true,
    data: { exercice_id: exerciceId, resultat_net: resultatNet, next_exercice_id: nextExerciceId },
  }
}
