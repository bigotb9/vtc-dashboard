/**
 * lib/clients/calculBeneficeCumule.ts
 *
 * Calcule le benefice cumule de Boyah Group par Client depuis son entree.
 *
 * Formule mensuelle (deja codee dans /api/clients) :
 *   Charge Boyah    = min(depenses, 50_000) par vehicule
 *   Net client      = montant_mensuel_client - max(0, depenses - 50_000)
 *   Profit Boyah    = revenu - net_client - charge_boyah
 *
 * Le benefice CUMULE est la somme des profits Boyah sur tous les mois
 * d'exploitation depuis l'entree du Client. Pour limiter le cout, on
 * agrege sur les 12 derniers mois maximum (rolling window).
 *
 * Ajoute le 23/05/2026 (B1 module Clients enrichi).
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"
// Lot U (audit 27/05/2026) : helper unique pour le calcul du loyer net.
import { calculLoyerNet } from "@/lib/clients/calculLoyerNet"

export interface BeneficeCumule {
  client_id:        number
  benefice_total:   number
  nb_mois:          number
  premier_mois:     string | null   // YYYY-MM
  dernier_mois:     string | null   // YYYY-MM
}

/**
 * Genere la liste des mois entre deux dates au format YYYY-MM (inclus).
 */
function moisEntre(from: Date, to: Date): string[] {
  const mois: string[] = []
  const cur = new Date(from.getFullYear(), from.getMonth(), 1)
  const fin = new Date(to.getFullYear(),   to.getMonth(),   1)
  while (cur <= fin) {
    mois.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`)
    cur.setMonth(cur.getMonth() + 1)
  }
  return mois
}

/**
 * Calcule le benefice cumule pour une liste de Clients (passe par leurs IDs).
 * Renvoie un Map id_client -> BeneficeCumule.
 *
 * Implementation : on calcule sur les 12 derniers mois maximum. Pour les
 * clients plus anciens, c'est une approximation (suffisante pour l'affichage
 * de la card). Le KPI exact pourra etre calcule plus tard via une vue
 * materialisee si besoin.
 */
export async function calculBeneficeCumuleByClient(
  clientIds: number[],
): Promise<Map<number, BeneficeCumule>> {
  const result = new Map<number, BeneficeCumule>()
  if (clientIds.length === 0) return result

  // Rolling window : 12 derniers mois
  const today = new Date()
  const debut = new Date(today.getFullYear(), today.getMonth() - 11, 1)
  const mois  = moisEntre(debut, today)

  // 1. Vehicules sous gestion par client
  const { data: vehicules, error: vehErr } = await supabaseAdmin
    .from("vehicules")
    .select("id_vehicule, immatriculation, id_client, montant_mensuel_client, sous_gestion")
    .in("id_client", clientIds)
    .eq("sous_gestion", true)
  if (vehErr) throw new Error(`Lecture vehicules : ${vehErr.message}`)

  const vehMap = new Map<number, { id_client: number; immat: string; loyer: number }>()
  for (const v of vehicules || []) {
    if (v.id_vehicule == null || v.id_client == null) continue
    vehMap.set(v.id_vehicule, {
      id_client: v.id_client,
      immat:     v.immatriculation ?? "?",
      loyer:     Number(v.montant_mensuel_client || 0),
    })
  }

  // 2. Recettes par mois et par vehicule (via vue_recettes_vehicules)
  // On charge tout sur la fenetre 12 mois puis on agrege en memoire
  const dateFrom = `${mois[0]}-01`
  const dateTo   = `${mois[mois.length - 1]}-31`
  const recettesMap = new Map<string, number>() // key = `${id_vehicule}_${YYYY-MM}`

  let pageFrom = 0
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from("vue_recettes_vehicules")
      .select("immatriculation, Horodatage, \"Montant net\"")
      .gte("Horodatage", dateFrom)
      .lte("Horodatage", dateTo + "T23:59:59.999")
      .range(pageFrom, pageFrom + 999)
    if (error) throw new Error(`Lecture recettes : ${error.message}`)
    if (!data || data.length === 0) break
    for (const r of data) {
      const immat = String(r.immatriculation ?? "")
      const veh = [...vehMap.values()].find(v => v.immat === immat)
      if (!veh) continue
      const idVeh = [...vehMap.entries()].find(([, v]) => v.immat === immat)?.[0]
      if (!idVeh) continue
      const ymd = String(r.Horodatage ?? "").slice(0, 7)
      const m = Number((r as { "Montant net"?: number })["Montant net"] || 0)
      const key = `${idVeh}_${ymd}`
      recettesMap.set(key, (recettesMap.get(key) || 0) + m)
    }
    if (data.length < 1000) break
    pageFrom += 1000
  }

  // 3. Depenses par mois et par vehicule
  const depensesMap = new Map<string, number>()
  pageFrom = 0
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from("depenses_vehicules")
      .select("id_vehicule, date_depense, montant, type_depense")
      .gte("date_depense", dateFrom)
      .lte("date_depense", dateTo)
      .range(pageFrom, pageFrom + 999)
    if (error) throw new Error(`Lecture depenses : ${error.message}`)
    if (!data || data.length === 0) break
    for (const d of data) {
      if (d.id_vehicule == null || !vehMap.has(d.id_vehicule)) continue
      // Exclure les reversements clients (sortie via leur propre flux)
      const t = String(d.type_depense ?? "").toLowerCase()
      if (t.includes("reversement")) continue
      const ymd = String(d.date_depense ?? "").slice(0, 7)
      const key = `${d.id_vehicule}_${ymd}`
      depensesMap.set(key, (depensesMap.get(key) || 0) + Number(d.montant || 0))
    }
    if (data.length < 1000) break
    pageFrom += 1000
  }

  // 4. Aggregation par client
  const beneficeByClient = new Map<number, { total: number; mois_actifs: Set<string> }>()
  for (const cid of clientIds) {
    beneficeByClient.set(cid, { total: 0, mois_actifs: new Set() })
  }

  for (const [idVeh, veh] of vehMap.entries()) {
    const agg = beneficeByClient.get(veh.id_client)
    if (!agg) continue
    for (const ym of mois) {
      const key = `${idVeh}_${ym}`
      const revenu   = recettesMap.get(key)  || 0
      const depenses = depensesMap.get(key)  || 0
      if (revenu === 0 && depenses === 0) continue
      // Lot U (audit 27/05/2026) : delegation au helper unique calculLoyerNet.
      // Les reversements sont DEJA filtres en amont (cf. boucle l. 125-133
      // qui skip type_depense.includes("reversement")), donc on passe
      // excludeReversements=false pour eviter un double filtrage.
      const { loyerNet, chargeBoyah } = calculLoyerNet(
        veh.loyer,
        [{ montant: depenses }],
        { excludeReversements: false },
      )
      const profit_boyah = revenu - loyerNet - chargeBoyah
      agg.total += profit_boyah
      agg.mois_actifs.add(ym)
    }
  }

  // 5. Construction du resultat
  for (const cid of clientIds) {
    const agg = beneficeByClient.get(cid)
    if (!agg) continue
    const moisActifs = [...agg.mois_actifs].sort()
    result.set(cid, {
      client_id:    cid,
      benefice_total: Math.round(agg.total),
      nb_mois:      moisActifs.length,
      premier_mois: moisActifs[0] ?? null,
      dernier_mois: moisActifs[moisActifs.length - 1] ?? null,
    })
  }

  return result
}
