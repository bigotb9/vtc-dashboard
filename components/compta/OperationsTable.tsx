"use client"

/**
 * Tableau principal des opérations comptables.
 * Référence : doc Phase 3 Écran 1 §5.
 *
 * Colonnes : Date / Type / Libellé / Montant / Caisse / Source / Statut / Actions
 * Responsive :
 *   - Desktop ≥ 1024px : 8 colonnes
 *   - Tablet 768-1024px : 5 colonnes (Date/Libellé/Montant/Source/Actions)
 *   - Mobile < 768px    : cards empilées
 */

"use client"

import Link from "next/link"
import { ArrowDownToLine, ArrowUpFromLine, Eye, ChevronUp, ChevronDown, FileText } from "lucide-react"
import { motion } from "framer-motion"
import type { OperationView, OperationsFilters } from "@/types/compta-ui"
import { CaisseCell } from "./CaisseCell"
import { SourceBadge } from "./SourceBadge"
import { OperationStatusBadge } from "./OperationStatusBadge"

type SortCol = NonNullable<OperationsFilters["sort_by"]>

type Props = {
  rows:       OperationView[]
  loading:    boolean
  total:      number
  sortBy:     SortCol
  sortOrder:  "asc" | "desc"
  onSortChange: (col: SortCol) => void
}

const fmtDate = (s: string) => {
  const d = new Date(s + "T00:00:00")
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" })
}
const fmtMontant = (n: number) => Math.round(n).toLocaleString("fr-FR")

// ─── Header tri ──────────────────────────────────────────────────────────────

function ThSortable({
  label, col, sortBy, sortOrder, onSortChange, align = "left", className,
}: {
  label: string
  col:   SortCol
  sortBy: SortCol
  sortOrder: "asc" | "desc"
  onSortChange: (col: SortCol) => void
  align?: "left" | "right"
  className?: string
}) {
  const active = sortBy === col
  return (
    <th className={`text-${align === "right" ? "right" : "left"} px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 select-none ${className ?? ""}`}>
      <button
        onClick={() => onSortChange(col)}
        className={`inline-flex items-center gap-1 hover:text-gray-800 dark:hover:text-gray-200 transition ${active ? "text-violet-600 dark:text-violet-400" : ""}`}
      >
        {label}
        {active && (sortOrder === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
      </button>
    </th>
  )
}

function Th({ label, align = "left", className }: { label: string; align?: "left" | "right" | "center"; className?: string }) {
  return (
    <th className={`text-${align} px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 ${className ?? ""}`}>
      {label}
    </th>
  )
}

// ─── Skeleton + Empty state ─────────────────────────────────────────────────

function SkeletonRow({ idx }: { idx: number }) {
  return (
    <tr className="border-b border-gray-100 dark:border-white/[0.04]">
      {Array.from({ length: 9 }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div
            className="h-4 rounded bg-gray-200/70 dark:bg-white/[0.04] animate-pulse"
            style={{ width: `${60 + ((idx + i) % 4) * 12}%` }}
          />
        </td>
      ))}
    </tr>
  )
}

function EmptyState() {
  return (
    <div className="py-16 text-center">
      <FileText size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Aucune opération trouvée</p>
      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Essaye d&apos;ajuster les filtres pour voir des résultats.</p>
    </div>
  )
}

// ─── Composant principal ────────────────────────────────────────────────────

export function OperationsTable({ rows, loading, sortBy, sortOrder, onSortChange }: Props) {
  return (
    <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] overflow-hidden">

      {/* DESKTOP TABLE (lg+) */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50/70 dark:bg-white/[0.02] border-b border-gray-200/70 dark:border-white/[0.05]">
            <tr>
              <ThSortable label="Date"    col="date_operation" sortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange} className="w-[10%]" />
              <Th        label="Type"    align="center" className="w-[6%]" />
              <ThSortable label="Libellé" col="libelle"        sortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange} className="w-[24%]" />
              <ThSortable label="Montant" col="montant"        sortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange} align="right" className="w-[12%]" />
              <Th        label="Caisse"  className="w-[12%]" />
              {/* Phase 4.x Vague 2 correctif §2.2 — colonne Tiers */}
              <Th        label="Tiers"   className="w-[14%]" />
              <Th        label="Source"  className="w-[10%]" />
              <Th        label="Statut"  className="w-[8%]" />
              <Th        label=""        align="center" className="w-[4%]" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} idx={i} />)
            ) : rows.length === 0 ? (
              <tr><td colSpan={9}><EmptyState /></td></tr>
            ) : (
              rows.map((op, i) => (
                <motion.tr
                  key={op.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: i * 0.012 }}
                  className="border-b border-gray-100 dark:border-white/[0.04] hover:bg-gray-50/60 dark:hover:bg-white/[0.02] transition"
                >
                  <td className="px-3 py-2.5 font-mono text-xs text-gray-700 dark:text-gray-300 tabular-nums">
                    {fmtDate(op.date_operation)}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-flex w-7 h-7 rounded-md items-center justify-center ${
                      op.type === "entree"
                        ? "bg-emerald-500/10 text-emerald-500"
                        : "bg-red-400/10 text-red-400"
                    }`}>
                      {op.type === "entree"
                        ? <ArrowDownToLine size={14} strokeWidth={2.5} />
                        : <ArrowUpFromLine size={14} strokeWidth={2.5} />}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={op.libelle}>
                      {op.libelle}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-500 mt-0.5 truncate">
                      {op.vehicule?.immatriculation && <span>véh. {op.vehicule.immatriculation}</span>}
                      {op.vehicule?.immatriculation && op.categorie?.libelle && <span> · </span>}
                      {op.categorie?.libelle}
                    </div>
                  </td>
                  <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${
                    op.type === "entree"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-500 dark:text-red-400"
                  }`}>
                    {op.type === "entree" ? "+" : "−"}{fmtMontant(op.montant)}
                    <span className="text-[10px] font-normal text-gray-400 dark:text-gray-600 ml-1">F</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <CaisseCell caisse={op.caisse ?? null} fallback={op.compte?.libelle ?? "—"} />
                  </td>
                  {/* Phase 4.x Vague 2 correctif §2.2 — colonne Tiers */}
                  <td className="px-3 py-2.5">
                    {op.tiers ? (
                      <Link
                        href={`/comptabilite/tiers/${op.tiers.id}`}
                        onClick={e => e.stopPropagation()}
                        className="block hover:opacity-80 transition"
                        title={`Voir la fiche ${op.tiers.nom}`}
                      >
                        <div className="text-[12.5px] font-semibold text-gray-800 dark:text-gray-100 truncate max-w-[140px]">
                          {op.tiers.nom}
                        </div>
                        <div className="text-[10px] font-mono text-violet-600 dark:text-violet-400 tabular-nums truncate">
                          {op.tiers.compte_syscohada_code}
                        </div>
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <SourceBadge
                      source={op.source}
                      caisseCode={op.caisse?.code ?? null}
                      caisseLibelle={op.caisse?.libelle ?? null}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <OperationStatusBadge statut={op.statut} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Link
                      href={`/comptabilite/operations/${op.id}`}
                      title="Voir le détail"
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-gray-500 hover:text-violet-500 hover:bg-violet-500/10 transition"
                    >
                      <Eye size={14} />
                    </Link>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* TABLET TABLE (md, < lg) — 5 colonnes */}
      <div className="hidden md:block lg:hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50/70 dark:bg-white/[0.02] border-b border-gray-200/70 dark:border-white/[0.05]">
            <tr>
              <ThSortable label="Date"    col="date_operation" sortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange} className="w-[14%]" />
              <ThSortable label="Libellé" col="libelle"        sortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange} className="w-[44%]" />
              <ThSortable label="Montant" col="montant"        sortBy={sortBy} sortOrder={sortOrder} onSortChange={onSortChange} align="right" className="w-[18%]" />
              <Th        label="Source"  className="w-[18%]" />
              <Th        label=""        align="center" className="w-[6%]" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-white/[0.04]">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-3 py-3">
                      <div className="h-4 rounded bg-gray-200/70 dark:bg-white/[0.04] animate-pulse" style={{ width: "70%" }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={5}><EmptyState /></td></tr>
            ) : (
              rows.map(op => (
                <tr key={op.id} className="border-b border-gray-100 dark:border-white/[0.04] hover:bg-gray-50/60 dark:hover:bg-white/[0.02]">
                  <td className="px-3 py-2.5 font-mono text-xs text-gray-700 dark:text-gray-300 tabular-nums">{fmtDate(op.date_operation)}</td>
                  <td className="px-3 py-2.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex w-6 h-6 rounded-md items-center justify-center flex-shrink-0 ${
                        op.type === "entree" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-400/10 text-red-400"
                      }`}>
                        {op.type === "entree" ? <ArrowDownToLine size={12} /> : <ArrowUpFromLine size={12} />}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{op.libelle}</div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-500 truncate">
                          {op.vehicule?.immatriculation ?? op.categorie?.libelle ?? ""}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${op.type === "entree" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                    {op.type === "entree" ? "+" : "−"}{fmtMontant(op.montant)}<span className="text-[10px] font-normal text-gray-400 ml-1">F</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <SourceBadge source={op.source} caisseCode={op.caisse?.code ?? null} caisseLibelle={op.caisse?.libelle ?? null} />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Link href={`/comptabilite/operations/${op.id}`} className="inline-flex items-center justify-center w-7 h-7 rounded-md text-gray-500 hover:text-violet-500 hover:bg-violet-500/10">
                      <Eye size={14} />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MOBILE CARDS (< md) */}
      <div className="md:hidden divide-y divide-gray-100 dark:divide-white/[0.04]">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-4 animate-pulse space-y-2">
              <div className="h-3 w-24 rounded bg-gray-200/70 dark:bg-white/[0.04]" />
              <div className="h-4 w-3/4 rounded bg-gray-200/70 dark:bg-white/[0.04]" />
              <div className="h-3 w-1/2 rounded bg-gray-200/70 dark:bg-white/[0.04]" />
            </div>
          ))
        ) : rows.length === 0 ? (
          <EmptyState />
        ) : (
          rows.map(op => (
            <Link
              key={op.id}
              href={`/comptabilite/operations/${op.id}`}
              className="block p-4 active:bg-gray-100 dark:active:bg-white/[0.04] transition"
            >
              <div className="flex items-start gap-3">
                <span className={`inline-flex w-8 h-8 rounded-lg items-center justify-center flex-shrink-0 ${
                  op.type === "entree" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-400/10 text-red-400"
                }`}>
                  {op.type === "entree" ? <ArrowDownToLine size={14} /> : <ArrowUpFromLine size={14} />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">{fmtDate(op.date_operation)}</span>
                    <span className={`font-bold text-sm tabular-nums ${op.type === "entree" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                      {op.type === "entree" ? "+" : "−"}{fmtMontant(op.montant)}<span className="text-[9px] font-normal text-gray-400 ml-0.5">F</span>
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate mt-0.5">{op.libelle}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <CaisseCell caisse={op.caisse ?? null} fallback={op.compte?.libelle ?? "—"} />
                    <OperationStatusBadge statut={op.statut} />
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
