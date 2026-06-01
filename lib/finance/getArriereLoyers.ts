/**
 * lib/finance/getArriereLoyers.ts
 *
 * Calcule l'ARRIÉRÉ CUMULÉ des loyers Clients (asset management Boyah Group),
 * en tenant compte du DÉCALAGE DE PAIEMENT M+1 (cf. lib/finance/loyerEcheance).
 *
 * Définition (validée Emmanuel le 01/06/2026) :
 *   L'arriéré d'un mois M est le RELIQUAT non versé d'un loyer dont la date
 *   limite de paiement (le 10 du mois M+1) est dépassée, donc dont l'état est
 *   "en_retard". L'arriéré cumulé = Σ des reliquats de tous les mois en retard,
 *   sur une fenêtre glissante (12 mois par défaut), plafonnée à l'entrée du
 *   Client (created_at) — pas d'arriéré avant qu'il ait confié ses véhicules.
 *
 * Reliquat partiel (décision B) :
 *   arriéré du mois = max(0, loyer_net_dû − Σ versements de CE mois).
 *   On ne raisonne PAS en binaire (versé/pas versé) : un versement partiel
 *   réduit l'arriéré d'autant.
 *
 * Sources (décision A — cohérence stricte avec getMargeConsolidee / Cockpit) :
 *   - Recettes par véhicule → versement_attribution (montant_attribue,
 *                              jour_exploitation). Sert de signal d'activité.
 *   - Dépenses par véhicule → operations (type='sortie', statut='valide',
 *                              categorie.type='depense'). JAMAIS depenses_vehicules.
 *   - Versements effectifs   → versements_clients (mois = période du loyer).
 *   - Loyer net              → calculLoyerNet (lib/clients), tel quel.
 *
 * Coût (décision D — helper bulk dédié, pas de vue matérialisée) :
 *   Chargement en masse sur la fenêtre + agrégation en mémoire. ~6 requêtes
 *   (hors pagination), indépendamment du nombre de mois — modèle calqué sur
 *   lib/clients/calculBeneficeCumule. Compatible avec le refresh 60s du Cockpit.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { calculLoyerNet } from "@/lib/clients/calculLoyerNet"
import { getLoyerStatus } from "@/lib/finance/loyerEcheance"

const PAGE = 1000

export interface ArriereMois {
  mois:     string   // 'YYYY-MM' — période du loyer (M)
  du:       number   // Σ loyer net dû des véhicules actifs ce mois
  verse:    number   // Σ versements_clients de ce mois (période = mois)
  reliquat: number   // max(0, du − verse)
}

export interface ArriereClientDetail {
  id_client:      number
  client:         string
  mois_en_retard: ArriereMois[]   // uniquement les mois en état "en_retard" avec reliquat > 0
  total_reliquat: number
}

export interface ArriereLoyers {
  arriere_total:      number
  detail_par_client:  ArriereClientDetail[]   // trié par total_reliquat décroissant
  fenetre:            { du: string; au: string }
  nb_clients_concernes: number
}

// ── Lignes BD (typage minimal) ─────────────────────────────────────────────
type VehiculeRow = {
  id_vehicule: number
  immatriculation: string | null
  id_client: number | null
  montant_mensuel_client: number | null
}
type ClientRow = { id: number; nom: string | null; created_at: string | null }
type AttributionRow = { id_vehicule: number | null; jour_exploitation: string | null; montant_attribue: number | null }
type OperationRow = { vehicule_id: number | null; date_operation: string | null; montant: number | null }
type VersementRow = { id_client: number | string; mois: string; montant: number | null }

/** Génère la liste 'YYYY-MM' des `count` derniers mois (UTC), du plus ancien
 *  au plus récent, incluant le mois courant. */
function moisListe(today: Date, count: number): string[] {
  const out: string[] = []
  const y = today.getUTCFullYear()
  const m = today.getUTCMonth() // 0-indexé
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - i, 1))
    out.push(d.toISOString().slice(0, 7))
  }
  return out
}

/**
 * Calcule l'arriéré cumulé des loyers Clients à la date `today`.
 *
 * @param supabase     Client Supabase (service role : versements_clients a une RLS).
 * @param today        Date de consultation. Défaut : maintenant.
 * @param moisFenetre  Profondeur de la fenêtre glissante (mois). Défaut 12.
 */
export async function getArriereLoyers(
  supabase: SupabaseClient,
  today: Date = new Date(),
  moisFenetre = 12,
): Promise<ArriereLoyers> {
  const mois = moisListe(today, moisFenetre)
  const dateFrom = `${mois[0]}-01`
  const [ly, lm] = mois[mois.length - 1].split("-").map(Number)
  const dateToExclusive =
    lm === 12 ? `${ly + 1}-01-01` : `${ly}-${String(lm + 1).padStart(2, "0")}-01`

  const vide: ArriereLoyers = {
    arriere_total: 0,
    detail_par_client: [],
    fenetre: { du: mois[0], au: mois[mois.length - 1] },
    nb_clients_concernes: 0,
  }

  // ── 1. Véhicules sous gestion ─────────────────────────────────────────────
  const { data: vehRaw, error: vehErr } = await supabase
    .from("vehicules")
    .select("id_vehicule, immatriculation, id_client, montant_mensuel_client, sous_gestion")
    .eq("sous_gestion", true)
  if (vehErr) throw new Error(`Lecture vehicules : ${vehErr.message}`)
  const vehicules = (vehRaw ?? []) as VehiculeRow[]
  if (vehicules.length === 0) return vide

  const vehById = new Map<number, VehiculeRow>()
  for (const v of vehicules) {
    if (v.id_vehicule != null) vehById.set(Number(v.id_vehicule), v)
  }
  const clientIds = [
    ...new Set(vehicules.map(v => v.id_client).filter((x): x is number => x != null)),
  ]
  if (clientIds.length === 0) return vide

  // ── 2. Clients (nom + created_at pour le plafonnement) ────────────────────
  const { data: cliRaw, error: cliErr } = await supabase
    .from("clients")
    .select("id, nom, created_at")
    .in("id", clientIds)
  if (cliErr) throw new Error(`Lecture clients : ${cliErr.message}`)
  const clientInfo = new Map<number, { nom: string; createdY: number; createdM: number }>()
  for (const c of (cliRaw ?? []) as ClientRow[]) {
    const created = c.created_at ? new Date(c.created_at) : null
    clientInfo.set(Number(c.id), {
      nom:      c.nom ?? "?",
      // 0-indexé. Si pas de date → 0/-Infinity → aucun plafonnement (tout permis).
      createdY: created ? created.getUTCFullYear() : 0,
      createdM: created ? created.getUTCMonth() : 0,
    })
  }

  // ── 3. Recettes par (véhicule, mois) — versement_attribution ──────────────
  const recettesByVehMois = new Map<string, number>() // `${id_vehicule}_${YYYY-MM}`
  {
    let from = 0
    for (;;) {
      const { data, error } = await supabase
        .from("versement_attribution")
        .select("id_vehicule, jour_exploitation, montant_attribue")
        .gte("jour_exploitation", dateFrom)
        .lt("jour_exploitation", dateToExclusive)
        .range(from, from + PAGE - 1)
      if (error) throw new Error(`Lecture versement_attribution : ${error.message}`)
      const rows = (data ?? []) as AttributionRow[]
      for (const r of rows) {
        if (r.id_vehicule == null || !vehById.has(Number(r.id_vehicule))) continue
        const ym = String(r.jour_exploitation ?? "").slice(0, 7)
        if (!ym) continue
        const key = `${Number(r.id_vehicule)}_${ym}`
        recettesByVehMois.set(key, (recettesByVehMois.get(key) ?? 0) + Number(r.montant_attribue ?? 0))
      }
      if (rows.length < PAGE) break
      from += PAGE
    }
  }

  // ── 4. Catégories de type 'depense' ───────────────────────────────────────
  const { data: catRaw, error: catErr } = await supabase
    .from("categories_operations")
    .select("id")
    .eq("type", "depense")
  if (catErr) throw new Error(`Lecture categories_operations : ${catErr.message}`)
  const depenseCatIds = ((catRaw ?? []) as Array<{ id: string }>).map(c => c.id)

  // ── 5. Dépenses par (véhicule, mois) — operations ─────────────────────────
  const depensesByVehMois = new Map<string, number>()
  if (depenseCatIds.length > 0) {
    let from = 0
    for (;;) {
      const { data, error } = await supabase
        .from("operations")
        .select("vehicule_id, date_operation, montant")
        .eq("type", "sortie")
        .eq("statut", "valide")
        .in("categorie_id", depenseCatIds)
        .gte("date_operation", dateFrom)
        .lt("date_operation", dateToExclusive)
        .range(from, from + PAGE - 1)
      if (error) throw new Error(`Lecture operations : ${error.message}`)
      const rows = (data ?? []) as OperationRow[]
      for (const r of rows) {
        if (r.vehicule_id == null || !vehById.has(Number(r.vehicule_id))) continue
        const ym = String(r.date_operation ?? "").slice(0, 7)
        if (!ym) continue
        const key = `${Number(r.vehicule_id)}_${ym}`
        depensesByVehMois.set(key, (depensesByVehMois.get(key) ?? 0) + Number(r.montant ?? 0))
      }
      if (rows.length < PAGE) break
      from += PAGE
    }
  }

  // ── 6. Versements effectifs par (client, mois) — versements_clients ───────
  const versesByClientMois = new Map<string, number>() // `${id_client}_${YYYY-MM}`
  {
    const { data, error } = await supabase
      .from("versements_clients")
      .select("id_client, mois, montant")
      .in("id_client", clientIds)
      .in("mois", mois)
    if (error) throw new Error(`Lecture versements_clients : ${error.message}`)
    for (const r of (data ?? []) as VersementRow[]) {
      const key = `${Number(r.id_client)}_${String(r.mois).trim()}`
      versesByClientMois.set(key, (versesByClientMois.get(key) ?? 0) + Number(r.montant ?? 0))
    }
  }

  // ── 7. Agrégation : dû par (client, mois) → reliquat → filtre "en_retard" ─
  const detail: ArriereClientDetail[] = []

  for (const cid of clientIds) {
    const info = clientInfo.get(cid)
    if (!info) continue
    const vehsClient = vehicules.filter(v => Number(v.id_client) === cid && v.id_vehicule != null)
    const moisEnRetard: ArriereMois[] = []

    for (const ym of mois) {
      const [y, m] = ym.split("-").map(Number) // m 1-indexé
      // Plafonnement à l'entrée du Client (pas d'arriéré avant created_at).
      if (y < info.createdY || (y === info.createdY && (m - 1) < info.createdM)) continue

      // État d'échéance : on ne retient que les mois réellement en retard.
      // (solde=false : on évalue l'échéance pure, le reliquat décide ensuite.)
      if (getLoyerStatus(ym, today, false) !== "en_retard") continue

      // Dû = Σ loyer net des véhicules ACTIFS ce mois (recette OU dépense > 0),
      // même règle que getMargeConsolidee bloc2 (véhicule en panne = pas de dû).
      let du = 0
      for (const v of vehsClient) {
        const idVeh = Number(v.id_vehicule)
        const recettes = recettesByVehMois.get(`${idVeh}_${ym}`) ?? 0
        const depenses = depensesByVehMois.get(`${idVeh}_${ym}`) ?? 0
        if (recettes === 0 && depenses === 0) continue
        // depenses vient d'operations filtré categorie.type='depense' :
        // pas de reversement dedans → excludeReversements=false (pas de re-filtre).
        const { loyerNet } = calculLoyerNet(
          Number(v.montant_mensuel_client ?? 0),
          [{ montant: depenses }],
          { excludeReversements: false },
        )
        du += loyerNet
      }

      if (du <= 0) continue
      const verse = versesByClientMois.get(`${cid}_${ym}`) ?? 0
      const reliquat = Math.max(0, du - verse)
      if (reliquat <= 0) continue

      moisEnRetard.push({
        mois: ym,
        du: Math.round(du),
        verse: Math.round(verse),
        reliquat: Math.round(reliquat),
      })
    }

    if (moisEnRetard.length === 0) continue
    moisEnRetard.sort((a, b) => a.mois.localeCompare(b.mois))
    const totalReliquat = moisEnRetard.reduce((s, r) => s + r.reliquat, 0)
    detail.push({
      id_client: cid,
      client: info.nom,
      mois_en_retard: moisEnRetard,
      total_reliquat: totalReliquat,
    })
  }

  detail.sort((a, b) => b.total_reliquat - a.total_reliquat)
  const arriereTotal = detail.reduce((s, c) => s + c.total_reliquat, 0)

  return {
    arriere_total: arriereTotal,
    detail_par_client: detail,
    fenetre: { du: mois[0], au: mois[mois.length - 1] },
    nb_clients_concernes: detail.length,
  }
}
