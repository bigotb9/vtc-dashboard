"use client"

/**
 * Ligne d'anomalie (Écran 8 §3.2-3.4) — affichée dans HealthAnomaliesTable.
 *
 * Selon le type, propose :
 *  - Bouton "Voir" → navigate vers la ressource (op, écriture, …)
 *  - Bouton "Corriger" → ouvre HealthFixModal (uniquement si fixable + fix_endpoint)
 *  - Bouton "Modifier" → navigate vers la page edit (mapping manquant)
 */

import Link from "next/link"
import { Eye, Wrench, Pencil } from "lucide-react"
import type { HealthAnomaly } from "@/types/compta-ui"

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR")
const fmtDate = (s: string | null | undefined) => {
  if (!s) return null
  const d = new Date(s.length === 10 ? s + "T00:00:00" : s)
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
    : s
}

type Props = {
  anomaly:   HealthAnomaly
  onFix?:    (a: HealthAnomaly) => void
}

export function HealthAnomalyRow({ anomaly, onFix }: Props) {
  const type = anomaly.type

  // ─── Compose le href "voir" selon le type ─────────────────────────────────
  let viewHref: string | null = null
  if (type === "op_sans_ecriture" || type === "doublon_potentiel") {
    viewHref = `/comptabilite/operations/${anomaly.id}`
  } else if (type === "ecriture_sans_op" || type === "ecriture_desequilibree" || type === "doublon_numero") {
    // Pas de page écriture standalone — on linke à la liste des opérations
    viewHref = `/comptabilite/operations`
  } else if (type === "caisse_sans_mapping" || type === "compte_sans_mapping") {
    viewHref = `/comptabilite/comptes-caisses/${anomaly.id}`
  } else if (type === "categorie_sans_mapping") {
    viewHref = `/comptabilite/categories/${anomaly.id}`
  }

  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 items-center px-3 py-2.5 rounded-lg bg-gray-50/60 dark:bg-white/[0.02] border border-gray-200/60 dark:border-white/[0.05]">
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold text-gray-900 dark:text-white truncate">
          {anomaly.libelle}
        </p>
        <p className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
          {/* Métadonnées variables selon le type */}
          {anomaly.numero && (
            <span className="font-mono bg-gray-100 dark:bg-white/[0.05] px-1 py-px rounded mr-1.5">
              {anomaly.numero}
            </span>
          )}
          {anomaly.code && (
            <span className="font-mono bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1 py-px rounded mr-1.5">
              {anomaly.code}
            </span>
          )}
          {anomaly.date_operation && (
            <span className="tabular-nums mr-1.5">{fmtDate(anomaly.date_operation)}</span>
          )}
          {anomaly.date_ecriture && (
            <span className="tabular-nums mr-1.5">{fmtDate(anomaly.date_ecriture)}</span>
          )}
          {anomaly.caisse_libelle && (
            <span className="italic mr-1.5">{anomaly.caisse_libelle}</span>
          )}
          {anomaly.montant != null && (
            <span className="font-mono tabular-nums mr-1.5">{fmt(anomaly.montant)} F</span>
          )}
          {anomaly.ecart != null && (
            <span className="font-mono tabular-nums text-red-600 dark:text-red-400 mr-1.5">
              Δ {fmt(Math.abs(anomaly.ecart))} F
            </span>
          )}
          {anomaly.nb_doublons && (
            <span className="font-bold text-amber-600 dark:text-amber-400">
              ×{anomaly.nb_doublons}
            </span>
          )}
        </p>
        {anomaly.raison && (
          <p className="text-[10px] text-gray-400 dark:text-gray-500 italic mt-0.5 truncate">
            {anomaly.raison}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {viewHref && (
          <Link
            href={viewHref}
            title="Voir le détail"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-gray-500 hover:text-violet-500 hover:bg-violet-500/10 transition"
          >
            <Eye size={13} />
          </Link>
        )}
        {anomaly.fix_path && (
          <Link
            href={anomaly.fix_path}
            title="Modifier"
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/15 transition"
          >
            <Pencil size={11} />
            Modifier
          </Link>
        )}
        {anomaly.fixable && anomaly.fix_endpoint && onFix && (
          <button
            type="button"
            onClick={() => onFix(anomaly)}
            title="Corriger automatiquement"
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-sm shadow-emerald-500/30 transition"
          >
            <Wrench size={11} />
            Corriger
          </button>
        )}
      </div>
    </div>
  )
}
