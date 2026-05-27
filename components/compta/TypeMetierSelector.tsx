"use client"

/**
 * Sélecteur de type métier — liste verrouillée sur les 10 types valides
 * du CHECK constraint (recette, depense, apport, reversement, avance,
 * investissement, remboursement, dotation, transfert, autre).
 *
 * Charge les types via GET /api/compta/categories/types-distincts qui
 * renvoie les types + leurs counts. Affiche le count à droite pour aider
 * à choisir.
 *
 * Référence : doc Phase 3 Écran 6 §4.3.
 */

import { useEffect, useId, useState } from "react"
import { Tag } from "lucide-react"
import { authFetch } from "@/lib/authFetch"
import type { TypeMetierItem } from "@/types/compta-ui"

type Props = {
  value:     string
  onChange:  (next: string) => void
  error?:    string | null
  required?: boolean
}

/** Labels lisibles pour les 10 types. */
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

export function TypeMetierSelector({ value, onChange, error, required }: Props) {
  const id = useId()
  const [types, setTypes] = useState<TypeMetierItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    authFetch("/api/compta/categories/types-distincts")
      .then(r => r.json())
      .then(j => {
        if (cancelled) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const list = ((j?.data ?? []) as any[]).map(t => ({
          type:    String(t.type),
          count:   Number(t.count ?? 0),
          allowed: t.allowed !== false,
        }))
        setTypes(list)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div>
      <label htmlFor={id} className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em] mb-1.5">
        Type métier {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <Tag size={14} />
        </span>
        <select
          id={id}
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={loading}
          className={`w-full rounded-xl border bg-white dark:bg-white/[0.02] pl-9 pr-3 py-2.5 text-sm text-gray-900 dark:text-white transition focus:outline-none focus:ring-2 focus:ring-violet-500/30 cursor-pointer ${
            error
              ? "border-red-400 dark:border-red-500/50"
              : "border-gray-200/70 dark:border-white/[0.08] hover:border-violet-300 dark:hover:border-violet-500/30 focus:border-violet-400"
          } disabled:opacity-50`}
        >
          <option value="">— Sélectionner un type —</option>
          {types.map(t => (
            <option key={t.type} value={t.type} disabled={!t.allowed}>
              {TYPE_LABEL[t.type] ?? t.type}
              {t.count > 0 ? ` (${t.count})` : ""}
              {!t.allowed ? " [non autorisé]" : ""}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500 leading-snug">
        Catégorise l&apos;opération métier. Les types disponibles sont fixés par le schéma comptable.
      </p>
      {error && <p className="mt-1 text-[11px] font-semibold text-red-500">{error}</p>}
    </div>
  )
}
