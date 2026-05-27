/**
 * Builder du Grand Livre (Phase 4 §4.1) — refactoré avec JOIN Supabase.
 *
 * Pour la période [date_from, date_to], collecte toutes les lignes
 * d'écritures valides, les groupe par compte SYSCOHADA, et calcule par compte :
 *   - total débit, total crédit
 *   - solde = débit - crédit
 *   - nature : débiteur (solde > 0) / créditeur (solde < 0) / soldé (0)
 *
 * Comptes triés par classe puis ordre puis code. Au sein d'un compte,
 * écritures triées par date_ecriture puis numéro.
 *
 * ─── Correctif HeadersOverflowError ─────────────────────────────────────
 * Avant : 2 requêtes (écritures puis lignes via `.in('ecriture_id', [477
 * UUIDs])`). Sur ~500 écritures, l'URL Supabase REST faisait ~18 KB et
 * dépassait la limite HTTP de 16 KB → erreur 500 sur la preview.
 *
 * Après : 1 SEULE requête avec JOIN déclaratif Supabase
 * (`lignes_ecritures (...)` dans le SELECT). Le JOIN est exécuté côté
 * PostgreSQL, retourne écritures + lignes embarquées, plus de `.in()` à
 * 477 UUIDs. Scalable à 10k+ écritures sans risque d'overflow.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"

export interface GrandLivreLigne {
  date_ecriture: string
  numero:        string
  journal_code:  string | null
  libelle:       string  // libellé écriture (top-level)
  libelle_ligne: string | null
  debit:         number
  credit:        number
}

export interface GrandLivreCompte {
  code:         string
  libelle:      string
  classe:       number
  ordre:        number
  lignes:       GrandLivreLigne[]
  total_debit:  number
  total_credit: number
  solde:        number   // débit - crédit
  nature:       "debiteur" | "crediteur" | "solde"
}

export interface GrandLivreData {
  date_from:    string
  date_to:      string
  comptes:      GrandLivreCompte[]
  /** Totaux globaux (utile pour le pied de page). */
  total_debit:  number
  total_credit: number
}

/** Mouvement plat : 1 ligne d'écriture enrichie du contexte écriture. */
type Mouvement = {
  ecriture_id:           string
  date_ecriture:         string
  numero:                string
  journal_code:          string | null
  libelle_ecriture:      string
  ordre_ligne:           number
  compte_syscohada_code: string
  libelle_ligne:         string | null
  debit:                 number
  credit:                number
}

/**
 * Charge écritures + lignes en UNE seule requête via JOIN déclaratif Supabase.
 * Plus de `.in(ecriture_id, [N UUIDs])` qui faisait sauter les headers HTTP.
 */
async function fetchMouvements(dateFrom: string, dateTo: string): Promise<Mouvement[]> {
  const { data, error } = await supabaseAdmin
    .from("ecritures_comptables")
    .select(`
      id, numero, date_ecriture, journal_code, libelle, statut,
      lignes_ecritures (
        id, ordre, compte_syscohada_code, libelle, debit, credit
      )
    `)
    .eq("statut", "valide")
    .gte("date_ecriture", dateFrom)
    .lte("date_ecriture", dateTo)
    .order("date_ecriture", { ascending: true })
    .order("numero",        { ascending: true })
  if (error) throw error

  const out: Mouvement[] = []
  for (const ec of (data ?? [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lignes = (ec.lignes_ecritures ?? []) as any[]
    for (const li of lignes) {
      if (!li.compte_syscohada_code) continue
      out.push({
        ecriture_id:           String(ec.id),
        date_ecriture:         String(ec.date_ecriture),
        numero:                String(ec.numero),
        journal_code:          ec.journal_code ?? null,
        libelle_ecriture:      String(ec.libelle ?? ""),
        ordre_ligne:           Number(li.ordre ?? 0),
        compte_syscohada_code: String(li.compte_syscohada_code),
        libelle_ligne:         li.libelle ?? null,
        debit:                 Number(li.debit  ?? 0),
        credit:                Number(li.credit ?? 0),
      })
    }
  }
  return out
}

export async function buildGrandLivre(dateFrom: string, dateTo: string): Promise<GrandLivreData> {
  const mouvements = await fetchMouvements(dateFrom, dateTo)

  // 1. Récupérer les meta SYSCOHADA des comptes utilisés.
  //    Sur ~500 écritures Boyah, ~12 codes distincts max → `.in()` ici est
  //    parfaitement safe (URL ~400 chars).
  const codesUniques = Array.from(new Set(mouvements.map(m => m.compte_syscohada_code)))
  const sysMap = new Map<string, { libelle: string; classe: number; ordre: number }>()
  if (codesUniques.length > 0) {
    const { data: sys, error: sysErr } = await supabaseAdmin
      .from("comptes_syscohada")
      .select("code, libelle, classe, ordre")
      .in("code", codesUniques)
    if (sysErr) throw sysErr
    for (const c of sys ?? []) {
      sysMap.set(c.code, {
        libelle: c.libelle,
        classe:  c.classe,
        ordre:   c.ordre ?? 0,
      })
    }
  }

  // 2. Grouper par compte SYSCOHADA
  const comptesByCode = new Map<string, GrandLivreCompte>()
  for (const m of mouvements) {
    let bucket = comptesByCode.get(m.compte_syscohada_code)
    if (!bucket) {
      const meta = sysMap.get(m.compte_syscohada_code) ?? { libelle: "?", classe: 0, ordre: 0 }
      bucket = {
        code:         m.compte_syscohada_code,
        libelle:      meta.libelle,
        classe:       meta.classe,
        ordre:        meta.ordre,
        lignes:       [],
        total_debit:  0,
        total_credit: 0,
        solde:        0,
        nature:       "solde",
      }
      comptesByCode.set(m.compte_syscohada_code, bucket)
    }
    bucket.lignes.push({
      date_ecriture: m.date_ecriture,
      numero:        m.numero,
      journal_code:  m.journal_code,
      libelle:       m.libelle_ecriture,
      libelle_ligne: m.libelle_ligne,
      debit:         m.debit,
      credit:        m.credit,
    })
    bucket.total_debit  += m.debit
    bucket.total_credit += m.credit
  }

  // 3. Finaliser : solde + nature, tri intra-compte
  let totalDebit  = 0
  let totalCredit = 0
  for (const b of comptesByCode.values()) {
    b.solde = b.total_debit - b.total_credit
    b.nature = b.solde > 0 ? "debiteur" : b.solde < 0 ? "crediteur" : "solde"
    b.lignes.sort((a, b2) => {
      if (a.date_ecriture !== b2.date_ecriture) return a.date_ecriture < b2.date_ecriture ? -1 : 1
      return a.numero < b2.numero ? -1 : 1
    })
    totalDebit  += b.total_debit
    totalCredit += b.total_credit
  }

  // 4. Tri par classe → ordre → code
  const comptes = Array.from(comptesByCode.values()).sort((a, b) => {
    if (a.classe !== b.classe) return a.classe - b.classe
    if (a.ordre  !== b.ordre)  return a.ordre  - b.ordre
    return a.code < b.code ? -1 : 1
  })

  return {
    date_from:    dateFrom,
    date_to:      dateTo,
    comptes,
    total_debit:  totalDebit,
    total_credit: totalCredit,
  }
}
