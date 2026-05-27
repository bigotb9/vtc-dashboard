/**
 * Builder du Rapport mensuel synthétique (Phase 4 §4.5).
 *
 * 7 sections agrégées pour la période :
 *   1. KPIs (CA, dépenses, résultat net, trésorerie)
 *   2. Évolution 6 derniers mois (CA + dépenses)
 *   3. Top 5 catégories (par volume)
 *   4. Top 5 véhicules (revenus + dépenses)
 *   5. Soldes trésorerie (caisses + comptes)
 *   6. Health check (équilibre comptable + nb anomalies)
 *   7. Top 20 opérations > 100k F (annexes)
 *
 * + Commentaire auto-généré pour le résumé exécutif.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"

export interface RapportMensuelKpis {
  ca:              number
  depenses:        number
  resultat_net:    number
  tresorerie:      number   // somme soldes caisses + comptes (tous temps)
  ca_prev:         number   // mois précédent pour calcul trend
  depenses_prev:   number
  resultat_prev:   number
}

export interface MoisPoint {
  mois:     string  // "YYYY-MM"
  ca:       number
  depenses: number
}

export interface TopCategorie {
  libelle:       string
  type:          string
  sens:          "debit" | "credit" | null
  volume_total:  number
  nb_operations: number
}

export interface TopVehicule {
  vehicule_id:    number
  immatriculation: string | null
  ca:             number
  depenses:       number
  nb_versements:  number
}

export interface SoldeContenant {
  libelle:    string
  code:       string | null
  type_cible: "caisse" | "compte"
  solde:      number
}

export interface RapportMensuelHealth {
  ok:           boolean
  total_debit:  number
  total_credit: number
  ecart:        number
  nb_ecritures: number
  nb_lignes:    number
  nb_anomalies: number
}

export interface OperationAnnexe {
  date_operation: string
  libelle:        string
  type:           "entree" | "sortie"
  montant:        number
  caisse_libelle: string | null
  categorie:      string | null
}

export interface RapportMensuelData {
  date_from:        string
  date_to:          string
  /** Libellé lisible du mois ex. "Avril 2026". */
  periode_libelle:  string
  kpis:             RapportMensuelKpis
  commentaire:      string
  evolution_6_mois: MoisPoint[]
  top_categories:   TopCategorie[]
  top_vehicules:    TopVehicule[]
  soldes:           SoldeContenant[]
  health:           RapportMensuelHealth
  top_operations:   OperationAnnexe[]
}

const MOIS_FR = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
]

function ym(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** Mois précédent d'une période [dateFrom, dateTo] avec durée identique. */
function periodPrecedente(dateFrom: string, dateTo: string): { date_from: string; date_to: string } {
  const d1 = new Date(dateFrom + "T00:00:00Z")
  const d2 = new Date(dateTo   + "T00:00:00Z")
  const ms = 86_400_000
  const duree = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / ms) + 1)
  const newTo   = new Date(d1.getTime() - ms)
  const newFrom = new Date(newTo.getTime() - (duree - 1) * ms)
  return {
    date_from: newFrom.toISOString().slice(0, 10),
    date_to:   newTo.toISOString().slice(0, 10),
  }
}

async function aggrEntreesSorties(dateFrom: string, dateTo: string): Promise<{ entrees: number; sorties: number }> {
  let entrees = 0, sorties = 0
  const PAGE = 5000
  let from = 0
  while (from < 1_000_000) {
    const { data, error } = await supabaseAdmin
      .from("operations")
      .select("type, montant")
      .eq("statut", "valide")
      .gte("date_operation", dateFrom)
      .lte("date_operation", dateTo)
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const r of data) {
      const m = Number(r.montant || 0)
      if (r.type === "entree")      entrees += m
      else if (r.type === "sortie") sorties += m
    }
    if (data.length < PAGE) break
    from += PAGE
  }
  return { entrees, sorties }
}

function generateCommentaire(k: RapportMensuelKpis, health: RapportMensuelHealth): string {
  const lines: string[] = []

  // 1. Évolution CA
  if (k.ca_prev > 0) {
    const pct = ((k.ca - k.ca_prev) / k.ca_prev) * 100
    if (pct > 0.5) {
      lines.push(`Le chiffre d'affaires progresse de ${pct.toFixed(1)}% par rapport au mois précédent (${formatF(k.ca)} vs ${formatF(k.ca_prev)}).`)
    } else if (pct < -0.5) {
      lines.push(`Le chiffre d'affaires recule de ${Math.abs(pct).toFixed(1)}% par rapport au mois précédent (${formatF(k.ca)} vs ${formatF(k.ca_prev)}).`)
    } else {
      lines.push(`Le chiffre d'affaires se stabilise par rapport au mois précédent (${formatF(k.ca)}).`)
    }
  } else if (k.ca > 0) {
    lines.push(`Chiffre d'affaires du mois : ${formatF(k.ca)}.`)
  }

  // 2. Résultat net
  if (k.resultat_net > 0) {
    lines.push(`Le résultat net est positif (${formatF(k.resultat_net)}).`)
  } else if (k.resultat_net < 0) {
    lines.push(`Le résultat net est négatif (${formatF(k.resultat_net)}). À surveiller.`)
  }

  // 3. Trésorerie
  if (k.tresorerie < 0) {
    lines.push(`Attention : la trésorerie globale est négative (${formatF(k.tresorerie)}).`)
  } else if (k.tresorerie > 0) {
    lines.push(`Trésorerie globale : ${formatF(k.tresorerie)}.`)
  }

  // 4. Anomalies
  if (!health.ok || health.nb_anomalies > 0) {
    lines.push(`${health.nb_anomalies} anomalie(s) détectée(s) lors de l'audit comptable. Recommandation : consulter l'écran Santé compta pour investiguer.`)
  } else {
    lines.push(`L'audit comptable confirme l'équilibre (Σ débits = Σ crédits = ${formatF(health.total_debit)}).`)
  }

  return lines.join(" ")
}

function formatF(n: number): string {
  const sign = n < 0 ? "−" : ""
  return `${sign}${Math.round(Math.abs(n)).toLocaleString("fr-FR").replace(/[  ]/g, " ")} F`
}

export async function buildRapportMensuel(dateFrom: string, dateTo: string): Promise<RapportMensuelData> {
  // 1. KPIs période courante + précédente en parallèle
  const prev = periodPrecedente(dateFrom, dateTo)
  const [cur, prv] = await Promise.all([
    aggrEntreesSorties(dateFrom, dateTo),
    aggrEntreesSorties(prev.date_from, prev.date_to),
  ])
  const resultat_net = cur.entrees - cur.sorties
  const resultat_prev = prv.entrees - prv.sorties

  // 2. Trésorerie : SUM(solde_initial) caisses+comptes + Σ deltas (tous temps confondus)
  let tresorerie = 0
  {
    const [caissesRes, comptesRes] = await Promise.all([
      supabaseAdmin.from("caisses").select("solde_initial"),
      supabaseAdmin.from("comptes").select("solde_initial"),
    ])
    for (const c of caissesRes.data ?? []) tresorerie += Number(c.solde_initial || 0)
    for (const c of comptesRes.data ?? []) tresorerie += Number(c.solde_initial || 0)
    // + Σ deltas all-time
    const allTime = await aggrEntreesSorties("1900-01-01", "9999-12-31")
    tresorerie += allTime.entrees - allTime.sorties
  }

  const kpis: RapportMensuelKpis = {
    ca:              cur.entrees,
    depenses:        cur.sorties,
    resultat_net,
    tresorerie,
    ca_prev:         prv.entrees,
    depenses_prev:   prv.sorties,
    resultat_prev,
  }

  // 3. Évolution 6 derniers mois (par mois calendaire, finissant par le mois de date_to)
  const todayRef = new Date(dateTo + "T00:00:00Z")
  const labels: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(todayRef.getUTCFullYear(), todayRef.getUTCMonth() - i, 1))
    labels.push(ym(d))
  }
  const startSeries = `${labels[0]}-01`
  const endSeries   = dateTo
  const seriesMap = new Map<string, { ca: number; depenses: number }>()
  for (const l of labels) seriesMap.set(l, { ca: 0, depenses: 0 })
  {
    const PAGE = 5000
    let from = 0
    while (from < 1_000_000) {
      const { data } = await supabaseAdmin
        .from("operations")
        .select("type, montant, date_operation")
        .eq("statut", "valide")
        .gte("date_operation", startSeries)
        .lte("date_operation", endSeries)
        .range(from, from + PAGE - 1)
      if (!data || data.length === 0) break
      for (const r of data) {
        const mois = String(r.date_operation).slice(0, 7)
        const slot = seriesMap.get(mois); if (!slot) continue
        const m = Number(r.montant || 0)
        if (r.type === "entree")      slot.ca       += m
        else if (r.type === "sortie") slot.depenses += m
      }
      if (data.length < PAGE) break
      from += PAGE
    }
  }
  const evolution_6_mois: MoisPoint[] = labels.map(l => {
    const v = seriesMap.get(l)!
    return { mois: l, ca: v.ca, depenses: v.depenses }
  })

  // 4. Top 5 catégories par volume sur la période
  const top_categories: TopCategorie[] = []
  {
    const { data: ops } = await supabaseAdmin
      .from("operations")
      .select("categorie_id, montant, categorie:categorie_id ( libelle, type, sens )")
      .eq("statut", "valide")
      .gte("date_operation", dateFrom)
      .lte("date_operation", dateTo)
    const agg = new Map<string, { libelle: string; type: string; sens: "debit" | "credit" | null; vol: number; n: number }>()
    for (const o of ops ?? []) {
      if (!o.categorie_id) continue
      const cat = o.categorie as { libelle?: string; type?: string; sens?: "debit" | "credit" } | null
      const key = String(o.categorie_id)
      const cur2 = agg.get(key) ?? {
        libelle: cat?.libelle ?? "?",
        type:    cat?.type    ?? "",
        sens:    cat?.sens    ?? null,
        vol: 0, n: 0,
      }
      cur2.vol += Number(o.montant || 0)
      cur2.n   += 1
      agg.set(key, cur2)
    }
    const list = Array.from(agg.values()).sort((a, b) => b.vol - a.vol).slice(0, 5)
    for (const c of list) {
      top_categories.push({
        libelle:       c.libelle,
        type:          c.type,
        sens:          c.sens,
        volume_total:  c.vol,
        nb_operations: c.n,
      })
    }
  }

  // 5. Top 5 véhicules (CA + dépenses)
  const top_vehicules: TopVehicule[] = []
  {
    const { data: ops } = await supabaseAdmin
      .from("operations")
      .select("vehicule_id, type, montant")
      .eq("statut", "valide")
      .gte("date_operation", dateFrom)
      .lte("date_operation", dateTo)
      .not("vehicule_id", "is", null)
    const agg = new Map<number, { ca: number; dep: number; n: number }>()
    for (const o of ops ?? []) {
      const vid = Number(o.vehicule_id)
      if (!Number.isFinite(vid)) continue
      const cur2 = agg.get(vid) ?? { ca: 0, dep: 0, n: 0 }
      const m = Number(o.montant || 0)
      if (o.type === "entree")      { cur2.ca  += m; cur2.n += 1 }
      else if (o.type === "sortie")   cur2.dep += m
      agg.set(vid, cur2)
    }
    const list = Array.from(agg.entries())
      .sort(([, a], [, b]) => b.ca - a.ca)
      .slice(0, 5)
    const ids = list.map(([id]) => id)
    const immMap = new Map<number, string | null>()
    if (ids.length > 0) {
      const { data: vehs } = await supabaseAdmin
        .from("vehicules")
        .select("id_vehicule, immatriculation")
        .in("id_vehicule", ids)
      for (const v of vehs ?? []) immMap.set(v.id_vehicule, v.immatriculation ?? null)
    }
    for (const [vid, v] of list) {
      top_vehicules.push({
        vehicule_id:     vid,
        immatriculation: immMap.get(vid) ?? null,
        ca:              v.ca,
        depenses:        v.dep,
        nb_versements:   v.n,
      })
    }
  }

  // 6. Soldes caisses + comptes (tous temps confondus)
  const soldes: SoldeContenant[] = []
  {
    const [caissesRes, comptesRes, allOpsRes] = await Promise.all([
      supabaseAdmin.from("caisses").select("id, libelle, code, solde_initial"),
      supabaseAdmin.from("comptes").select("id, libelle, code, solde_initial"),
      supabaseAdmin.from("operations").select("caisse_id, compte_id, type, montant")
        .eq("statut", "valide"),
    ])
    const byCaisse = new Map<string, number>()
    const byCompte = new Map<string, number>()
    for (const op of allOpsRes.data ?? []) {
      const m = Number(op.montant || 0)
      const delta = op.type === "entree" ? m : -m
      if (op.caisse_id) byCaisse.set(op.caisse_id, (byCaisse.get(op.caisse_id) ?? 0) + delta)
      if (op.compte_id) byCompte.set(op.compte_id, (byCompte.get(op.compte_id) ?? 0) + delta)
    }
    for (const c of caissesRes.data ?? []) {
      const solde = Number(c.solde_initial || 0) + (byCaisse.get(c.id) ?? 0)
      soldes.push({ libelle: c.libelle, code: c.code ?? null, type_cible: "caisse", solde })
    }
    for (const c of comptesRes.data ?? []) {
      const solde = Number(c.solde_initial || 0) + (byCompte.get(c.id) ?? 0)
      soldes.push({ libelle: c.libelle, code: c.code ?? null, type_cible: "compte", solde })
    }
    soldes.sort((a, b) => b.solde - a.solde)
  }

  // 7. Health check rapide (lignes_ecritures sur ops valides)
  const health: RapportMensuelHealth = {
    ok:           true,
    total_debit:  0,
    total_credit: 0,
    ecart:        0,
    nb_ecritures: 0,
    nb_lignes:    0,
    nb_anomalies: 0,
  }
  {
    const { data: ecrIdsAll } = await supabaseAdmin
      .from("ecritures_comptables")
      .select("id")
      .eq("statut", "valide")
    const ecrSet = new Set((ecrIdsAll ?? []).map(e => e.id as string))
    health.nb_ecritures = ecrSet.size

    // Paginate les lignes
    const PAGE = 5000
    let from = 0
    while (from < 1_000_000) {
      const { data } = await supabaseAdmin
        .from("lignes_ecritures")
        .select("ecriture_id, debit, credit")
        .range(from, from + PAGE - 1)
      if (!data || data.length === 0) break
      for (const l of data) {
        if (!ecrSet.has(l.ecriture_id)) continue
        health.total_debit  += Number(l.debit  || 0)
        health.total_credit += Number(l.credit || 0)
        health.nb_lignes    += 1
      }
      if (data.length < PAGE) break
      from += PAGE
    }
    health.ecart = health.total_debit - health.total_credit
    health.ok    = Math.abs(health.ecart) < 0.5

    // Compteur basique d'anomalies = ops valides sans ecriture_id
    const { count } = await supabaseAdmin
      .from("operations")
      .select("id", { count: "exact", head: true })
      .eq("statut", "valide")
      .is("ecriture_id", null)
    health.nb_anomalies = count ?? 0
  }

  // 8. Top 20 opérations > 100k F sur la période
  const top_operations: OperationAnnexe[] = []
  {
    const { data: ops } = await supabaseAdmin
      .from("operations")
      .select(`
        id, date_operation, libelle, type, montant,
        caisse:caisse_id ( libelle ),
        compte:compte_id ( libelle ),
        categorie:categorie_id ( libelle )
      `)
      .eq("statut", "valide")
      .gte("date_operation", dateFrom)
      .lte("date_operation", dateTo)
      .gte("montant", 100_000)
      .order("montant", { ascending: false })
      .limit(20)
    for (const o of ops ?? []) {
      const caisse = (o.caisse as { libelle?: string } | null)?.libelle
                  ?? (o.compte as { libelle?: string } | null)?.libelle
                  ?? null
      top_operations.push({
        date_operation: String(o.date_operation),
        libelle:        String(o.libelle ?? ""),
        type:           o.type as "entree" | "sortie",
        montant:        Number(o.montant ?? 0),
        caisse_libelle: caisse,
        categorie:      (o.categorie as { libelle?: string } | null)?.libelle ?? null,
      })
    }
  }

  // Période libellé : si le date_from est le 1er du mois et date_to le dernier
  // du même mois, on affiche "Avril 2026". Sinon range complet.
  const d1 = new Date(dateFrom + "T00:00:00Z")
  const d2 = new Date(dateTo   + "T00:00:00Z")
  const isFullMonth =
    d1.getUTCDate() === 1 &&
    d2.getUTCFullYear() === d1.getUTCFullYear() &&
    d2.getUTCMonth() === d1.getUTCMonth() &&
    d2.getUTCDate() === new Date(Date.UTC(d2.getUTCFullYear(), d2.getUTCMonth() + 1, 0)).getUTCDate()
  const periode_libelle = isFullMonth
    ? `${MOIS_FR[d1.getUTCMonth()]} ${d1.getUTCFullYear()}`
    : `${dateFrom} → ${dateTo}`

  return {
    date_from:     dateFrom,
    date_to:       dateTo,
    periode_libelle,
    kpis,
    commentaire:   generateCommentaire(kpis, health),
    evolution_6_mois,
    top_categories,
    top_vehicules,
    soldes,
    health,
    top_operations,
  }
}
