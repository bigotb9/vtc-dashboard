/**
 * GET /api/compta/dashboard/stats
 *
 * Endpoint agrégé du Dashboard comptable (Écran 3 Phase 3).
 * Réservé directeur. Référence : doc §6.1.
 *
 * 7 sections de data en 1 fetch :
 *   - kpis : CA, dépenses, résultat net, trésorerie + trends vs mois précédent
 *   - health : équilibre comptable (compteurs + anomalies)
 *   - ca_vs_depenses_12_mois : série 12 derniers mois calendaires
 *   - entrees_par_caisse : donut data, période courante
 *   - depenses_par_categorie : top 5 catégories de dépenses, période courante
 *   - top_vehicules : top 5 véhicules par CA sur la période
 *   - dernieres_ecritures : 5 écritures les plus récentes (hors extournes)
 *   - soldes_caisses_comptes : soldes cumulés tous temps confondus
 *
 * Query params :
 *   date_from : YYYY-MM-DD (défaut : début du mois courant)
 *   date_to   : YYYY-MM-DD (défaut : fin du mois courant)
 *   period    : "all" → force date_from=1900-01-01 et date_to=9999-12-31
 *               et désactive les trends % (pas de période précédente
 *               pertinente quand on regarde tout l'historique).
 */

import type { NextRequest } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { requireDirecteurCompta } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"

export const dynamic     = "force-dynamic"
export const maxDuration = 30

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function firstOfMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
}
function lastOfMonth(d: Date): string {
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`
}
function pct(current: number, prev: number): number | null {
  if (!Number.isFinite(prev) || prev === 0) return null
  return Math.round(((current - prev) / Math.abs(prev)) * 10) / 10
}

/** Translation [date_from, date_to] vers la période précédente de durée identique. */
function periodePrecedente(dateFrom: string, dateTo: string): { date_from: string; date_to: string } {
  const d1 = new Date(dateFrom + "T00:00:00Z")
  const d2 = new Date(dateTo   + "T00:00:00Z")
  const dayMs = 86_400_000
  const dureeJours = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / dayMs) + 1)
  const newTo   = new Date(d1.getTime() - dayMs)
  const newFrom = new Date(newTo.getTime() - (dureeJours - 1) * dayMs)
  return {
    date_from: newFrom.toISOString().slice(0, 10),
    date_to:   newTo.toISOString().slice(0, 10),
  }
}

/** Agrégation montants par type (entree/sortie) sur une fenêtre.
 *
 *  Fix 26/05/2026 (Lot F audit) : exclusion `source != 'transfert_interne'`
 *  pour cohérence avec depenses-V2 / recettes-V2 / bilan-cash-net. Un
 *  transfert Wave → Caisse de N F gonfle artificiellement CA + dépenses
 *  du même montant (résultat OK, mais CA et marge faussés). */
async function agregerMontantsParType(dateFrom: string, dateTo: string)
: Promise<{ entrees: number; sorties: number }> {
  let entrees = 0
  let sorties = 0
  const PAGE = 5000
  let from = 0
  while (from < 1_000_000) {
    const { data, error } = await supabaseAdmin
      .from("operations")
      .select("type, montant")
      .eq("statut", "valide")
      .neq("source", "transfert_interne")
      .gte("date_operation", dateFrom)
      .lte("date_operation", dateTo)
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const r of data) {
      const m = Number(r.montant || 0)
      if (r.type === "entree") entrees += m
      else if (r.type === "sortie") sorties += m
    }
    if (data.length < PAGE) break
    from += PAGE
  }
  return { entrees, sorties }
}

/** Itère SELECT * paginé jusqu'à épuisement.
 *
 *  Fix 26/05/2026 (Lot F audit) : nouveau flag `excludeTransfertInterne`.
 *  Mis à `true` pour les agrégats CA / dépenses / catégories / top véhicules
 *  (les transferts internes ne sont ni du CA ni de la dépense réelle).
 *  Laissé à `false` (défaut) pour le calcul des soldes caisses/comptes, qui
 *  doivent refléter tous les mouvements y compris les transferts internes. */
async function fetchAllOps(
  query: string,
  dateFrom: string,
  dateTo: string,
  extra?: { type?: "entree" | "sortie"; excludeTransfertInterne?: boolean },
)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
: Promise<any[]> {
  const out: Record<string, unknown>[] = []
  const PAGE = 5000
  let from = 0
  while (from < 200_000) {
    let q = supabaseAdmin
      .from("operations")
      .select(query)
      .eq("statut", "valide")
      .gte("date_operation", dateFrom)
      .lte("date_operation", dateTo)
    if (extra?.type) q = q.eq("type", extra.type)
    if (extra?.excludeTransfertInterne) q = q.neq("source", "transfert_interne")
    const { data, error } = await q.range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    out.push(...(data as unknown as Record<string, unknown>[]))
    if (data.length < PAGE) break
    from += PAGE
  }
  return out
}

// ─── Route GET ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  const url   = new URL(req.url)
  const today = new Date()
  const periodParam = url.searchParams.get("period")
  const isAllTime   = periodParam === "all"

  // Période par défaut : mois courant. Si ?period=all → plage très large
  // pour couvrir tout l'historique (et trends % désactivées plus bas).
  const date_from = isAllTime
    ? "1900-01-01"
    : url.searchParams.get("date_from") ?? firstOfMonth(today)
  const date_to   = isAllTime
    ? "9999-12-31"
    : url.searchParams.get("date_to") ?? lastOfMonth(today)

  if (!DATE_RE.test(date_from) || !DATE_RE.test(date_to)) {
    return comptaError("INVALID_PAYLOAD", { field: "date_from/date_to" }, "Format YYYY-MM-DD attendu")
  }

  // ── Types partages entre les sections (extraits hors du try) ──────────────
  type SoldeRow = {
    id:             string
    libelle:        string
    code:           string | null
    type_cible:     "caisse" | "compte"
    nb_mouvements:  number
    solde:          number
  }
  type EntreeCaisse  = { caisse_id: string; libelle: string; code: string | null; total: number; pct: number }
  type DepenseCat    = { categorie_id: string | null; libelle: string; total: number }
  type TopVeh = {
    vehicule_id:    number
    immatriculation: string | null
    chauffeur_id:    number | null
    chauffeur_nom:   string | null
    nb_versements:   number
    ca_total:        number
  }
  type DernEcr = {
    ecriture_id:     string
    numero:          string
    date_ecriture:   string
    journal_code:    string
    operation_id:    string | null
    libelle:         string
    type:            "entree" | "sortie" | null
    montant:         number | null
    caisse_libelle:  string | null
    caisse_code:     string | null
  }

  try {
    // ─── Refacto Lot I (26/05/2026 audit) ────────────────────────────────
    // Auparavant 100% sequentiel : 8 sections en serie + fetchAllOps complet
    // chargeait tout l'historique en RAM par sections. Le handler prenait
    // plusieurs secondes.
    //
    // Maintenant : chaque section est wrappee en fonction async locale, puis
    // toutes lancees via Promise.all. Gain ~5-8x sur le temps de reponse.
    //
    // Dependances residuelles minimales :
    //   - kpis final lit { current, prevAgg } de section 1 ET { tresorerie,
    //     tresorerie_prev } de section 2 -> assemblage final apres Promise.all
    //   - soldes_caisses_comptes lit { soldes } de section 2
    //   - sections 3-8 totalement independantes

    // Section 1 - KPIs (current + previous period)
    const compute1Kpis = async () => {
      const [current, prevAgg] = await Promise.all([
        agregerMontantsParType(date_from, date_to),
        isAllTime
          ? Promise.resolve({ entrees: 0, sorties: 0 })
          : agregerMontantsParType(
              periodePrecedente(date_from, date_to).date_from,
              periodePrecedente(date_from, date_to).date_to,
            ),
      ])
      return { current, prevAgg }
    }

    // Section 2 - Soldes caisses + comptes (cumul tous temps confondus)
    const compute2Soldes = async (): Promise<{
      tresorerie: number; tresorerie_prev: number; soldes: SoldeRow[]
    }> => {
      // Les 3 requetes (caisses, comptes, allOps) sont independantes -> Promise.all
      const [caissesRes, comptesRes, allOps] = await Promise.all([
        supabaseAdmin.from("caisses").select("id, libelle, code, solde_initial"),
        supabaseAdmin.from("comptes").select("id, libelle, code, solde_initial"),
        fetchAllOps("compte_id, caisse_id, type, montant, date_operation", "1900-01-01", "9999-12-31"),
      ])
      const caisses = caissesRes.data ?? []
      const comptes = comptesRes.data ?? []

      type Bucket = { entrees: number; sorties: number; count: number; entrees_12moisAgo: number; sorties_12moisAgo: number }
      const bucketsCaisses = new Map<string, Bucket>()
      const bucketsComptes = new Map<string, Bucket>()

      const todayMs = today.getTime()
      const cut12   = new Date(todayMs - 365 * 86_400_000).toISOString().slice(0, 10)

      for (const op of allOps) {
        const m = Number(op.montant || 0)
        const isEntree = op.type === "entree"
        const dateOp   = String(op.date_operation)
        const target   = op.caisse_id ? "caisse" : op.compte_id ? "compte" : null
        if (!target) continue
        const id  = (op.caisse_id ?? op.compte_id) as string
        const buckets = target === "caisse" ? bucketsCaisses : bucketsComptes
        const cur = buckets.get(id) ?? { entrees: 0, sorties: 0, count: 0, entrees_12moisAgo: 0, sorties_12moisAgo: 0 }
        cur.count++
        if (isEntree) cur.entrees += m
        else          cur.sorties += m
        if (dateOp < cut12) {
          if (isEntree) cur.entrees_12moisAgo += m
          else          cur.sorties_12moisAgo += m
        }
        buckets.set(id, cur)
      }

      let tresorerie = 0
      let tresorerie_prev = 0
      const soldes: SoldeRow[] = []

      for (const c of caisses) {
        const b = bucketsCaisses.get(c.id) ?? { entrees: 0, sorties: 0, count: 0, entrees_12moisAgo: 0, sorties_12moisAgo: 0 }
        const solde_initial = Number(c.solde_initial || 0)
        const solde         = solde_initial + b.entrees - b.sorties
        const solde_12moisAgo = solde_initial + b.entrees_12moisAgo - b.sorties_12moisAgo
        tresorerie      += solde
        tresorerie_prev += solde_12moisAgo
        soldes.push({
          id: c.id, libelle: c.libelle, code: c.code,
          type_cible: "caisse",
          nb_mouvements: b.count,
          solde,
        })
      }
      for (const c of comptes) {
        const b = bucketsComptes.get(c.id) ?? { entrees: 0, sorties: 0, count: 0, entrees_12moisAgo: 0, sorties_12moisAgo: 0 }
        const solde_initial = Number(c.solde_initial || 0)
        const solde         = solde_initial + b.entrees - b.sorties
        const solde_12moisAgo = solde_initial + b.entrees_12moisAgo - b.sorties_12moisAgo
        tresorerie      += solde
        tresorerie_prev += solde_12moisAgo
        soldes.push({
          id: c.id, libelle: c.libelle, code: c.code,
          type_cible: "compte",
          nb_mouvements: b.count,
          solde,
        })
      }
      soldes.sort((a, b) => b.solde - a.solde)
      return { tresorerie, tresorerie_prev, soldes }
    }

    // Section 3 - Health (equilibre comptable + ops missing proof)
    const compute3Health = async () => {
      // Les 3 sous-queries (count ecritures, agreg lignes, ops candidates) sont
      // toutes independantes -> Promise.all (au lieu de l'original qui parallelisait
      // seulement 2 sur 3).
      const [
        { count: nbEcritures },
        lignesAgg,
        { data: candidateOps },
      ] = await Promise.all([
        supabaseAdmin
          .from("ecritures_comptables")
          .select("id", { count: "exact", head: true })
          .eq("statut", "valide"),
        (async () => {
          let totalDebit = 0
          let totalCredit = 0
          let nbLignes = 0
          const PAGE = 5000
          let from = 0
          while (from < 1_000_000) {
            const { data, error } = await supabaseAdmin
              .from("lignes_ecritures")
              .select("debit, credit, ecriture_id, ecriture:ecriture_id(statut)")
              .range(from, from + PAGE - 1)
            if (error) throw error
            if (!data || data.length === 0) break
            for (const l of data) {
              const ec = l.ecriture as { statut?: string } | null
              if (ec?.statut !== "valide") continue
              totalDebit  += Number(l.debit  || 0)
              totalCredit += Number(l.credit || 0)
              nbLignes++
            }
            if (data.length < PAGE) break
            from += PAGE
          }
          return { totalDebit, totalCredit, nbLignes }
        })(),
        supabaseAdmin
          .from("operations")
          .select("id")
          .eq("type",   "sortie")
          .eq("statut", "valide")
          .not("tiers_id", "is", null),
      ])

      const anomalies: string[] = []
      if (lignesAgg.totalDebit !== lignesAgg.totalCredit) {
        anomalies.push(`Σ(débit)=${lignesAgg.totalDebit} ≠ Σ(crédit)=${lignesAgg.totalCredit}`)
      }

      const candidateIds = ((candidateOps ?? []) as Array<{ id: string }>).map(r => r.id)
      let nbOpsMissingProof = 0
      if (candidateIds.length > 0) {
        const { data: withProof } = await supabaseAdmin
          .from("justificatifs")
          .select("operation_id")
          .in("operation_id", candidateIds)
          .is("deleted_at", null)
        const setWithProof = new Set(((withProof ?? []) as Array<{ operation_id: string }>).map(r => r.operation_id))
        nbOpsMissingProof = candidateIds.filter(id => !setWithProof.has(id)).length
      }
      if (nbOpsMissingProof > 0) {
        anomalies.push(`${nbOpsMissingProof} opération${nbOpsMissingProof > 1 ? "s" : ""} sortie vers tiers sans justificatif`)
      }

      return {
        ok:           anomalies.length === 0,
        nb_ecritures: nbEcritures ?? 0,
        nb_lignes:    lignesAgg.nbLignes,
        total_debit:  lignesAgg.totalDebit,
        total_credit: lignesAgg.totalCredit,
        anomalies,
        nb_ops_missing_proof: nbOpsMissingProof,
      }
    }

    // Section 4 - CA vs Depenses 12 mois calendaires
    const compute4Ca12Mois = async (): Promise<{ mois: string; ca: number; depenses: number }[]> => {
      const moisLabels: string[] = []
      for (let i = 11; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
        moisLabels.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
      }
      const first  = `${moisLabels[0]}-01`
      const last   = lastOfMonth(new Date(today.getFullYear(), today.getMonth(), 1))
      const allOps = await fetchAllOps("type, montant, date_operation", first, last, { excludeTransfertInterne: true })
      const m = new Map<string, { ca: number; depenses: number }>()
      for (const mois of moisLabels) m.set(mois, { ca: 0, depenses: 0 })
      for (const op of allOps) {
        const mois = String(op.date_operation).slice(0, 7)
        const slot = m.get(mois); if (!slot) continue
        const val = Number(op.montant || 0)
        if (op.type === "entree")      slot.ca       += val
        else if (op.type === "sortie") slot.depenses += val
      }
      return moisLabels.map(mois => {
        const v = m.get(mois)!
        return { mois, ca: v.ca, depenses: v.depenses }
      })
    }

    // Section 5 - Entrees par caisse (periode courante)
    const compute5EntreesCaisse = async (): Promise<EntreeCaisse[]> => {
      // caisses + ops parallelises
      const [caissesRes, allOps] = await Promise.all([
        supabaseAdmin.from("caisses").select("id, libelle, code"),
        fetchAllOps("caisse_id, montant", date_from, date_to, { type: "entree", excludeTransfertInterne: true }),
      ])
      const caisseMap = new Map<string, { libelle: string; code: string | null }>()
      for (const c of caissesRes.data ?? []) caisseMap.set(c.id, { libelle: c.libelle, code: c.code })

      const totals = new Map<string, number>()
      for (const op of allOps) {
        if (!op.caisse_id) continue
        const id = op.caisse_id as string
        totals.set(id, (totals.get(id) ?? 0) + Number(op.montant || 0))
      }
      const grandTotal = Array.from(totals.values()).reduce((s, n) => s + n, 0)
      const result: EntreeCaisse[] = []
      for (const [id, total] of totals) {
        const meta = caisseMap.get(id) ?? { libelle: "Caisse ?", code: null }
        result.push({
          caisse_id: id,
          libelle:   meta.libelle,
          code:      meta.code,
          total,
          pct:       grandTotal > 0 ? Math.round((total / grandTotal) * 1000) / 10 : 0,
        })
      }
      result.sort((a, b) => b.total - a.total)
      return result
    }

    // Section 6 - Depenses par categorie (top 5 + "Autres")
    const compute6DepensesCategorie = async (): Promise<DepenseCat[]> => {
      // categories + ops parallelises
      const [catsRes, allOps] = await Promise.all([
        supabaseAdmin.from("categories_operations").select("id, libelle"),
        fetchAllOps("categorie_id, montant", date_from, date_to, { type: "sortie", excludeTransfertInterne: true }),
      ])
      const catMap = new Map<string, string>()
      for (const c of catsRes.data ?? []) catMap.set(c.id, c.libelle)

      const totals = new Map<string, number>()
      for (const op of allOps) {
        const id = (op.categorie_id ?? "_") as string
        totals.set(id, (totals.get(id) ?? 0) + Number(op.montant || 0))
      }
      const rows = Array.from(totals.entries()).map(([id, total]) => ({
        categorie_id: id === "_" ? null : id,
        libelle:      catMap.get(id) ?? "Sans catégorie",
        total,
      }))
      rows.sort((a, b) => b.total - a.total)
      const result: DepenseCat[] = rows.slice(0, 5)
      const reste = rows.slice(5)
      if (reste.length > 0) {
        const totalReste = reste.reduce((s, r) => s + r.total, 0)
        result.push({ categorie_id: null, libelle: "Autres", total: totalReste })
      }
      return result
    }

    // Section 7 - Top 5 vehicules
    const compute7TopVehicules = async (): Promise<TopVeh[]> => {
      const allOps = await fetchAllOps(
        "vehicule_id, chauffeur_id, montant",
        date_from, date_to, { type: "entree", excludeTransfertInterne: true },
      )
      type Agg = { ca: number; count: number; chauffeurs: Map<number, number> }
      const byVeh = new Map<number, Agg>()
      for (const op of allOps) {
        if (op.vehicule_id == null) continue
        const vId = Number(op.vehicule_id)
        const cur = byVeh.get(vId) ?? { ca: 0, count: 0, chauffeurs: new Map() }
        cur.ca    += Number(op.montant || 0)
        cur.count += 1
        if (op.chauffeur_id != null) {
          const chId = Number(op.chauffeur_id)
          cur.chauffeurs.set(chId, (cur.chauffeurs.get(chId) ?? 0) + 1)
        }
        byVeh.set(vId, cur)
      }
      const sorted = Array.from(byVeh.entries())
        .sort((a, b) => b[1].ca - a[1].ca)
        .slice(0, 5)
      const idsVeh = sorted.map(([id]) => id)
      const idsCh  = Array.from(new Set(sorted.flatMap(([, agg]) => Array.from(agg.chauffeurs.keys()))))

      // vehicules + chauffeurs parallelises
      const [vRes, cRes] = await Promise.all([
        idsVeh.length > 0
          ? supabaseAdmin.from("vehicules").select("id_vehicule, immatriculation").in("id_vehicule", idsVeh)
          : Promise.resolve({ data: [] as Array<{ id_vehicule: number; immatriculation: string | null }> }),
        idsCh.length > 0
          ? supabaseAdmin.from("chauffeurs").select("id_chauffeur, nom").in("id_chauffeur", idsCh)
          : Promise.resolve({ data: [] as Array<{ id_chauffeur: number; nom: string | null }> }),
      ])
      const vMap = new Map<number, string | null>()
      const cMap = new Map<number, string | null>()
      for (const v of vRes.data ?? []) vMap.set(v.id_vehicule, v.immatriculation)
      for (const c of cRes.data ?? []) cMap.set(c.id_chauffeur, c.nom)

      const result: TopVeh[] = []
      for (const [vId, agg] of sorted) {
        let chId: number | null = null
        let max = 0
        for (const [id, c] of agg.chauffeurs) {
          if (c > max) { max = c; chId = id }
        }
        result.push({
          vehicule_id:     vId,
          immatriculation: vMap.get(vId) ?? null,
          chauffeur_id:    chId,
          chauffeur_nom:   chId != null ? cMap.get(chId) ?? null : null,
          nb_versements:   agg.count,
          ca_total:        agg.ca,
        })
      }
      return result
    }

    // Section 8 - 5 dernieres ecritures (hors extournes)
    const compute8DernieresEcritures = async (): Promise<DernEcr[]> => {
      const { data: ecrs } = await supabaseAdmin
        .from("ecritures_comptables")
        .select("id, numero, date_ecriture, journal_code, libelle, operation_id, created_at")
        .eq("statut", "valide")
        .is("extourne_de", null)
        .order("created_at", { ascending: false })
        .limit(5)

      const opIds = Array.from(new Set((ecrs ?? []).map(e => e.operation_id).filter((x): x is string => !!x)))
      const opMap = new Map<string, { type: string; montant: number; caisse_id: string | null; libelle: string }>()
      if (opIds.length > 0) {
        const { data: ops } = await supabaseAdmin
          .from("operations")
          .select("id, type, montant, caisse_id, libelle")
          .in("id", opIds)
        for (const o of ops ?? []) {
          opMap.set(o.id, { type: o.type, montant: Number(o.montant), caisse_id: o.caisse_id, libelle: o.libelle })
        }
      }
      const caisseIds = Array.from(new Set(Array.from(opMap.values()).map(o => o.caisse_id).filter((x): x is string => !!x)))
      const caisseMap = new Map<string, { libelle: string; code: string | null }>()
      if (caisseIds.length > 0) {
        const { data: caisses } = await supabaseAdmin
          .from("caisses").select("id, libelle, code").in("id", caisseIds)
        for (const c of caisses ?? []) caisseMap.set(c.id, { libelle: c.libelle, code: c.code })
      }

      const result: DernEcr[] = []
      for (const e of ecrs ?? []) {
        const op = e.operation_id ? opMap.get(e.operation_id) : null
        const caisse = op?.caisse_id ? caisseMap.get(op.caisse_id) : null
        result.push({
          ecriture_id:     e.id,
          numero:          e.numero,
          date_ecriture:   e.date_ecriture,
          journal_code:    e.journal_code,
          operation_id:    e.operation_id,
          libelle:         op?.libelle ?? e.libelle,
          type:            (op?.type as "entree" | "sortie" | undefined) ?? null,
          montant:         op?.montant ?? null,
          caisse_libelle:  caisse?.libelle ?? null,
          caisse_code:     caisse?.code    ?? null,
        })
      }
      return result
    }

    // ─── Lancement parallele des 8 sections ─────────────────────────────────
    const [
      kpisAgg,
      soldesResult,
      health,
      ca_vs_depenses_12_mois,
      entrees_par_caisse,
      depenses_par_categorie,
      top_vehicules,
      dernieres_ecritures,
    ] = await Promise.all([
      compute1Kpis(),
      compute2Soldes(),
      compute3Health(),
      compute4Ca12Mois(),
      compute5EntreesCaisse(),
      compute6DepensesCategorie(),
      compute7TopVehicules(),
      compute8DernieresEcritures(),
    ])

    // ─── Assemblage final des KPIs (depend de section 1 + section 2) ───────
    const { current, prevAgg } = kpisAgg
    const resultat_net      = current.entrees - current.sorties
    const resultat_net_prev = prevAgg.entrees - prevAgg.sorties

    const kpis = {
      ca:                    current.entrees,
      ca_trend_pct:          isAllTime ? null : pct(current.entrees, prevAgg.entrees),
      depenses:              current.sorties,
      depenses_trend_pct:    isAllTime ? null : pct(current.sorties, prevAgg.sorties),
      resultat_net,
      resultat_trend_pct:    isAllTime ? null : pct(resultat_net, resultat_net_prev),
      marge_pct:             current.entrees > 0 ? Math.round((resultat_net / current.entrees) * 1000) / 10 : null,
      tresorerie:            soldesResult.tresorerie,
      tresorerie_trend_pct:  isAllTime ? null : pct(soldesResult.tresorerie, soldesResult.tresorerie_prev),
    }

    return comptaOk({
      kpis,
      health,
      ca_vs_depenses_12_mois,
      entrees_par_caisse,
      depenses_par_categorie,
      top_vehicules,
      dernieres_ecritures,
      soldes_caisses_comptes: soldesResult.soldes,
      periode: { date_from, date_to },
    })
  } catch (e) {
    console.error("[dashboard/stats]", e)
    return comptaError("DB_ERROR", { hint: (e as Error).message })
  }
}
