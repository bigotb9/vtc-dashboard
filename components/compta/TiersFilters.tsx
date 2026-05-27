"use client"

/**
 * Barre de filtres pour la page /comptabilite/tiers (Phase 4.x Vague 2 §3.2).
 *
 * - Tabs : Tous / Clients / Fournisseurs / Salariés / Autres
 * - Recherche multicolonne (debouncée)
 * - Toggle Actifs uniquement
 */

import { useEffect, useState } from "react"
import { Search, X } from "lucide-react"
import type { TiersType } from "@/types/compta-ui"

type TabKey = "tout" | TiersType
type Tab = { key: TabKey; label: string }
const TABS: Tab[] = [
  { key: "tout",        label: "Tous"         },
  { key: "client",      label: "Clients"      },
  { key: "fournisseur", label: "Fournisseurs" },
  { key: "salarie",     label: "Salariés"     },
  { key: "autre",       label: "Autres"       },
]

type Props = {
  type:        TabKey
  q:           string
  actifsOnly:  boolean
  onTypeChange:  (t: TabKey) => void
  onSearchChange: (s: string) => void
  onActifsToggle: (b: boolean) => void
  onReset?: () => void
}

export function TiersFilters({ type, q, actifsOnly, onTypeChange, onSearchChange, onActifsToggle, onReset }: Props) {
  const [draft, setDraft] = useState(q)
  useEffect(() => { setDraft(q) }, [q])
  // Debounce 200ms sur la recherche
  useEffect(() => {
    const id = setTimeout(() => {
      if (draft !== q) onSearchChange(draft)
    }, 200)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  const hasFilter = type !== "tout" || !!q.trim() || !actifsOnly

  return (
    <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Tabs */}
        <div className="inline-flex bg-gray-100 dark:bg-white/[0.04] rounded-lg p-1">
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => onTypeChange(t.key)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                type === t.key
                  ? "bg-white dark:bg-white/[0.08] text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Recherche */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Nom, téléphone, RCCM, contribuable…"
            className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/60 transition"
          />
          {draft && (
            <button
              type="button"
              onClick={() => { setDraft(""); onSearchChange("") }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              title="Effacer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Toggle actifs */}
        <label className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer select-none text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={actifsOnly}
            onChange={e => onActifsToggle(e.target.checked)}
            className="rounded border-gray-300 text-indigo-500 focus:ring-indigo-500/40"
          />
          Actifs uniquement
        </label>

        {/* Reset */}
        {hasFilter && onReset && (
          <button
            type="button"
            onClick={onReset}
            className="ml-auto text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Réinitialiser
          </button>
        )}
      </div>
    </div>
  )
}
