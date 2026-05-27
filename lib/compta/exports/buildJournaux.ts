/**
 * Builder du PDF Journaux (Phase 4 §4.3).
 *
 * Vue chronologique des écritures groupées par préfixe de journal
 * (VE, OD, CA, BQ, AC, PA, etc.). Pour chaque groupe :
 *   - Tableau Date · N° · Compte · Libellé compte · Libellé écriture · Débit · Crédit
 *   - Sous-total par journal
 *
 * Filtre `journaux` : liste de préfixes à inclure (ex. ["VE", "OD"]). Vide
 * ou ["all"] → tous les journaux présents sur la période.
 *
 * Utilise le JOIN Supabase déclaratif (cf. correctif HeadersOverflowError).
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"

export interface JournauxLigne {
  date_ecriture:  string
  numero:         string
  compte_code:    string
  compte_libelle: string
  libelle_ec:     string   // libellé écriture
  libelle_ln:     string | null  // libellé ligne (si différent)
  debit:          number
  credit:         number
}

export interface JournauxGroup {
  journal_code:    string
  journal_libelle: string
  lignes:          JournauxLigne[]
  total_debit:     number
  total_credit:    number
}

export interface JournauxData {
  date_from:    string
  date_to:      string
  groups:       JournauxGroup[]
  total_debit:  number
  total_credit: number
}

const JOURNAL_LIBELLE: Record<string, string> = {
  VE: "Journal des Ventes",
  AC: "Journal des Achats",
  CA: "Journal de Caisse",
  BQ: "Journal de Banque",
  OD: "Journal des Opérations Diverses",
  PA: "Journal de Paie",
}

export interface BuildJournauxOptions {
  /** Filtre : liste de préfixes journaux à inclure (ex. ["VE","OD"]).
   *  Vide ou contient "all" → tous. */
  journaux?: string[]
}

export async function buildJournaux(
  dateFrom: string,
  dateTo:   string,
  opts:     BuildJournauxOptions = {},
): Promise<JournauxData> {
  // 1. Fetch écritures + lignes en un seul JOIN
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

  // 2. Optionnel : filtre par préfixe
  const filterRaw = (opts.journaux ?? []).map(s => s.trim()).filter(Boolean)
  const filterAll = filterRaw.length === 0 || filterRaw.includes("all")
  const wanted = new Set(filterAll ? [] : filterRaw)

  // 3. Collecter les codes SYSCOHADA utilisés pour récupérer les libellés
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allLignes: any[] = []
  for (const ec of data ?? []) {
    if (!filterAll && (!ec.journal_code || !wanted.has(ec.journal_code))) continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const li of (ec.lignes_ecritures ?? []) as any[]) {
      allLignes.push({ ec, li })
    }
  }
  const codes = Array.from(new Set(allLignes.map(x => x.li.compte_syscohada_code).filter(Boolean)))
  const codeLibelle = new Map<string, string>()
  if (codes.length > 0) {
    const { data: sys } = await supabaseAdmin
      .from("comptes_syscohada")
      .select("code, libelle")
      .in("code", codes)
    for (const c of sys ?? []) codeLibelle.set(c.code, c.libelle)
  }

  // 4. Grouper par journal_code
  const byJournal = new Map<string, JournauxGroup>()
  let totalDebitG  = 0
  let totalCreditG = 0

  for (const { ec, li } of allLignes) {
    const jc = (ec.journal_code as string) ?? "—"
    let g = byJournal.get(jc)
    if (!g) {
      g = {
        journal_code:    jc,
        journal_libelle: JOURNAL_LIBELLE[jc] ?? `Journal ${jc}`,
        lignes:          [],
        total_debit:     0,
        total_credit:    0,
      }
      byJournal.set(jc, g)
    }
    const debit  = Number(li.debit  ?? 0)
    const credit = Number(li.credit ?? 0)
    g.lignes.push({
      date_ecriture:  String(ec.date_ecriture),
      numero:         String(ec.numero),
      compte_code:    String(li.compte_syscohada_code ?? ""),
      compte_libelle: codeLibelle.get(li.compte_syscohada_code) ?? "",
      libelle_ec:     String(ec.libelle ?? ""),
      libelle_ln:     li.libelle ?? null,
      debit,
      credit,
    })
    g.total_debit  += debit
    g.total_credit += credit
    totalDebitG    += debit
    totalCreditG   += credit
  }

  // 5. Tri intra-groupe (déjà date → numero via le SELECT, mais on re-trie pour safety)
  for (const g of byJournal.values()) {
    g.lignes.sort((a, b) => {
      if (a.date_ecriture !== b.date_ecriture) return a.date_ecriture < b.date_ecriture ? -1 : 1
      if (a.numero        !== b.numero)        return a.numero        < b.numero        ? -1 : 1
      return 0
    })
  }

  // 6. Tri des groupes par code journal (ordre alpha standard : AC, BQ, CA, OD, PA, VE)
  const groups = Array.from(byJournal.values()).sort((a, b) => a.journal_code < b.journal_code ? -1 : 1)

  return {
    date_from:    dateFrom,
    date_to:      dateTo,
    groups,
    total_debit:  totalDebitG,
    total_credit: totalCreditG,
  }
}
