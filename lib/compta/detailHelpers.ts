/**
 * Helper partagé pour les endpoints détail caisse/compte (Écran 5 Phase 3).
 *
 * Construit un payload riche :
 *   - meta complet (libellé, code, type_cible, mapping SYSCOHADA, actif, …)
 *   - solde courant (cumul depuis solde_initial)
 *   - KPIs 12 mois (entrées, sorties)
 *   - evolution_solde_12_mois : série mensuelle DU SOLDE CUMULÉ, incluant
 *     le solde initial du début de période (résout l'AVERTISSEMENT du doc §3.4)
 *   - 5 dernières opérations
 *
 * À utiliser uniquement côté serveur (supabaseAdmin, bypass RLS).
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"

export type CaisseCompteDetailKind = "caisse" | "compte"

export interface CaisseCompteDetail {
  id:                       string
  libelle:                  string
  code:                     string | null
  type_cible:               CaisseCompteDetailKind
  /** Sous-type des caisses (cash/mobile_money). null pour les comptes. */
  type:                     string | null
  /** Opérateur des caisses mobile_money (wave/orange/mtn/…). null sinon. */
  operateur:                string | null
  /** Banque pour les comptes bancaires. null pour les caisses. */
  banque:                   string | null
  numero:                   string | null
  compte_syscohada_code:    string | null
  compte_syscohada_libelle: string | null
  actif:                    boolean
  devise:                   string
  description:              string | null
  solde_initial:            number
  date_solde_initial:       string | null
  created_at:               string | null
  archive_le:               string | null

  /** Solde courant tous temps confondus. */
  solde:                    number
  nb_mouvements:            number
  premiere_op:              string | null
  derniere_op:              string | null

  /** Cumuls sur les 12 derniers mois. */
  entrees_12_mois:          number
  sorties_12_mois:          number

  /** Série mensuelle du solde cumulé (12 points + le mois courant inclus). */
  evolution_solde_12_mois:  { mois: string; solde: number }[]

  /** 5 dernières opérations validées sur ce contenant. */
  dernieres_operations: {
    id:               string
    date_operation:   string
    libelle:          string
    type:             "entree" | "sortie"
    montant:          number
    journal_code:     string | null
    ecriture_id:      string | null
    vehicule_id:      number | null
    chauffeur_id:     number | null
    categorie_libelle: string | null
  }[]
}

/** Helper bas niveau : pagine toutes les ops valides d'une cible. */
async function fetchAllValidOps(
  kind:    CaisseCompteDetailKind,
  id:      string,
  fields:  string,
)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
: Promise<any[]> {
  const col = kind === "caisse" ? "caisse_id" : "compte_id"
  const PAGE = 5000
  const out: Record<string, unknown>[] = []
  let from = 0
  while (from < 1_000_000) {
    const { data, error } = await supabaseAdmin
      .from("operations")
      .select(fields)
      .eq(col, id)
      .eq("statut", "valide")
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    out.push(...(data as unknown as Record<string, unknown>[]))
    if (data.length < PAGE) break
    from += PAGE
  }
  return out
}

/** Helper interne : "YYYY-MM" pour un mois donné. */
function ym(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export async function buildCaisseCompteDetail(
  args: { kind: CaisseCompteDetailKind; id: string },
): Promise<CaisseCompteDetail | null> {
  const { kind, id } = args

  // ─── 1. Charger la ligne maître ────────────────────────────────────────────
  // Caisses & comptes ont des schémas légèrement différents. On charge tous
  // les champs communs + le mapping SYSCOHADA libellé.
  if (kind === "caisse") {
    const { data, error } = await supabaseAdmin
      .from("caisses")
      .select(`
        id, libelle, code, type, operateur, numero,
        solde_initial, date_solde_initial,
        compte_syscohada_code, actif, description, created_at, archive_le,
        compte_syscohada:compte_syscohada_code ( libelle )
      `)
      .eq("id", id)
      .maybeSingle()
    if (error) throw error
    if (!data)  return null

    const base = {
      id:                       String(data.id),
      libelle:                  data.libelle,
      code:                     data.code ?? null,
      type_cible:               "caisse" as const,
      type:                     data.type ?? null,
      operateur:                data.operateur ?? null,
      banque:                   null,
      numero:                   data.numero ?? null,
      compte_syscohada_code:    data.compte_syscohada_code ?? null,
      compte_syscohada_libelle: (data.compte_syscohada as { libelle?: string } | null)?.libelle ?? null,
      actif:                    !!data.actif,
      devise:                   "XOF",
      description:              data.description ?? null,
      solde_initial:            Number(data.solde_initial ?? 0),
      date_solde_initial:       data.date_solde_initial ?? null,
      created_at:               data.created_at ?? null,
      archive_le:               data.archive_le ?? null,
    }
    return enrich(base, "caisse", id)
  } else {
    const { data, error } = await supabaseAdmin
      .from("comptes")
      .select(`
        id, libelle, code, banque, numero_compte, devise,
        solde_initial, date_solde_initial,
        compte_syscohada_code, actif, description, created_at, archive_le,
        compte_syscohada:compte_syscohada_code ( libelle )
      `)
      .eq("id", id)
      .maybeSingle()
    if (error) throw error
    if (!data)  return null

    const base = {
      id:                       String(data.id),
      libelle:                  data.libelle,
      code:                     data.code ?? null,
      type_cible:               "compte" as const,
      type:                     null,
      operateur:                null,
      banque:                   data.banque ?? null,
      numero:                   data.numero_compte ?? null,
      compte_syscohada_code:    data.compte_syscohada_code ?? null,
      compte_syscohada_libelle: (data.compte_syscohada as { libelle?: string } | null)?.libelle ?? null,
      actif:                    !!data.actif,
      devise:                   data.devise ?? "XOF",
      description:              data.description ?? null,
      solde_initial:            Number(data.solde_initial ?? 0),
      date_solde_initial:       data.date_solde_initial ?? null,
      created_at:               data.created_at ?? null,
      archive_le:               data.archive_le ?? null,
    }
    return enrich(base, "compte", id)
  }
}

/** Fusionne le base meta avec les agrégats (solde, 12 mois, dernières ops). */
async function enrich(
  base:   Omit<CaisseCompteDetail, "solde" | "nb_mouvements" | "premiere_op" | "derniere_op" | "entrees_12_mois" | "sorties_12_mois" | "evolution_solde_12_mois" | "dernieres_operations">,
  kind:   CaisseCompteDetailKind,
  id:     string,
): Promise<CaisseCompteDetail> {
  // ─── 2. Charger toutes les ops valides ────────────────────────────────────
  // Pour les agrégats : besoin du delta cumulé total + détails 12 mois.
  const allOps = await fetchAllValidOps(kind, id, "type, montant, date_operation")
  let total_entrees = 0
  let total_sorties = 0
  let nb_mvt        = 0
  let premiere_op: string | null = null
  let derniere_op: string | null = null
  for (const op of allOps) {
    nb_mvt++
    const m = Number(op.montant || 0)
    if (op.type === "entree")      total_entrees += m
    else if (op.type === "sortie") total_sorties += m
    const dop = String(op.date_operation)
    if (!premiere_op || dop < premiere_op) premiere_op = dop
    if (!derniere_op || dop > derniere_op) derniere_op = dop
  }
  const solde = base.solde_initial + total_entrees - total_sorties

  // ─── 3. Série 12 mois (DOC §3.4 — solde_initial = solde au début de période)
  const today = new Date()
  const labels: string[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    labels.push(ym(d))
  }
  const periodStart = `${labels[0]}-01`

  // Solde au début de la période = solde_initial caisse + Σ(deltas avant periodStart)
  let soldeStartPeriod = base.solde_initial
  // Deltas 12 mois par mois + cumul stricts >= periodStart
  const deltasParMois = new Map<string, number>()
  for (const op of allOps) {
    const dop = String(op.date_operation)
    const delta = op.type === "entree" ? Number(op.montant) : -Number(op.montant)
    if (dop < periodStart) {
      soldeStartPeriod += delta
    } else {
      const key = dop.slice(0, 7)
      deltasParMois.set(key, (deltasParMois.get(key) ?? 0) + delta)
    }
  }

  // Calcul entrées/sorties 12 mois (toutes les ops >= periodStart)
  let entrees_12_mois = 0
  let sorties_12_mois = 0
  for (const op of allOps) {
    if (String(op.date_operation) < periodStart) continue
    const m = Number(op.montant || 0)
    if (op.type === "entree")      entrees_12_mois += m
    else if (op.type === "sortie") sorties_12_mois += m
  }

  // Empile mois par mois en partant de soldeStartPeriod
  const evolution_solde_12_mois: { mois: string; solde: number }[] = []
  let solde_courant_cumule = soldeStartPeriod
  for (const mois of labels) {
    solde_courant_cumule += deltasParMois.get(mois) ?? 0
    evolution_solde_12_mois.push({ mois, solde: solde_courant_cumule })
  }

  // ─── 4. 5 dernières opérations ────────────────────────────────────────────
  const col = kind === "caisse" ? "caisse_id" : "compte_id"
  const { data: lastOpsRaw } = await supabaseAdmin
    .from("operations")
    .select(`
      id, date_operation, libelle, type, montant,
      categorie_id, ecriture_id, vehicule_id, chauffeur_id,
      categorie:categorie_id ( libelle ),
      ecriture:ecriture_id ( journal_code )
    `)
    .eq(col, id)
    .eq("statut", "valide")
    .order("date_operation", { ascending: false })
    .order("created_at",     { ascending: false })
    .limit(5)

  const dernieres_operations: CaisseCompteDetail["dernieres_operations"] = (lastOpsRaw ?? []).map(o => ({
    id:               String(o.id),
    date_operation:   o.date_operation,
    libelle:          o.libelle,
    type:             o.type as "entree" | "sortie",
    montant:          Number(o.montant),
    journal_code:     (o.ecriture as { journal_code?: string } | null)?.journal_code ?? null,
    ecriture_id:      o.ecriture_id,
    vehicule_id:      o.vehicule_id ?? null,
    chauffeur_id:     o.chauffeur_id ?? null,
    categorie_libelle: (o.categorie as { libelle?: string } | null)?.libelle ?? null,
  }))

  return {
    ...base,
    solde,
    nb_mouvements:           nb_mvt,
    premiere_op,
    derniere_op,
    entrees_12_mois,
    sorties_12_mois,
    evolution_solde_12_mois,
    dernieres_operations,
  }
}
