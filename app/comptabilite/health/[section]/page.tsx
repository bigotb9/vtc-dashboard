"use client"

/**
 * /comptabilite/health/[section] — Voir toutes les anomalies d'une section
 * (Écran 8 §4.2).
 */

export const dynamic = "force-dynamic"

import { use, useCallback, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Stethoscope } from "lucide-react"
import { toast } from "@/lib/toast"
import { HealthAnomaliesTable } from "@/components/compta/HealthAnomaliesTable"
import { HealthFixModal } from "@/components/compta/HealthFixModal"
import { useHealthAnomaliesFull } from "@/hooks/compta/useHealthAnomaliesFull"
import { useHealthFix } from "@/hooks/compta/useHealthFix"
import type { HealthAnomaly, HealthSectionKey } from "@/types/compta-ui"

type Props = { params: Promise<{ section: string }> }

const SECTION_LABELS: Record<HealthSectionKey, string> = {
  equilibre:               "Équilibre comptable",
  coherence_ops_ecritures: "Cohérence opérations ↔ écritures",
  mappings_syscohada:      "Mappings SYSCOHADA",
  coherence_journaux:      "Cohérence des journaux",
  stats_globales:          "Statistiques globales",
}

function isValidSection(s: string): s is HealthSectionKey {
  return s in SECTION_LABELS
}

export default function HealthSectionPage({ params }: Props) {
  const router = useRouter()
  const { section: raw } = use(params)
  const section = isValidSection(raw) ? raw : null

  const { anomalies, total, loading, error, refetch } = useHealthAnomaliesFull(section)
  const { fix } = useHealthFix()
  const [fixTarget, setFixTarget] = useState<HealthAnomaly | null>(null)

  const handleFix = useCallback((anomaly: HealthAnomaly) => {
    setFixTarget(anomaly)
  }, [])

  const handleConfirmFix = useCallback(async (anomaly: HealthAnomaly) => {
    const res = await fix(anomaly)
    if (res.ok) {
      toast.success("Correction appliquée")
      setFixTarget(null)
      await refetch()
      return { ok: true as const }
    }
    return { ok: false as const, error: res.error }
  }, [fix, refetch])

  if (!section) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-700 dark:text-red-300">
          Section inconnue : <span className="font-mono">{raw}</span>.{" "}
          <Link href="/comptabilite/health" className="font-semibold underline">Retour à l&apos;audit</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <Link href="/dashboard" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Accueil</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <Link href="/comptabilite" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Comptabilité</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <Link href="/comptabilite/health" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Audit</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <span className="text-gray-700 dark:text-gray-300 truncate max-w-[280px]">{SECTION_LABELS[section]}</span>
      </nav>

      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          title="Retour"
          className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] text-gray-500 hover:text-violet-500 hover:border-violet-300 dark:hover:border-violet-500/40 transition shadow-sm"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30 flex-shrink-0">
          <Stethoscope size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-none">
            Anomalies — {SECTION_LABELS[section]}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
            Liste exhaustive (limite : 100 anomalies par page).
          </p>
        </div>
      </div>

      {error && !loading && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-700 dark:text-red-300">
          Erreur : {error}.{" "}
          <button onClick={() => refetch()} className="font-semibold underline">Réessayer</button>
        </div>
      )}

      <HealthAnomaliesTable
        anomalies={anomalies}
        total={total}
        loading={loading}
        onFix={handleFix}
      />

      <HealthFixModal
        open={fixTarget !== null}
        anomaly={fixTarget}
        onConfirm={handleConfirmFix}
        onCancel={() => setFixTarget(null)}
      />
    </div>
  )
}
