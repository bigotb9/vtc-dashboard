"use client"

/**
 * Card "Informations" du détail catégorie (Écran 6 §3.4).
 * Métadonnées en grille 2 colonnes.
 */

import { Info, AlertTriangle } from "lucide-react"
import type { CategorieDetail } from "@/types/compta-ui"

const TYPE_LABEL: Record<string, string> = {
  recette:        "Recette",
  depense:        "Dépense",
  apport:         "Apport",
  reversement:    "Reversement",
  avance:         "Avance",
  investissement: "Investissement",
  remboursement:  "Remboursement",
  dotation:       "Dotation",
  transfert:      "Transfert",
  autre:          "Autre",
}

const fmtDate = (s: string | null) => {
  if (!s) return "—"
  const d = new Date(s.length === 10 ? s + "T00:00:00" : s)
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
    : s
}

type Props = {
  detail: CategorieDetail
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9.5px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em] mb-1">
        {label}
      </p>
      <div className="text-[13px] text-gray-900 dark:text-white">{children}</div>
    </div>
  )
}

export function CategorieInfos({ detail }: Props) {
  return (
    <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-500 flex items-center justify-center shadow-md shadow-cyan-500/30 flex-shrink-0">
          <Info size={16} className="text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Informations</h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Métadonnées comptables</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        <Row label="Libellé"><span className="font-semibold">{detail.libelle}</span></Row>
        <Row label="Type métier">
          <span className="inline-block px-1.5 py-px rounded text-[10px] font-bold uppercase tracking-wider bg-violet-500/10 text-violet-600 dark:text-violet-400">
            {TYPE_LABEL[detail.type] ?? detail.type}
          </span>
        </Row>

        <Row label="Sens comptable">
          {detail.sens ? (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
              detail.sens === "credit"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-red-500/10 text-red-600 dark:text-red-400"
            }`}>
              {detail.sens === "credit" ? "Crédit (Entrée)" : "Débit (Sortie)"}
            </span>
          ) : (
            <span className="text-amber-500 text-[12px] inline-flex items-center gap-1">
              <AlertTriangle size={11} /> Non défini
            </span>
          )}
        </Row>

        <Row label="Classe SYSCOHADA">
          {detail.compte_syscohada_classe != null ? (
            <span className="font-mono text-[11.5px] bg-gray-100 dark:bg-white/[0.05] px-2 py-0.5 rounded">
              Classe {detail.compte_syscohada_classe}
            </span>
          ) : <span className="text-gray-400">—</span>}
        </Row>

        <Row label="Compte SYSCOHADA">
          {detail.compte_syscohada_code ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="font-mono text-[11px] bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded font-bold">
                {detail.compte_syscohada_code}
              </span>
              <span className="text-[12px] text-gray-500 dark:text-gray-400 truncate">
                {detail.compte_syscohada_libelle ?? "—"}
              </span>
            </span>
          ) : <span className="text-amber-500 text-[12px]">Non mappé</span>}
        </Row>

        <Row label="Journal par défaut">
          {detail.journal_par_defaut ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="font-mono text-[11px] bg-gray-100 dark:bg-white/[0.05] px-1.5 py-0.5 rounded font-bold">
                {detail.journal_par_defaut}
              </span>
              {detail.journal_libelle && (
                <span className="text-[12px] text-gray-500 dark:text-gray-400">{detail.journal_libelle}</span>
              )}
            </span>
          ) : <span className="text-gray-400">—</span>}
        </Row>

        <Row label="Date de création">
          <span className="tabular-nums">{fmtDate(detail.created_at)}</span>
        </Row>

        <Row label="Statut">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
            detail.actif
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20"
              : "bg-gray-200 dark:bg-white/[0.08] text-gray-600 dark:text-gray-400"
          }`}>
            {detail.actif ? "Actif" : "Inactif"}
          </span>
        </Row>

        {detail.description && (
          <div className="md:col-span-2">
            <p className="text-[9.5px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em] mb-1">
              Description
            </p>
            <p className="text-[12.5px] text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
              {detail.description}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
