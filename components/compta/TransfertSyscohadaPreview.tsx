"use client"

/**
 * Preview de l'écriture SYSCOHADA du transfert interne (Phase 4.x Vague 1 §3.4).
 *
 * Style aligné sur le PDF Grand Livre : Georgia serif + Courier mono numérique,
 * fond papier crème, bandeau "Écriture <numero> · <date>", tableau Code/Libellé/
 * Débit/Crédit + ligne Total + badge "Équilibrée".
 *
 * Utilisé en mode "live" : le composant reçoit la `preview` calculée serveur
 * (TransfertPreview) ou null pendant le loading.
 */

import { Loader2 } from "lucide-react"
import type { TransfertPreview } from "@/types/compta-ui"

function formatF(n: number): string {
  return Math.round(n).toLocaleString("fr-FR").replace(/ | /g, " ")
}

function formatDateFr(iso: string): string {
  // iso = YYYY-MM-DD → DD/MM/YYYY
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

type Props = {
  preview: TransfertPreview | null
  loading?: boolean
  error?:   string | null
}

export function TransfertSyscohadaPreview({ preview, loading, error }: Props) {
  if (loading && !preview) {
    return (
      <div className="rounded-xl bg-[#FAFAF8] dark:bg-[#1A1B25] border border-gray-200 dark:border-white/[0.08] p-6 flex items-center justify-center gap-3 text-gray-500 dark:text-gray-400">
        <Loader2 className="animate-spin" size={16} />
        <span className="text-sm">Calcul de l&apos;écriture…</span>
      </div>
    )
  }
  if (error) {
    return (
      <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-700 dark:text-red-300">
        {error}
      </div>
    )
  }
  if (!preview) return null

  const dateFr = formatDateFr(preview.date_ecriture)

  return (
    <div
      className="rounded-xl border border-gray-200 dark:border-white/[0.08] overflow-hidden shadow-sm"
      style={{ fontFamily: "Georgia, serif", background: "#FAFAF8" }}
    >
      {/* Header bandeau */}
      <div
        className="px-4 py-2.5 text-white"
        style={{ background: "#1F4E79" }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] opacity-80">
              Aperçu écriture
            </div>
            <div className="text-base font-bold tabular-nums">
              {preview.numero_ecriture_futur} <span className="opacity-70">·</span> {dateFr}
            </div>
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] opacity-80">
            Journal OD
          </div>
        </div>
        <div className="mt-1 text-[12px] italic opacity-95 truncate">
          {preview.libelle}
        </div>
      </div>

      {/* Table partie double */}
      <table className="w-full text-[12.5px]" style={{ color: "#1F2937" }}>
        <thead>
          <tr style={{ background: "#F2EEDF", color: "#1F4E79" }}>
            <th className="text-left  font-bold px-3 py-1.5 w-[14%]">Code</th>
            <th className="text-left  font-bold px-3 py-1.5">Libellé</th>
            <th className="text-right font-bold px-3 py-1.5 w-[18%]">Débit</th>
            <th className="text-right font-bold px-3 py-1.5 w-[18%]">Crédit</th>
          </tr>
        </thead>
        <tbody>
          {preview.lignes.map((l, i) => (
            <tr key={i} className="border-t" style={{ borderColor: "#E7E2D2" }}>
              <td className="px-3 py-1.5 font-mono">{l.compte_code}</td>
              <td className="px-3 py-1.5">{l.libelle}</td>
              <td className="px-3 py-1.5 text-right font-mono tabular-nums" style={{ color: l.debit > 0 ? "#1F4E79" : "#9CA3AF" }}>
                {l.debit > 0 ? formatF(l.debit) : "—"}
              </td>
              <td className="px-3 py-1.5 text-right font-mono tabular-nums" style={{ color: l.credit > 0 ? "#9C2D14" : "#9CA3AF" }}>
                {l.credit > 0 ? formatF(l.credit) : "—"}
              </td>
            </tr>
          ))}
          <tr className="border-t-2" style={{ borderColor: "#1F4E79", background: "#F2EEDF" }}>
            <td className="px-3 py-1.5 font-bold" style={{ color: "#1F4E79" }} colSpan={2}>Total</td>
            <td className="px-3 py-1.5 text-right font-bold font-mono tabular-nums" style={{ color: "#1F4E79" }}>
              {formatF(preview.total_debit)}
            </td>
            <td className="px-3 py-1.5 text-right font-bold font-mono tabular-nums" style={{ color: "#1F4E79" }}>
              {formatF(preview.total_credit)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Bandeau équilibre */}
      <div
        className="px-4 py-2 flex items-center gap-2 text-[12px] font-semibold"
        style={{
          background: preview.equilibre ? "#DCFCE7" : "#FEE2E2",
          color:      preview.equilibre ? "#166534" : "#991B1B",
        }}
      >
        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full" style={{ background: preview.equilibre ? "#16A34A" : "#DC2626", color: "white" }}>
          {preview.equilibre ? "✓" : "!"}
        </span>
        {preview.equilibre
          ? "Équilibrée — au franc près"
          : "Déséquilibrée — vérifiez le montant"}
      </div>
    </div>
  )
}
