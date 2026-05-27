"use client"

/**
 * Card "Métadonnées" — Écran 2 Phase 3 §3.5.
 *
 * UUID, créateur, validateur, source_ref, pièces jointes. Repliable.
 * Pour les utilisateurs métier ce n'est pas essentiel, donc on commence
 * en collapsed.
 */

import { useState } from "react"
import { Cog, ChevronDown, Copy, Check as CheckIcon } from "lucide-react"
import type { OperationDetail } from "@/types/compta-ui"

const fmtDateTime = (s: string | null) => {
  if (!s) return "—"
  const d = new Date(s)
  return Number.isNaN(d.getTime())
    ? s
    : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
       + " · "
       + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

type Props = { operation: OperationDetail }

export function MetadonneesCard({ operation }: Props) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const copyId = (val: string, label: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(val).then(() => {
        setCopied(label)
        setTimeout(() => setCopied(null), 1200)
      }).catch(() => {})
    }
  }

  return (
    <div className="relative rounded-2xl overflow-hidden bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition"
      >
        <div className="flex items-center gap-2.5">
          <span className="inline-flex w-8 h-8 rounded-lg items-center justify-center bg-gray-500/10 text-gray-500">
            <Cog size={16} strokeWidth={2.5} />
          </span>
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 tracking-tight">
            Détails techniques
          </h3>
        </div>
        <ChevronDown
          size={16}
          className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 border-t border-gray-100 dark:border-white/[0.04]">
          <Field label="ID opération">
            <div className="flex items-center gap-2 min-w-0">
              <code className="text-[11px] font-mono text-gray-700 dark:text-gray-300 truncate min-w-0">{operation.id}</code>
              <button
                type="button"
                onClick={() => copyId(operation.id, "id")}
                title="Copier l'ID"
                className="flex-shrink-0 p-1 rounded-md text-gray-400 hover:text-violet-500 hover:bg-violet-500/10 transition"
              >
                {copied === "id" ? <CheckIcon size={11} className="text-emerald-500" /> : <Copy size={11} />}
              </button>
            </div>
          </Field>

          <Field label="source_ref">
            <code className="text-[11px] font-mono text-gray-700 dark:text-gray-300 break-all">
              {operation.source_ref ?? "—"}
            </code>
          </Field>

          <Field label="Créée par">
            <span className="text-sm text-gray-900 dark:text-gray-100">
              {operation.created_by_name ?? "—"}
            </span>
            {operation.created_at && (
              <p className="text-[11px] text-gray-500 dark:text-gray-500 tabular-nums mt-0.5">
                {fmtDateTime(operation.created_at)}
              </p>
            )}
          </Field>

          <Field label="Validée par">
            <span className="text-sm text-gray-900 dark:text-gray-100">
              {operation.valide_par_name ?? (operation.valide_le ? "Auto-validation" : "—")}
            </span>
            {operation.valide_le && (
              <p className="text-[11px] text-gray-500 dark:text-gray-500 tabular-nums mt-0.5">
                {fmtDateTime(operation.valide_le)}
              </p>
            )}
          </Field>

          <Field label="Référence externe">
            <code className="text-[11px] font-mono text-gray-700 dark:text-gray-300">
              {operation.reference_externe ?? "—"}
            </code>
          </Field>

          <Field label="Pièces jointes">
            <span className="text-sm text-gray-500 dark:text-gray-500 italic">
              Aucune (Phase 4)
            </span>
          </Field>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
