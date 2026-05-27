/**
 * Builder de la Balance des comptes (Phase 4 §4.2).
 *
 * Pour chaque compte SYSCOHADA utilisé sur la période :
 *   - total débit, total crédit
 *   - solde débiteur (si débit > crédit) OU solde créditeur (si crédit > débit)
 *
 * Regroupement par classe avec sous-totaux par classe + ligne TOTAL GÉNÉRAL
 * + vérification d'équilibre (Σ débits doit égaler Σ crédits).
 */

import { buildGrandLivre } from "@/lib/compta/exports/buildGrandLivre"

export interface BalanceLigne {
  code:           string
  libelle:        string
  classe:         number
  ordre:          number
  total_debit:    number
  total_credit:   number
  solde_debiteur: number   // 0 si solde créditeur
  solde_crediteur: number  // 0 si solde débiteur
}

export interface BalanceClasse {
  classe:                number
  comptes:               BalanceLigne[]
  total_debit:           number
  total_credit:          number
  total_solde_debiteur:  number
  total_solde_crediteur: number
}

export interface BalanceData {
  date_from:             string
  date_to:               string
  classes:               BalanceClasse[]
  total_debit:           number
  total_credit:          number
  total_solde_debiteur:  number
  total_solde_crediteur: number
  equilibree:            boolean
  ecart:                 number  // |total_debit - total_credit|
}

export async function buildBalance(dateFrom: string, dateTo: string): Promise<BalanceData> {
  // Réutilise le Grand Livre pour les agrégats par compte
  const gl = await buildGrandLivre(dateFrom, dateTo)

  // Mappe en lignes Balance
  const lignes: BalanceLigne[] = gl.comptes.map(c => {
    const solde = c.total_debit - c.total_credit
    return {
      code:            c.code,
      libelle:         c.libelle,
      classe:          c.classe,
      ordre:           c.ordre,
      total_debit:     c.total_debit,
      total_credit:    c.total_credit,
      solde_debiteur:  solde > 0 ? solde : 0,
      solde_crediteur: solde < 0 ? -solde : 0,
    }
  })

  // Regroupement par classe
  const byClasse = new Map<number, BalanceClasse>()
  for (const l of lignes) {
    let bucket = byClasse.get(l.classe)
    if (!bucket) {
      bucket = {
        classe:                l.classe,
        comptes:               [],
        total_debit:           0,
        total_credit:          0,
        total_solde_debiteur:  0,
        total_solde_crediteur: 0,
      }
      byClasse.set(l.classe, bucket)
    }
    bucket.comptes.push(l)
    bucket.total_debit           += l.total_debit
    bucket.total_credit          += l.total_credit
    bucket.total_solde_debiteur  += l.solde_debiteur
    bucket.total_solde_crediteur += l.solde_crediteur
  }

  const classes = Array.from(byClasse.values()).sort((a, b) => a.classe - b.classe)

  const ecart = Math.abs(gl.total_debit - gl.total_credit)
  return {
    date_from:             dateFrom,
    date_to:               dateTo,
    classes,
    total_debit:           gl.total_debit,
    total_credit:          gl.total_credit,
    total_solde_debiteur:  classes.reduce((s, c) => s + c.total_solde_debiteur,  0),
    total_solde_crediteur: classes.reduce((s, c) => s + c.total_solde_crediteur, 0),
    equilibree:            ecart < 0.5,    // tolérance demi-franc
    ecart,
  }
}
