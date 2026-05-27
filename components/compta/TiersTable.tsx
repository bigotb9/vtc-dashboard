"use client"

/**
 * Tableau des tiers (Phase 4.x Vague 2 §3.2).
 *
 * Colonnes : Nom · Type · Contact · Code SYSCOHADA · Flux 2026.
 * Click ligne → /tiers/[id].
 */

import { useRouter } from "next/navigation"
import { Phone, Mail } from "lucide-react"
import { TiersTypeBadge } from "@/components/compta/TiersTypeBadge"
import type { TiersListItem } from "@/types/compta-ui"

function formatF(n: number): string {
  const abs = Math.abs(n)
  return Math.round(abs).toLocaleString("fr-FR").replace(/ | /g, " ")
}

type Props = {
  rows:    TiersListItem[]
  loading: boolean
}

export function TiersTable({ rows, loading }: Props) {
  const router = useRouter()
  if (loading && rows.length === 0) {
    return (
      <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-3 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-gray-100 dark:bg-white/[0.04] animate-pulse" />
        ))}
      </div>
    )
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 dark:border-white/[0.08] p-10 text-center text-sm text-gray-500 dark:text-gray-400">
        Aucun tiers ne correspond aux filtres.
      </div>
    )
  }
  return (
    <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-white/[0.03] text-[10.5px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          <tr>
            <th className="text-left  px-3 py-2.5">Nom</th>
            <th className="text-left  px-3 py-2.5 w-[120px]">Type</th>
            <th className="text-left  px-3 py-2.5">Contact</th>
            <th className="text-left  px-3 py-2.5 w-[110px]">SYSCOHADA</th>
            <th className="text-right px-3 py-2.5 w-[160px]">Flux {new Date().getFullYear()}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-white/[0.04]">
          {rows.map(r => {
            const flux = r.total_flux_signe
            const fluxColor = flux > 0
              ? "text-emerald-600 dark:text-emerald-400"
              : flux < 0
                ? "text-red-600 dark:text-red-400"
                : "text-gray-400"
            const fluxLabel = flux === 0
              ? "—"
              : `${flux > 0 ? "+" : "−"}${formatF(flux)} F`
            return (
              <tr
                key={r.id}
                onClick={() => router.push(`/comptabilite/tiers/${r.id}`)}
                className={`cursor-pointer hover:bg-indigo-500/5 dark:hover:bg-indigo-500/10 transition ${!r.actif ? "opacity-50" : ""}`}
              >
                <td className="px-3 py-2.5">
                  <div className="font-bold text-gray-900 dark:text-white truncate max-w-[260px]">
                    {r.nom}
                  </div>
                  {r.numero_rccm && (
                    <div className="text-[11px] font-mono text-gray-400 truncate">RCCM {r.numero_rccm}</div>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <TiersTypeBadge type={r.type} size="xs" />
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400 max-w-[200px]">
                  {r.telephone && (
                    <span className="inline-flex items-center gap-1 truncate">
                      <Phone size={10} /> <span className="font-mono">{r.telephone}</span>
                    </span>
                  )}
                  {r.email && !r.telephone && (
                    <span className="inline-flex items-center gap-1 truncate">
                      <Mail size={10} /> {r.email}
                    </span>
                  )}
                  {!r.telephone && !r.email && "—"}
                </td>
                <td className="px-3 py-2.5">
                  <span className="inline-block font-mono font-bold text-[11.5px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-700 dark:text-violet-300">
                    {r.compte_syscohada_code}
                  </span>
                </td>
                <td className={`px-3 py-2.5 text-right font-mono tabular-nums font-bold ${fluxColor}`}>
                  {fluxLabel}
                  {r.nb_operations > 0 && (
                    <div className="text-[10px] font-normal text-gray-400 mt-px">
                      {r.nb_operations} op{r.nb_operations > 1 ? "s" : ""}
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
