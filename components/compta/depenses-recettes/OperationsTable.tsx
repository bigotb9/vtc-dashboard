"use client"

/**
 * Table paginée des opérations (Phase 4.x Vague 3.5 §2.2.6).
 *
 * Colonnes : Date · Libellé+sous-info · Catégorie badge · Caisse · Source · Montant.
 * Tri colonne (date_op / montant). Click ligne → /comptabilite/operations/[id].
 */

import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "lucide-react"
import { formatMontantFull } from "@/lib/compta/formatMontantCompact"
import type { FlowFilters, FlowKind, FlowOperationItem } from "@/types/compta-ui"

function formatDateFr(iso: string): string {
  const d = new Date(iso + "T00:00:00Z")
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
}

// Mapping badge catégorie (cf. spec §2.2.6)
function badgeForOperation(op: FlowOperationItem): { label: string; bg: string; color: string } {
  if (op.source === "depense_vehicule") {
    const lib = (op.categorie?.libelle ?? "").toUpperCase()
    let label = "VÉHICULE"
    if (/pneu/i.test(lib))                  label = "PNEUS"
    else if (/carbur|essence|gasoil/i.test(lib))  label = "CARBURANT"
    else if (/vidang/i.test(lib))           label = "VIDANGE"
    else if (/entretien/i.test(lib))        label = "ENTRETIEN"
    return { label, bg: "rgba(245,158,11,0.15)", color: "#FCD34D" }
  }
  if (op.source === "recette_wave")
    return { label: "VERSEMENT", bg: "rgba(6,182,212,0.15)", color: "#67E8F9" }
  if (op.source === "versement_client")
    return { label: "REVERSEMENT", bg: "rgba(16,185,129,0.15)", color: "#34D399" }
  if (op.source === "transfert_interne")
    return { label: "TRANSFERT", bg: "rgba(255,255,255,0.05)", color: "#9CA3AF" }
  // Heuristique catégorie pour les saisies manuelles
  const cat = (op.categorie?.libelle ?? "").toUpperCase()
  if (/salaire/i.test(cat))   return { label: "SALAIRE", bg: "rgba(139,92,246,0.15)", color: "#A78BFA" }
  if (/apport/i.test(cat))    return { label: "APPORT",  bg: "rgba(99,102,241,0.15)", color: "#818CF8" }
  if (op.source === "manuel") return { label: "MANUEL",  bg: "rgba(139,92,246,0.15)", color: "#A78BFA" }
  if (op.source === "dotation_amort") return { label: "DOTATION", bg: "rgba(168,85,247,0.15)", color: "#C084FC" }
  return { label: (op.categorie?.libelle ?? "—").toUpperCase().slice(0, 14),
           bg: "rgba(255,255,255,0.06)", color: "#9CA3AF" }
}

type Props = {
  kind:         FlowKind
  rows:         FlowOperationItem[]
  total:        number
  filters:      FlowFilters
  loading:      boolean
  loadingMore:  boolean
  onPageChange: (page: number) => void
  onSortChange: (col: "date_op" | "montant") => void
}

export function OperationsTable({
  kind, rows, total, filters, loading, loadingMore, onPageChange, onSortChange,
}: Props) {
  const router = useRouter()
  const pageSize    = filters.page_size ?? 20
  const currentPage = filters.page ?? 1
  const totalPages  = Math.max(1, Math.ceil(total / pageSize))
  const accent      = kind === "depenses" ? "#F87171" : "#34D399"
  const sign        = kind === "depenses" ? "−" : "+"

  if (loading && rows.length === 0) {
    return (
      <div className="rounded-xl border border-[#1E2D45] bg-[#0D1424] p-3 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-[#1A2235] animate-pulse" />
        ))}
      </div>
    )
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#1E2D45] bg-[#0D1424] p-10 text-center text-sm text-gray-400">
        Aucune opération sur cette période.
        <div className="mt-3">
          <a href={kind === "depenses" ? "/depenses/create" : "/comptabilite/operations/nouveau?type=entree"}
             className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
             style={{ background: `linear-gradient(to right, ${accent}, ${kind === "depenses" ? "#E11D48" : "#059669"})` }}>
            + Ajouter une {kind === "depenses" ? "dépense" : "recette"}
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#1E2D45] bg-[#0D1424] overflow-hidden">
      <div className={`overflow-x-auto transition-opacity ${loadingMore ? "opacity-50" : ""}`}>
        <table className="w-full text-sm">
          <thead className="bg-[#1A2235] text-[10.5px] font-bold uppercase tracking-wider text-gray-400">
            <tr>
              <Th onClick={() => onSortChange("date_op")}
                  active={filters.sort_by === "date_op"}
                  order={filters.sort_order ?? "desc"}>
                Date
              </Th>
              <th className="text-left px-3 py-2.5">Libellé</th>
              <th className="text-left px-3 py-2.5 w-[120px]">Catégorie</th>
              <th className="text-left px-3 py-2.5 w-[140px]">Caisse</th>
              <th className="text-left px-3 py-2.5 w-[110px]">Source</th>
              <Th onClick={() => onSortChange("montant")}
                  active={filters.sort_by === "montant"}
                  order={filters.sort_order ?? "desc"}
                  align="right">
                Montant
              </Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E2D45]/60">
            {rows.map(op => {
              const badge = badgeForOperation(op)
              const subInfo = [
                op.tiers?.nom,
                op.tiers?.compte_syscohada_code,
                op.vehicule?.immatriculation,
              ].filter(Boolean).join(" · ")
              return (
                <tr key={op.id}
                    onClick={() => router.push(`/comptabilite/operations/${op.id}`)}
                    className="cursor-pointer hover:bg-[#1A2235] transition">
                  <td className="px-3 py-2.5 text-xs text-gray-300 font-mono whitespace-nowrap">
                    {formatDateFr(op.date_op)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-bold text-white truncate max-w-[260px]">{op.libelle}</div>
                    {subInfo && (
                      <div className="text-[10.5px] text-violet-400 truncate max-w-[280px]">{subInfo}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider"
                          style={{ background: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-400 truncate max-w-[140px]">
                    {op.caisse?.libelle ?? "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono text-gray-400 bg-white/[0.04]">
                      {op.source}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums font-bold"
                      style={{ color: accent }}>
                    {sign}{formatMontantFull(op.montant)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-3 py-2.5 border-t border-[#1E2D45] text-[11px] text-gray-400">
        <div>
          Page <span className="font-bold text-gray-200 tabular-nums">{currentPage}</span> sur{" "}
          <span className="font-bold text-gray-200 tabular-nums">{totalPages}</span>
          {" · "}
          <span className="font-bold text-gray-200 tabular-nums">{total}</span>{" "}
          {kind === "depenses" ? "dépense" : "recette"}{total > 1 ? "s" : ""}
        </div>
        <div className="flex items-center gap-1">
          <PageBtn disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
            <ChevronLeft size={12} />
          </PageBtn>
          {pageNumbers(currentPage, totalPages).map((n, i) =>
            n === "…" ? (
              <span key={i} className="px-1 text-gray-500">…</span>
            ) : (
              <button key={i} type="button" onClick={() => onPageChange(n)}
                className={`w-7 h-7 rounded-md text-[11px] font-bold tabular-nums transition ${
                  n === currentPage
                    ? "bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40"
                    : "text-gray-400 hover:bg-[#1A2235] hover:text-gray-200"
                }`}>
                {n}
              </button>
            )
          )}
          <PageBtn disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
            <ChevronRight size={12} />
          </PageBtn>
        </div>
      </div>
    </div>
  )
}

function Th({ children, onClick, active, order, align = "left" }: {
  children: React.ReactNode; onClick: () => void; active: boolean; order: "asc"|"desc"; align?: "left"|"right"
}) {
  return (
    <th className={`px-3 py-2.5 select-none cursor-pointer ${align === "right" ? "text-right" : "text-left"}`} onClick={onClick}>
      <span className={`inline-flex items-center gap-1 ${active ? "text-gray-200" : "text-gray-400"} hover:text-gray-200`}>
        {children}
        {active && (order === "desc" ? <ArrowDown size={10} /> : <ArrowUp size={10} />)}
      </span>
    </th>
  )
}

function PageBtn({ children, onClick, disabled }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="w-7 h-7 rounded-md border border-[#1E2D45] text-gray-300 hover:bg-[#1A2235] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center transition">
      {children}
    </button>
  )
}

function pageNumbers(cur: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (cur <= 4)        return [1, 2, 3, 4, 5, "…", total]
  if (cur >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total]
  return [1, "…", cur - 1, cur, cur + 1, "…", total]
}
