"use client"

/**
 * Card "Informations de l'opération" — Écran 2 Phase 3 §3.1.
 * Liseré supérieur vert si entrée, rouge si sortie.
 * 6 champs en grille 2 colonnes : Montant / Date / Caisse / Catégorie / Source / Exercice.
 */

import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react"
import { CaisseCell } from "./CaisseCell"
import type { OperationDetail } from "@/types/compta-ui"

const fmtMontant = (n: number) => Math.round(n).toLocaleString("fr-FR")
const fmtDate    = (s: string) => {
  const d = new Date(s + "T00:00:00")
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

type Props = { operation: OperationDetail }

export function OperationInfoCard({ operation }: Props) {
  const isEntree = operation.type === "entree"
  const accent   = isEntree
    ? "from-transparent via-emerald-500 to-transparent"
    : "from-transparent via-red-400 to-transparent"
  const iconBg   = isEntree ? "bg-emerald-500/10 text-emerald-500" : "bg-red-400/10 text-red-400"
  const montantColor = isEntree
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-500 dark:text-red-400"
  const Icon = isEntree ? ArrowDownToLine : ArrowUpFromLine

  return (
    <div className="relative rounded-2xl overflow-hidden bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] shadow-sm">
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${accent}`} />

      {/* Header card */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/[0.04]">
        <div className="flex items-center gap-2.5">
          <span className={`inline-flex w-8 h-8 rounded-lg items-center justify-center ${iconBg}`}>
            <Icon size={16} strokeWidth={2.5} />
          </span>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            Informations de l&apos;opération
          </h3>
        </div>
        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
          isEntree
            ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20"
            : "bg-red-400/12 text-red-700 dark:text-red-300 ring-1 ring-red-400/20"
        }`}>
          {isEntree ? "Entrée" : "Sortie"}
        </span>
      </div>

      {/* Contenu — grille 2 colonnes */}
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
        <Field label="Montant">
          <div className={`font-black tracking-tight text-2xl tabular-nums ${montantColor}`}>
            {isEntree ? "+" : "−"}{fmtMontant(operation.montant)}
            <span className="text-sm font-semibold text-gray-400 dark:text-gray-600 ml-1">FCFA</span>
          </div>
        </Field>

        <Field label="Date opération">
          <span className="font-mono text-sm text-gray-900 dark:text-gray-100 tabular-nums">
            {fmtDate(operation.date_operation)}
          </span>
        </Field>

        <Field label="Caisse">
          {operation.caisse
            ? <CaisseCell caisse={operation.caisse} />
            : <span className="text-sm text-gray-500 dark:text-gray-400">{operation.compte?.libelle ?? "—"}</span>}
        </Field>

        <Field label="Catégorie">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {operation.categorie?.libelle ?? "—"}
          </span>
        </Field>

        <Field label="Source">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {operation.source_label}
          </span>
        </Field>

        <Field label="Exercice">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {operation.exercice?.libelle ?? "—"}
          </span>
        </Field>

        {/* Libellé full width, en bas */}
        <div className="sm:col-span-2 pt-2 border-t border-gray-100 dark:border-white/[0.04]">
          <Field label="Libellé">
            <span className="text-sm text-gray-900 dark:text-gray-100">{operation.libelle}</span>
          </Field>
          {operation.notes && (
            <div className="mt-3">
              <Field label="Notes">
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{operation.notes}</p>
              </Field>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">{label}</p>
      <div>{children}</div>
    </div>
  )
}
