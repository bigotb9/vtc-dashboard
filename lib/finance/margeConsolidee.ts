/**
 * lib/finance/margeConsolidee.ts
 *
 * Source de vérité UNIQUE pour la marge consolidée du groupe Boyah, par mois
 * calendaire. Destinée à alimenter à terme le Cockpit ET BoyahBot (remplacement
 * du calcul `fetchFinancial` bancal) — aucune divergence possible entre les
 * deux consommateurs.
 *
 * Spec validée Emmanuel le 01/06/2026. Premier livrable : helper + route de
 * test uniquement, AUCUN branchement Cockpit/BoyahBot.
 *
 * Décomposition en 4 blocs, sur 2 niveaux (réel vs estimé Yango) :
 *   - Bloc 1 : véhicules propres (sous_gestion=false)
 *   - Bloc 2 : gestion clients (sous_gestion=true) + détail par véhicule
 *   - Bloc 3 : Yango estimé — EN ATTENTE (montant des courses dans raw jsonb,
 *              structure inconnue + pas de lien véhicule). Retourné à 0 avec
 *              non_implemente=true ; le type est conservé pour l'accueillir
 *              plus tard sans refonte.
 *   - Bloc 4 : charges de structure (vehicule_id IS NULL)
 *
 * Sources (décidées en Phase A, conformes à l'audit double-comptage du 01/06) :
 *   - Recettes Wave par véhicule  → versement_attribution (montant_attribue,
 *                                    filtré id_vehicule + jour_exploitation).
 *   - Dépenses par véhicule        → operations (type='sortie', statut='valide',
 *                                    categorie.type='depense', vehicule_id).
 *                                    JAMAIS depenses_vehicules (double comptage).
 *   - Charges de structure         → operations idem mais vehicule_id IS NULL.
 *   - Loyer net client             → calculLoyerNet (lib/clients), tel quel.
 *
 * Exclusions natives (via le filtre categorie.type='depense') : reversements
 * clients (type='reversement'), transferts internes, dotations amortissement,
 * investissements / apports / remboursements.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { calculLoyerNet } from "@/lib/clients/calculLoyerNet"

/** En dessous de ce total mensuel, les charges de structure sont jugées
 *  « quasi-vides » (non saisies) → la marge réelle est surévaluée. */
export const SEUIL_STRUCTURE_QUASI_VIDE = 50_000

/** Commission Yango estimée (2,5 % du CA courses). Utilisée plus tard. */
export const TAUX_COMMISSION_YANGO = 0.025

export type MargeConsolidee = {
  mois: string                       // 'YYYY-MM'

  bloc1_vehicules_propres: {
    recettes: number
    depenses: number
    marge: number                    // recettes - depenses
    nb_vehicules: number
  }

  bloc2_gestion_clients: {
    recettes: number                 // Σ recettes Wave des véhicules clients
    loyers_nets_a_verser: number     // Σ calculLoyerNet (le DÛ du mois, pas le versé)
    depenses_absorbees: number       // Σ min(dépenses véhicule, 50000)
    resultat: number                 // recettes - loyers_nets - depenses_absorbees
    nb_vehicules: number
    detail_par_vehicule: Array<{
      id_vehicule: number
      immatriculation: string
      client: string
      recettes: number
      loyer_net: number
      depenses_absorbees: number
      resultat: number               // <0 = ce véhicule client coûte ce mois
    }>
  }

  bloc4_charges_structure: {
    total: number
    nb_operations: number
    quasi_vide: boolean              // true si total < seuil → avertissement
  }

  // NIVEAU 1 — réel
  marge_reelle: number               // bloc1.marge + bloc2.resultat - bloc4.total

  bloc3_yango_estime: {
    ca_courses: number               // CA total courses complétées du mois
    commission: number               // 2,5% du CA
    estimation: true                 // toujours true : non encaissé en compta
    non_implemente: boolean          // true tant que l'extraction raw n'est pas faite
  }

  // TOTAL
  total_consolide: number            // marge_reelle + bloc3.commission

  avertissements: string[]
}

// ── Lignes BD (typage minimal des SELECT) ──────────────────────────────────
type VehiculeRow = {
  id_vehicule: number
  immatriculation: string | null
  sous_gestion: boolean | null
  id_client: number | null
  montant_mensuel_client: number | null
}
type ClientRow = { id: number; nom: string | null }
type AttributionRow = { id_vehicule: number | null; montant_attribue: number | null }
type OperationRow = { vehicule_id: number | null; montant: number | null }

const PAGE = 1000

/**
 * Calcule la marge consolidée du groupe pour un mois calendaire.
 *
 * @param supabase Client Supabase (service role recommandé : versements_clients
 *                 et operations sont lus côté serveur).
 * @param mois     Mois cible au format 'YYYY-MM'.
 */
export async function getMargeConsolidee(
  supabase: SupabaseClient,
  mois: string,
): Promise<MargeConsolidee> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mois)) {
    throw new Error(`Mois invalide : "${mois}" (attendu 'YYYY-MM')`)
  }

  // ── Bornes du mois : [dateFrom, dateToExclusive[ ────────────────────────
  const [y, m] = mois.split("-").map(Number)
  const dateFrom = `${mois}-01`
  const dateToExclusive =
    m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, "0")}-01`

  // ── 1. Véhicules + clients ──────────────────────────────────────────────
  const { data: vehRaw, error: vehErr } = await supabase
    .from("vehicules")
    .select("id_vehicule, immatriculation, sous_gestion, id_client, montant_mensuel_client")
  if (vehErr) throw new Error(`Lecture vehicules : ${vehErr.message}`)
  const vehicules = (vehRaw ?? []) as VehiculeRow[]

  const clientIds = [
    ...new Set(
      vehicules.map(v => v.id_client).filter((x): x is number => x != null),
    ),
  ]
  const clientNom = new Map<number, string>()
  if (clientIds.length > 0) {
    const { data: cliRaw, error: cliErr } = await supabase
      .from("clients")
      .select("id, nom")
      .in("id", clientIds)
    if (cliErr) throw new Error(`Lecture clients : ${cliErr.message}`)
    for (const c of (cliRaw ?? []) as ClientRow[]) {
      clientNom.set(Number(c.id), c.nom ?? "?")
    }
  }

  const estClient = (v: VehiculeRow) => v.sous_gestion === true
  const vehById = new Map<number, VehiculeRow>()
  for (const v of vehicules) {
    if (v.id_vehicule != null) vehById.set(Number(v.id_vehicule), v)
  }

  // ── 2. Recettes Wave par véhicule (versement_attribution) ───────────────
  const recettesByVeh = new Map<number, number>()
  {
    let from = 0
    for (;;) {
      const { data, error } = await supabase
        .from("versement_attribution")
        .select("id_vehicule, montant_attribue")
        .gte("jour_exploitation", dateFrom)
        .lt("jour_exploitation", dateToExclusive)
        .range(from, from + PAGE - 1)
      if (error) throw new Error(`Lecture versement_attribution : ${error.message}`)
      const rows = (data ?? []) as AttributionRow[]
      for (const r of rows) {
        if (r.id_vehicule == null) continue
        const k = Number(r.id_vehicule)
        recettesByVeh.set(k, (recettesByVeh.get(k) ?? 0) + Number(r.montant_attribue ?? 0))
      }
      if (rows.length < PAGE) break
      from += PAGE
    }
  }

  // ── 3. Catégories de type 'depense' (filtre dépenses) ───────────────────
  const { data: catRaw, error: catErr } = await supabase
    .from("categories_operations")
    .select("id")
    .eq("type", "depense")
  if (catErr) throw new Error(`Lecture categories_operations : ${catErr.message}`)
  const depenseCatIds = ((catRaw ?? []) as Array<{ id: string }>).map(c => c.id)

  // ── 4. Dépenses (operations) : par véhicule + charges de structure ──────
  const depensesByVeh = new Map<number, number>()
  let structureTotal = 0
  let structureNbOps = 0
  if (depenseCatIds.length > 0) {
    let from = 0
    for (;;) {
      const { data, error } = await supabase
        .from("operations")
        .select("vehicule_id, montant")
        .eq("type", "sortie")
        .eq("statut", "valide")
        .in("categorie_id", depenseCatIds)
        .gte("date_operation", dateFrom)
        .lt("date_operation", dateToExclusive)
        .range(from, from + PAGE - 1)
      if (error) throw new Error(`Lecture operations : ${error.message}`)
      const rows = (data ?? []) as OperationRow[]
      for (const r of rows) {
        const montant = Number(r.montant ?? 0)
        if (r.vehicule_id == null) {
          // Charge de structure : critère = absence de véhicule (PAS la source)
          structureTotal += montant
          structureNbOps += 1
        } else {
          const k = Number(r.vehicule_id)
          depensesByVeh.set(k, (depensesByVeh.get(k) ?? 0) + montant)
        }
      }
      if (rows.length < PAGE) break
      from += PAGE
    }
  }

  // ── 5. Bloc 1 — véhicules propres (sous_gestion=false) ──────────────────
  let b1Recettes = 0
  let b1Depenses = 0
  let b1Nb = 0
  // ── Bloc 2 — gestion clients (sous_gestion=true) ────────────────────────
  let b2Recettes = 0
  let b2Loyers = 0
  let b2Absorbees = 0
  let b2Resultat = 0
  const detailClients: MargeConsolidee["bloc2_gestion_clients"]["detail_par_vehicule"] = []

  for (const [id, v] of vehById.entries()) {
    const recettes = recettesByVeh.get(id) ?? 0
    const depenses = depensesByVeh.get(id) ?? 0
    // DÉCISION (à valider) : on ne compte un véhicule que s'il a eu une
    // activité ce mois-ci (recette OU dépense). Évite de fabriquer un déficit
    // = -loyer pour un véhicule client non exploité ce mois.
    if (recettes === 0 && depenses === 0) continue

    if (estClient(v)) {
      const loyerPrevu = Number(v.montant_mensuel_client ?? 0)
      // depenses vient déjà d'operations filtré categorie.type='depense' :
      // pas de reversement dedans → excludeReversements=false (pas de re-filtre).
      const { loyerNet, chargeBoyah } = calculLoyerNet(
        loyerPrevu,
        [{ montant: depenses }],
        { excludeReversements: false },
      )
      const resultat = recettes - loyerNet - chargeBoyah
      b2Recettes += recettes
      b2Loyers += loyerNet
      b2Absorbees += chargeBoyah
      b2Resultat += resultat
      detailClients.push({
        id_vehicule: id,
        immatriculation: v.immatriculation ?? "?",
        client: v.id_client != null ? (clientNom.get(Number(v.id_client)) ?? "?") : "?",
        recettes,
        loyer_net: loyerNet,
        depenses_absorbees: chargeBoyah,
        resultat,
      })
    } else {
      b1Recettes += recettes
      b1Depenses += depenses
      b1Nb += 1
    }
  }

  detailClients.sort((a, b) => a.resultat - b.resultat) // déficitaires en tête

  const bloc1 = {
    recettes: b1Recettes,
    depenses: b1Depenses,
    marge: b1Recettes - b1Depenses,
    nb_vehicules: b1Nb,
  }
  const bloc2 = {
    recettes: b2Recettes,
    loyers_nets_a_verser: b2Loyers,
    depenses_absorbees: b2Absorbees,
    resultat: b2Resultat,
    nb_vehicules: detailClients.length,
    detail_par_vehicule: detailClients,
  }

  // ── 6. Bloc 4 — charges de structure ────────────────────────────────────
  const bloc4 = {
    total: structureTotal,
    nb_operations: structureNbOps,
    quasi_vide: structureTotal < SEUIL_STRUCTURE_QUASI_VIDE,
  }

  // ── 7. Bloc 3 — Yango estimé (EN ATTENTE) ───────────────────────────────
  const bloc3 = {
    ca_courses: 0,
    commission: 0,
    estimation: true as const,
    non_implemente: true,
  }

  // ── 8. Niveaux & total ──────────────────────────────────────────────────
  const marge_reelle = bloc1.marge + bloc2.resultat - bloc4.total
  const total_consolide = marge_reelle + bloc3.commission

  // ── 9. Avertissements ───────────────────────────────────────────────────
  const avertissements: string[] = []
  if (bloc4.quasi_vide) {
    avertissements.push(
      "Charges de structure non encore saisies, marge réelle surévaluée.",
    )
  }
  if (bloc3.non_implemente) {
    avertissements.push(
      "Bloc Yango non implémenté (structure raw à clarifier) — total_consolide = marge_reelle pour l'instant.",
    )
  }

  return {
    mois,
    bloc1_vehicules_propres: bloc1,
    bloc2_gestion_clients: bloc2,
    bloc4_charges_structure: bloc4,
    marge_reelle,
    bloc3_yango_estime: bloc3,
    total_consolide,
    avertissements,
  }
}
