"use client"

/**
 * Card "Informations" du détail (Écran 5 §3.5). Métadonnées en grille 2 cols.
 */

import { Info } from "lucide-react"
import type { ComptesCaissesDetail } from "@/types/compta-ui"

const fmtDate = (s: string | null) => {
  if (!s) return "—"
  const d = new Date(s.length === 10 ? s + "T00:00:00" : s)
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
    : s
}

type Props = {
  detail: ComptesCaissesDetail
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

export function CompteCaisseInfos({ detail }: Props) {
  return (
    <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-500 flex items-center justify-center shadow-md shadow-cyan-500/30 flex-shrink-0">
          <Info size={16} className="text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Informations</h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Métadonnées</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        <Row label="Libellé"><span className="font-semibold">{detail.libelle}</span></Row>
        <Row label="Code interne">
          {detail.code ? (
            <span className="font-mono text-[11.5px] bg-gray-100 dark:bg-white/[0.05] px-2 py-0.5 rounded">{detail.code}</span>
          ) : <span className="text-gray-400">—</span>}
        </Row>

        <Row label="Type">
          {detail.type_cible === "caisse" ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block px-1.5 py-px rounded text-[9.5px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                Caisse
              </span>
              {detail.type && <span className="text-[12px] text-gray-500 dark:text-gray-400">{detail.type === "cash" ? "Cash" : "Mobile money"}</span>}
              {detail.operateur && <span className="text-[12px] text-gray-500 dark:text-gray-400 italic">· {detail.operateur}</span>}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block px-1.5 py-px rounded text-[9.5px] font-bold uppercase tracking-wider bg-violet-500/10 text-violet-600 dark:text-violet-400">
                Compte bancaire
              </span>
              {detail.banque && <span className="text-[12px] text-gray-500 dark:text-gray-400">· {detail.banque}</span>}
            </span>
          )}
        </Row>

        <Row label="Devise">
          <span className="font-mono text-[11.5px] bg-gray-100 dark:bg-white/[0.05] px-2 py-0.5 rounded">{detail.devise}</span>
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

        <Row label="Numéro">
          {detail.numero ? (
            <span className="font-mono text-[12px]">{detail.numero}</span>
          ) : <span className="text-gray-400">—</span>}
        </Row>

        <Row label="Première opération">
          <span className="tabular-nums">{fmtDate(detail.premiere_op)}</span>
        </Row>

        <Row label="Date de création">
          <span className="tabular-nums">{fmtDate(detail.created_at)}</span>
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
