/**
 * Utilitaire d'export CSV côté client (Écran 10 §5.3).
 *
 * Génère un Blob CSV avec BOM UTF-8 (pour Excel) et déclenche le
 * téléchargement via un <a download>. Les cellules sont quote-escaped.
 */

import type { PlanCompteRow } from "@/types/compta-ui"

/** Quote une cellule pour CSV : double les " et entoure de " si nécessaire. */
function quoteCell(v: unknown): string {
  const s = String(v ?? "")
  return `"${s.replace(/"/g, '""')}"`
}

function rowsToCsv(rows: (string | number)[][]): string {
  return rows.map(r => r.map(quoteCell).join(",")).join("\r\n")
}

/** Déclenche un téléchargement CSV depuis le navigateur. */
export function downloadCsv(filename: string, csvContent: string) {
  // BOM UTF-8 pour qu'Excel reconnaisse l'encodage (accents OK)
  const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Libérer l'URL après un délai pour laisser le temps au browser de l'utiliser
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Export du plan comptable au format CSV (Écran 10). */
export function exportPlanComptableCsv(comptes: PlanCompteRow[]) {
  const header = [
    "Code", "Libellé", "Classe", "Parent", "Type",
    "Nb caisses", "Nb comptes", "Nb catégories", "Total usage",
  ]
  const rows: (string | number)[][] = [
    header,
    ...comptes.map(c => [
      c.code,
      c.libelle,
      c.classe,
      c.parent ?? "",
      c.type_compte ?? "",
      c.nb_caisses,
      c.nb_comptes,
      c.nb_categories,
      c.total_usage,
    ]),
  ]
  const csv = rowsToCsv(rows)
  const today = new Date().toISOString().slice(0, 10)
  downloadCsv(`plan-comptable-fleet-boyah-${today}.csv`, csv)
}
