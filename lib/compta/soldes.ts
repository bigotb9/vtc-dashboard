/**
 * Calculs de solde courant pour comptes bancaires et caisses.
 *
 * Convention métier (doc Phase 2 §1.5 + §4.5) :
 *   solde_courant = solde_initial + Σ(operations.montant where type='entree' & statut='valide')
 *                                 - Σ(operations.montant where type='sortie' & statut='valide')
 *   Les opérations 'brouillon' ou 'annule' n'impactent JAMAIS le solde.
 *
 * Utilise supabaseAdmin (clé service role) — cohérent avec le pattern existant
 * du projet où les routes API serveur consomment supabaseAdmin pour bypasser RLS.
 *
 * À utiliser uniquement depuis des routes API serveur (jamais depuis le client).
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"

/** Solde courant d'un compte bancaire à une date donnée (par défaut : aujourd'hui). */
export async function getSoldeCompte(compteId: string, dateMax?: string): Promise<number> {
  const { data: compte, error: e1 } = await supabaseAdmin
    .from("comptes")
    .select("solde_initial, date_solde_initial")
    .eq("id", compteId)
    .single()

  if (e1 || !compte) {
    throw new Error(`Compte introuvable : ${compteId}`)
  }

  let q = supabaseAdmin
    .from("operations")
    .select("type, montant")
    .eq("compte_id", compteId)
    .eq("statut", "valide")

  if (dateMax) q = q.lte("date_operation", dateMax)

  const { data: ops, error: e2 } = await q
  if (e2) throw e2

  const variation = (ops || []).reduce(
    (acc, op) => acc + (op.type === "entree" ? Number(op.montant) : -Number(op.montant)),
    0,
  )
  return Number(compte.solde_initial) + variation
}

/** Solde courant d'une caisse à une date donnée (par défaut : aujourd'hui). */
export async function getSoldeCaisse(caisseId: string, dateMax?: string): Promise<number> {
  const { data: caisse, error: e1 } = await supabaseAdmin
    .from("caisses")
    .select("solde_initial, date_solde_initial")
    .eq("id", caisseId)
    .single()

  if (e1 || !caisse) {
    throw new Error(`Caisse introuvable : ${caisseId}`)
  }

  let q = supabaseAdmin
    .from("operations")
    .select("type, montant")
    .eq("caisse_id", caisseId)
    .eq("statut", "valide")

  if (dateMax) q = q.lte("date_operation", dateMax)

  const { data: ops, error: e2 } = await q
  if (e2) throw e2

  const variation = (ops || []).reduce(
    (acc, op) => acc + (op.type === "entree" ? Number(op.montant) : -Number(op.montant)),
    0,
  )
  return Number(caisse.solde_initial) + variation
}

/**
 * Détails complets de solde — utilisés par GET /api/compta/comptes/[id]/solde
 * et GET /api/compta/caisses/[id]/solde.
 */
export type SoldeDetail = {
  cible_id:            string
  cible_kind:          "compte" | "caisse"
  date:                string
  solde_initial:       number
  total_entrees:       number
  total_sorties:       number
  solde_courant:       number
}

export async function getSoldeCompteDetail(compteId: string, dateMax?: string): Promise<SoldeDetail> {
  const today = new Date().toISOString().slice(0, 10)
  const date  = dateMax ?? today

  const { data: compte, error: e1 } = await supabaseAdmin
    .from("comptes")
    .select("solde_initial")
    .eq("id", compteId)
    .single()

  if (e1 || !compte) throw new Error(`Compte introuvable : ${compteId}`)

  const { data: ops, error: e2 } = await supabaseAdmin
    .from("operations")
    .select("type, montant")
    .eq("compte_id", compteId)
    .eq("statut", "valide")
    .lte("date_operation", date)

  if (e2) throw e2

  let total_entrees = 0
  let total_sorties = 0
  for (const op of ops || []) {
    if (op.type === "entree") total_entrees += Number(op.montant)
    else                      total_sorties += Number(op.montant)
  }
  const solde_initial = Number(compte.solde_initial)
  return {
    cible_id:        compteId,
    cible_kind:      "compte",
    date,
    solde_initial,
    total_entrees,
    total_sorties,
    solde_courant: solde_initial + total_entrees - total_sorties,
  }
}

export async function getSoldeCaisseDetail(caisseId: string, dateMax?: string): Promise<SoldeDetail> {
  const today = new Date().toISOString().slice(0, 10)
  const date  = dateMax ?? today

  const { data: caisse, error: e1 } = await supabaseAdmin
    .from("caisses")
    .select("solde_initial")
    .eq("id", caisseId)
    .single()

  if (e1 || !caisse) throw new Error(`Caisse introuvable : ${caisseId}`)

  const { data: ops, error: e2 } = await supabaseAdmin
    .from("operations")
    .select("type, montant")
    .eq("caisse_id", caisseId)
    .eq("statut", "valide")
    .lte("date_operation", date)

  if (e2) throw e2

  let total_entrees = 0
  let total_sorties = 0
  for (const op of ops || []) {
    if (op.type === "entree") total_entrees += Number(op.montant)
    else                      total_sorties += Number(op.montant)
  }
  const solde_initial = Number(caisse.solde_initial)
  return {
    cible_id:        caisseId,
    cible_kind:      "caisse",
    date,
    solde_initial,
    total_entrees,
    total_sorties,
    solde_courant: solde_initial + total_entrees - total_sorties,
  }
}

/**
 * Résout l'exercice (id) qui couvre la date donnée.
 * Lève si aucun exercice ouvert ne couvre la date, ou si l'exercice est clôturé.
 */
export async function getExerciceForDate(date: string): Promise<{ id: string; cloture: boolean }> {
  const { data, error } = await supabaseAdmin
    .from("exercices")
    .select("id, cloture")
    .lte("date_debut", date)
    .gte("date_fin",   date)
    .order("date_debut", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error)   throw error
  if (!data)   throw new Error(`Aucun exercice ouvert ne couvre la date ${date}`)
  return data as { id: string; cloture: boolean }
}

/**
 * Date du dernier mouvement d'un compte/caisse (toutes statuts confondus).
 * Utilisé par GET /api/compta/comptes pour `derniere_operation`.
 */
export async function getDerniereOperationDate(
  cible: "compte" | "caisse",
  id: string,
): Promise<string | null> {
  const col = cible === "compte" ? "compte_id" : "caisse_id"
  const { data } = await supabaseAdmin
    .from("operations")
    .select("date_operation")
    .eq(col, id)
    .order("date_operation", { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.date_operation ?? null
}
