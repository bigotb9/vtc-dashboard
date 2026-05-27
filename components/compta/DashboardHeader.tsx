"use client"

/**
 * Header du Dashboard comptable (Écran 3 Phase 3).
 *
 * Bloc titre + sous-titre + tab périodes + boutons actions.
 * Référence : doc Phase 3 Écran 3 §3.1.
 *
 * Phase 4 §3.6 : bouton "Exporter ce mois" → POST /api/compta/exports/rapport-mensuel
 * avec la période courante (mois civil en cours).
 */

import { LayoutDashboard, FileDown, ListChecks, Plus, Loader2 } from "lucide-react"
import Link from "next/link"
import type { PeriodKey } from "@/types/compta-ui"
import { useGenerateExport } from "@/hooks/compta/useGenerateExport"
import { toast } from "@/lib/toast"

type Tab = { key: PeriodKey; label: string }

const TABS: Tab[] = [
  { key: "ce_mois",   label: "Ce mois" },
  { key: "mois_prec", label: "Mois préc." },
  { key: "3_mois",    label: "3 mois" },
  { key: "tout",      label: "Tout" },
]

type Props = {
  /** Période actuellement active. */
  period:           PeriodKey
  /** Date du dernier rafraîchissement (ISO). Affichée en sous-titre. */
  lastRefreshIso?:  string | null
  /** Exercice courant (ex. "2026"). */
  exercice?:        string
  /** Callback de changement de tab période. */
  onPeriodChange:   (p: PeriodKey) => void
}

function currentMonthRange(): { date_from: string; date_to: string } {
  const d   = new Date()
  const y   = d.getFullYear()
  const m   = d.getMonth()
  const pad = (n: number) => String(n).padStart(2, "0")
  const last = new Date(y, m + 1, 0)
  return {
    date_from: `${y}-${pad(m + 1)}-01`,
    date_to:   `${y}-${pad(m + 1)}-${pad(last.getDate())}`,
  }
}

export function DashboardHeader({ period, lastRefreshIso, exercice = "2026", onPeriodChange }: Props) {
  const ts = lastRefreshIso
    ? new Date(lastRefreshIso).toLocaleString("fr-FR", {
        hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short",
      })
    : null

  const { generate, loading: exporting, currentType } = useGenerateExport()
  const exportingRapport = exporting && currentType === "rapport-mensuel"

  async function handleExport() {
    const r = currentMonthRange()
    const res = await generate("rapport-mensuel", { date_from: r.date_from, date_to: r.date_to })
    if (res.ok) toast.success("Rapport mensuel téléchargé")
    else        toast.error(res.error)
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30 flex-shrink-0">
          <LayoutDashboard size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-none">
            Tableau de bord
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
            Exercice {exercice}{ts && <> · maj {ts}</>}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex bg-gray-100 dark:bg-white/[0.04] rounded-lg p-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => onPeriodChange(t.key)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                period === t.key
                  ? "bg-white dark:bg-white/[0.08] text-violet-600 dark:text-violet-400 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <Link
          href="/comptabilite/operations"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition"
        >
          <ListChecks size={14} />
          Opérations
        </Link>
        <button
          onClick={handleExport}
          disabled={exportingRapport}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-violet-300 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-500/[0.08] text-sm font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-500/[0.14] transition disabled:opacity-60 disabled:cursor-not-allowed"
          title="Exporter le rapport mensuel premium (mois courant)"
        >
          {exportingRapport
            ? <Loader2 size={14} className="animate-spin" />
            : <FileDown size={14} />
          }
          {exportingRapport ? "Génération…" : "Exporter ce mois"}
        </button>
        <Link
          href="/comptabilite/operations/nouveau"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-sm font-semibold shadow-md shadow-emerald-500/25 transition"
        >
          <Plus size={14} />
          Ajouter
        </Link>
      </div>
    </div>
  )
}
