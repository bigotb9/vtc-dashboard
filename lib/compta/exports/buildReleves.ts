/**
 * Builder du PDF Relevés de trésorerie (Phase 4 §4.4).
 *
 * Pour chaque caisse/compte sélectionné (ou tous si vide) :
 *   - Solde initial = solde_initial caisse/compte + Σ(deltas ops valides
 *     AVANT date_from)
 *   - Mouvements de la période [date_from, date_to] triés par date avec
 *     solde cumulé pour chaque ligne
 *   - Solde final = solde initial + Σ entrées − Σ sorties (vérifié)
 *
 * Note : tri par date_operation puis created_at pour gérer les ops du
 * même jour avec ordre déterministe.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"

export interface ReleveMouvement {
  date_operation: string
  libelle:        string
  type:           "entree" | "sortie"
  categorie:      string | null
  montant:        number
  /** Solde cumulé APRÈS ce mouvement. */
  solde_cumule:   number
}

export interface ReleveContenant {
  id:               string
  libelle:          string
  code:             string | null
  type_cible:       "caisse" | "compte"
  /** Pour caisses : cash/mobile_money. Pour comptes : null. */
  sous_type:        string | null
  /** Pour mobile_money : Wave / Orange / MTN / etc. Pour comptes : banque. */
  operateur_banque: string | null
  syscohada_code:   string | null
  syscohada_libelle: string | null
  solde_initial:    number      // au date_from inclus, donc =solde_initial_table + deltas avant
  solde_final:      number      // = solde_initial + Σ entrées − Σ sorties
  total_entrees:    number
  total_sorties:    number
  mouvements:       ReleveMouvement[]
}

export interface RelevesData {
  date_from:    string
  date_to:      string
  contenants:   ReleveContenant[]
  total_initial:   number
  total_final:     number
  total_entrees:   number
  total_sorties:   number
}

export interface BuildRelevesOptions {
  /** UUIDs caisses+comptes à inclure. Vide ou contient "all" → tous actifs. */
  caisses_ids?: string[]
}

export async function buildReleves(
  dateFrom: string,
  dateTo:   string,
  opts:     BuildRelevesOptions = {},
): Promise<RelevesData> {
  // 1. Récupérer la liste des contenants (caisses + comptes)
  const filterRaw = (opts.caisses_ids ?? []).map(s => s.trim()).filter(Boolean)
  const filterAll = filterRaw.length === 0 || filterRaw.includes("all")
  const wantedIds = new Set(filterRaw)

  const [caissesRes, comptesRes] = await Promise.all([
    supabaseAdmin
      .from("caisses")
      .select("id, libelle, code, type, operateur, solde_initial, compte_syscohada_code, actif")
      .order("libelle"),
    supabaseAdmin
      .from("comptes")
      .select("id, libelle, code, banque, solde_initial, compte_syscohada_code, actif")
      .order("libelle"),
  ])
  if (caissesRes.error) throw caissesRes.error
  if (comptesRes.error) throw comptesRes.error

  type Brut = {
    id: string; libelle: string; code: string | null
    type_cible: "caisse" | "compte"
    sous_type: string | null; operateur_banque: string | null
    syscohada_code: string | null
    solde_initial_db: number
  }
  const brutes: Brut[] = []
  for (const c of caissesRes.data ?? []) {
    if (!filterAll && !wantedIds.has(c.id)) continue
    brutes.push({
      id:               String(c.id),
      libelle:          c.libelle,
      code:             c.code ?? null,
      type_cible:       "caisse",
      sous_type:        c.type ?? null,
      operateur_banque: c.operateur ?? null,
      syscohada_code:   c.compte_syscohada_code ?? null,
      solde_initial_db: Number(c.solde_initial ?? 0),
    })
  }
  for (const c of comptesRes.data ?? []) {
    if (!filterAll && !wantedIds.has(c.id)) continue
    brutes.push({
      id:               String(c.id),
      libelle:          c.libelle,
      code:             c.code ?? null,
      type_cible:       "compte",
      sous_type:        null,
      operateur_banque: c.banque ?? null,
      syscohada_code:   c.compte_syscohada_code ?? null,
      solde_initial_db: Number(c.solde_initial ?? 0),
    })
  }

  // 2. Récupérer libellés SYSCOHADA en bulk
  const codes = Array.from(new Set(brutes.map(b => b.syscohada_code).filter((x): x is string => !!x)))
  const codeLibelle = new Map<string, string>()
  if (codes.length > 0) {
    const { data: sys } = await supabaseAdmin
      .from("comptes_syscohada")
      .select("code, libelle")
      .in("code", codes)
    for (const c of sys ?? []) codeLibelle.set(c.code, c.libelle)
  }

  // 3. Pour chaque contenant : calculer solde initial + mouvements de la période
  const contenants: ReleveContenant[] = []
  let totalInit = 0, totalFin = 0, totalEnt = 0, totalSor = 0

  for (const b of brutes) {
    // 3a. Charger TOUTES les ops valides de ce contenant (toutes périodes)
    const col = b.type_cible === "caisse" ? "caisse_id" : "compte_id"
    const { data: ops, error: opsErr } = await supabaseAdmin
      .from("operations")
      .select(`
        id, date_operation, libelle, type, montant, statut, created_at,
        categorie:categorie_id ( libelle )
      `)
      .eq(col, b.id)
      .eq("statut", "valide")
      .order("date_operation", { ascending: true })
      .order("created_at",     { ascending: true })
    if (opsErr) throw opsErr

    // 3b. Soldes init / final + mouvements de la période
    let soldeInit = b.solde_initial_db
    const mvts: ReleveMouvement[] = []
    let entrPer = 0, sortPer = 0

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const o of (ops ?? []) as any[]) {
      const dop  = String(o.date_operation)
      const m    = Number(o.montant ?? 0)
      const delta = o.type === "entree" ? m : -m
      if (dop < dateFrom) {
        soldeInit += delta
        continue
      }
      if (dop > dateTo) continue   // ne pas dépasser la période
      // Dans la période
      if (o.type === "entree") entrPer += m
      else                     sortPer += m
      mvts.push({
        date_operation: dop,
        libelle:        String(o.libelle ?? ""),
        type:           o.type,
        categorie:      (o.categorie as { libelle?: string } | null)?.libelle ?? null,
        montant:        m,
        solde_cumule:   0,   // calculé après
      })
    }

    // 3c. Tri (déjà fait par .order(), mais on garantit) + calcul solde cumulé
    mvts.sort((a, b2) => {
      if (a.date_operation !== b2.date_operation) return a.date_operation < b2.date_operation ? -1 : 1
      return 0
    })
    let cumul = soldeInit
    for (const m of mvts) {
      cumul += m.type === "entree" ? m.montant : -m.montant
      m.solde_cumule = cumul
    }
    const soldeFin = soldeInit + entrPer - sortPer

    contenants.push({
      id:               b.id,
      libelle:          b.libelle,
      code:             b.code,
      type_cible:       b.type_cible,
      sous_type:        b.sous_type,
      operateur_banque: b.operateur_banque,
      syscohada_code:   b.syscohada_code,
      syscohada_libelle: b.syscohada_code ? (codeLibelle.get(b.syscohada_code) ?? null) : null,
      solde_initial:    soldeInit,
      solde_final:      soldeFin,
      total_entrees:    entrPer,
      total_sorties:    sortPer,
      mouvements:       mvts,
    })

    totalInit += soldeInit
    totalFin  += soldeFin
    totalEnt  += entrPer
    totalSor  += sortPer
  }

  // 4. Tri : caisses avant comptes, puis alpha
  contenants.sort((a, b) => {
    if (a.type_cible !== b.type_cible) return a.type_cible === "caisse" ? -1 : 1
    return a.libelle.localeCompare(b.libelle, "fr")
  })

  return {
    date_from:     dateFrom,
    date_to:       dateTo,
    contenants,
    total_initial: totalInit,
    total_final:   totalFin,
    total_entrees: totalEnt,
    total_sorties: totalSor,
  }
}
