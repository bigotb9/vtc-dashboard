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
 *
 * SOURCE UNIQUE (Lot harmonisation BoyahBot 01/06/2026) :
 *   Le calcul interne (buildLedger) produit le LEDGER COMPLET par client : pour
 *   chaque mois de la fenêtre (depuis created_at), le dû / versé / reliquat /
 *   état / activité. Deux exports en dérivent SANS recalcul divergent :
 *     - getArriereLoyers()        : vue Cockpit (uniquement les mois en_retard).
 *     - getLedgerLoyersByClient() : ledger complet (consommé par BoyahBot).
 *   Les deux donnent donc EXACTEMENT le même arriéré (zéro double source).
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { calculLoyerNet } from "@/lib/clients/calculLoyerNet"
import { getLoyerStatus, fenetrePaiement, type LoyerEtat } from "@/lib/finance/loyerEcheance"

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

// ── Ledger complet (source unique, consommé par BoyahBot) ───────────────────
export interface LedgerMois {
  mois:     string      // 'YYYY-MM' — période du loyer (M)
  du:       number      // Σ loyer net dû des véhicules actifs ce mois
  verse:    number      // Σ versements_clients de ce mois (période = mois)
  reliquat: number      // max(0, du − verse)
  etat:     LoyerEtat   // état d'échéance (deja_verse si soldé ou rien à verser)
  actif:    boolean     // au moins un véhicule du client exploité ce mois
  // Fenêtre de paiement EXACTE (décalage M+1) : le loyer du mois M se verse
  // entre le 5 et le 10 du mois M+1. Dates 'YYYY-MM-DD' prêtes à citer — l'agent
  // ne doit JAMAIS recalculer cette date lui-même (il se trompait de mois).
  fenetre_paiement: { du: string; au: string }
}

export interface LedgerClient {
  id_client:             number
  client:                string
  telephone:             string | null
  nb_vehicules:          number
  immatriculations:      string[]
  montant_mensuel_total: number
  mois:                  LedgerMois[]   // tous les mois de la fenêtre depuis created_at (ancien→récent)
  total_reliquat:        number         // Σ reliquat des mois en_retard (== part client de l'arriéré)
}

export interface LedgerLoyers {
  clients:       LedgerClient[]
  fenetre:       { du: string; au: string }
  arriere_total: number                 // Σ total_reliquat (== getArriereLoyers().arriere_total)
}

// ── Lignes BD (typage minimal) ─────────────────────────────────────────────
type VehiculeRow = {
  id_vehicule: number
  immatriculation: string | null
  id_client: number | null
  montant_mensuel_client: number | null
}
type ClientRow = { id: number; nom: string | null; telephone: string | null; created_at: string | null }
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
 * Construit le LEDGER COMPLET des loyers Clients : pour chaque client (ayant au
 * moins un véhicule sous gestion) et chaque mois de la fenêtre depuis son
 * created_at, calcule dû / versé / reliquat / état / activité.
 *
 * C'est le cœur de calcul unique : getArriereLoyers et getLedgerLoyersByClient
 * en dérivent par simple filtrage, sans recalcul.
 */
async function buildLedger(
  supabase: SupabaseClient,
  today: Date,
  moisFenetre: number,
): Promise<{ clients: LedgerClient[]; mois: string[] }> {
  const mois = moisListe(today, moisFenetre)
  const dateFrom = `${mois[0]}-01`
  const [ly, lm] = mois[mois.length - 1].split("-").map(Number)
  const dateToExclusive =
    lm === 12 ? `${ly + 1}-01-01` : `${ly}-${String(lm + 1).padStart(2, "0")}-01`

  const vide = { clients: [] as LedgerClient[], mois }

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

  // ── 2. Clients (nom + téléphone + created_at pour le plafonnement) ────────
  const { data: cliRaw, error: cliErr } = await supabase
    .from("clients")
    .select("id, nom, telephone, created_at")
    .in("id", clientIds)
  if (cliErr) throw new Error(`Lecture clients : ${cliErr.message}`)
  const clientInfo = new Map<number, { nom: string; telephone: string | null; createdY: number; createdM: number }>()
  for (const c of (cliRaw ?? []) as ClientRow[]) {
    const created = c.created_at ? new Date(c.created_at) : null
    clientInfo.set(Number(c.id), {
      nom:       c.nom ?? "?",
      telephone: c.telephone ?? null,
      // 0-indexé. Si pas de date → 0 → aucun plafonnement (tout permis).
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

  // ── 7. Agrégation : ledger complet par (client, mois) ─────────────────────
  const clients: LedgerClient[] = []

  for (const cid of clientIds) {
    const info = clientInfo.get(cid)
    if (!info) continue
    const vehsClient = vehicules.filter(v => Number(v.id_client) === cid && v.id_vehicule != null)
    const ledgerMois: LedgerMois[] = []

    for (const ym of mois) {
      const [y, m] = ym.split("-").map(Number) // m 1-indexé
      // Plafonnement à l'entrée du Client (pas de ligne avant created_at).
      if (y < info.createdY || (y === info.createdY && (m - 1) < info.createdM)) continue

      // Dû = Σ loyer net des véhicules ACTIFS ce mois (recette OU dépense > 0),
      // même règle que getMargeConsolidee bloc2 (véhicule en panne = pas de dû).
      let du = 0
      let actif = false
      for (const v of vehsClient) {
        const idVeh = Number(v.id_vehicule)
        const recettes = recettesByVehMois.get(`${idVeh}_${ym}`) ?? 0
        const depenses = depensesByVehMois.get(`${idVeh}_${ym}`) ?? 0
        if (recettes === 0 && depenses === 0) continue
        actif = true
        // depenses vient d'operations filtré categorie.type='depense' :
        // pas de reversement dedans → excludeReversements=false (pas de re-filtre).
        const { loyerNet } = calculLoyerNet(
          Number(v.montant_mensuel_client ?? 0),
          [{ montant: depenses }],
          { excludeReversements: false },
        )
        du += loyerNet
      }

      const verse = versesByClientMois.get(`${cid}_${ym}`) ?? 0
      const reliquat = Math.max(0, du - verse)
      // Soldé si rien à verser (du<=0) ou versement couvrant le dû. Sinon, l'état
      // d'échéance pure (getLoyerStatus solde=false) décide : en_retard si après
      // le 10 de M+1. Identique à la règle du Cockpit (/api/cockpit/finances).
      const solde = du <= 0 || verse >= du
      const etat = getLoyerStatus(ym, today, solde)

      // Fenêtre de paiement exacte (5 → 10 de M+1), en chaînes 'YYYY-MM-DD'.
      const fen = fenetrePaiement(ym)
      const fenetre_paiement = {
        du: fen.debut.toISOString().slice(0, 10),
        au: fen.fin.toISOString().slice(0, 10),
      }

      ledgerMois.push({
        mois: ym,
        du: Math.round(du),
        verse: Math.round(verse),
        reliquat: Math.round(reliquat),
        etat,
        actif,
        fenetre_paiement,
      })
    }

    const totalReliquat = ledgerMois
      .filter(mm => mm.etat === "en_retard")
      .reduce((s, mm) => s + mm.reliquat, 0)

    clients.push({
      id_client:             cid,
      client:                info.nom,
      telephone:             info.telephone,
      nb_vehicules:          vehsClient.length,
      immatriculations:      vehsClient.map(v => v.immatriculation ?? ""),
      montant_mensuel_total: vehsClient.reduce((s, v) => s + Number(v.montant_mensuel_client ?? 0), 0),
      mois:                  ledgerMois,
      total_reliquat:        Math.round(totalReliquat),
    })
  }

  return { clients, mois }
}

/**
 * Calcule l'arriéré cumulé des loyers Clients à la date `today` (vue Cockpit).
 * Ne retient que les mois en état "en_retard" avec reliquat > 0.
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
  const { clients, mois } = await buildLedger(supabase, today, moisFenetre)

  const detail: ArriereClientDetail[] = []
  for (const c of clients) {
    const moisEnRetard: ArriereMois[] = c.mois
      .filter(mm => mm.etat === "en_retard" && mm.reliquat > 0)
      .map(mm => ({ mois: mm.mois, du: mm.du, verse: mm.verse, reliquat: mm.reliquat }))
    if (moisEnRetard.length === 0) continue
    moisEnRetard.sort((a, b) => a.mois.localeCompare(b.mois))
    detail.push({
      id_client:      c.id_client,
      client:         c.client,
      mois_en_retard: moisEnRetard,
      total_reliquat: moisEnRetard.reduce((s, r) => s + r.reliquat, 0),
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

/**
 * Renvoie le LEDGER COMPLET des loyers Clients (tous les mois de la fenêtre,
 * pas seulement les retards), consommé par BoyahBot pour donner exactement les
 * mêmes chiffres que le Cockpit. `arriere_total` est identique à celui de
 * getArriereLoyers (même calcul interne, simple filtrage différent).
 *
 * @param supabase     Client Supabase (service role : versements_clients a une RLS).
 * @param today        Date de consultation. Défaut : maintenant.
 * @param moisFenetre  Profondeur de la fenêtre glissante (mois). Défaut 12.
 */
export async function getLedgerLoyersByClient(
  supabase: SupabaseClient,
  today: Date = new Date(),
  moisFenetre = 12,
): Promise<LedgerLoyers> {
  const { clients, mois } = await buildLedger(supabase, today, moisFenetre)
  const arriereTotal = clients.reduce((s, c) => s + c.total_reliquat, 0)
  return {
    clients,
    fenetre: { du: mois[0], au: mois[mois.length - 1] },
    arriere_total: arriereTotal,
  }
}
