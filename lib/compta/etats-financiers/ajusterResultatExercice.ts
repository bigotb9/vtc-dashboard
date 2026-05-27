/**
 * PHASE 4.3 — Module 1 : Wrapper Node de la RPC `ajuster_resultat_exercice`.
 *
 * (Re)crée l'écriture comptable automatique d'ajustement du résultat
 * (compte 13) AVANT chaque export Bilan / clôture.
 *
 * - Si l'exercice est OUVERT : on recalcule librement (insert/delete)
 * - Si l'exercice est CLOS   : on N'APPELLE PAS cette fonction (l'écriture
 *                              auto a été figée à la clôture)
 *
 * Voir migration 20260520100000_phase43_auto_ecriture_resultat.sql.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"

export interface AjusterResultatResult {
  ecriture_id:  string | null
  resultat_net: number
  type_montant: "benefice" | "perte" | "nul"
  numero:       string | null
}

/**
 * Appel standard (exercice ouvert).
 * Throws si l'exercice est clos — utiliser `ajusterResultatExerciceForce`
 * pour les cas de recovery admin.
 */
export async function ajusterResultatExercice(exerciceId: string): Promise<AjusterResultatResult> {
  return ajusterResultatExerciceInternal(exerciceId, false)
}

/**
 * Variante avec bypass du verrou clôture. À RÉSERVER aux scénarios de
 * correction d'erreur post-clôture (admin DSI). Trace tout dans les logs.
 */
export async function ajusterResultatExerciceForce(exerciceId: string): Promise<AjusterResultatResult> {
  console.warn("[ajusterResultatExercice] force=TRUE — bypass verrou clôture pour exercice", exerciceId)
  return ajusterResultatExerciceInternal(exerciceId, true)
}

async function ajusterResultatExerciceInternal(
  exerciceId: string,
  forceRecalcul: boolean,
): Promise<AjusterResultatResult> {
  const { data, error } = await supabaseAdmin.rpc("ajuster_resultat_exercice", {
    p_exercice_id:    exerciceId,
    p_force_recalcul: forceRecalcul,
  })
  if (error) {
    throw new Error(`ajuster_resultat_exercice: ${error.message}`)
  }
  const row = Array.isArray(data) && data.length > 0 ? data[0] : null
  if (!row) {
    return { ecriture_id: null, resultat_net: 0, type_montant: "nul", numero: null }
  }
  return {
    ecriture_id:  row.ecriture_id ?? null,
    resultat_net: row.resultat_net != null ? Number(row.resultat_net) : 0,
    type_montant: (row.type_montant ?? "nul") as "benefice" | "perte" | "nul",
    numero:       row.numero ?? null,
  }
}

/**
 * Tente le recalcul SI l'exercice est ouvert. Sinon log et continue.
 * Idéal pour le hook "avant export PDF Bilan" : on ne veut pas faire
 * planter l'export si l'exercice est déjà clos (l'écriture est déjà figée).
 */
export async function ajusterResultatSiOuvert(exerciceId: string): Promise<AjusterResultatResult | null> {
  // Petite optimisation : check statut d'abord
  const { data: ex, error: exErr } = await supabaseAdmin
    .from("exercices")
    .select("id, statut")
    .eq("id", exerciceId)
    .maybeSingle()
  if (exErr || !ex) {
    console.warn("[ajusterResultatSiOuvert] exercice introuvable :", exerciceId, exErr)
    return null
  }
  if (ex.statut !== "ouvert") {
    // Exercice clos : on conserve l'écriture déjà figée, pas de recalcul.
    return null
  }
  try {
    return await ajusterResultatExercice(exerciceId)
  } catch (e) {
    // On log sans faire échouer l'export Bilan : la valeur affichée
    // peut être légèrement décalée mais l'export reste utilisable.
    console.error("[ajusterResultatSiOuvert] échec :", (e as Error).message)
    return null
  }
}
