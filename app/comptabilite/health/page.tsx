"use client"

/**
 * /comptabilite/health — Écran 8 Phase 3 (audit comptable).
 *
 * Page d'audit principale avec banner de synthèse + 4 KPIs globaux +
 * 5 sections accordéon (Équilibre, Cohérence ops↔écritures, Mappings
 * SYSCOHADA, Cohérence journaux, Statistiques globales).
 */

export const dynamic = "force-dynamic"

import { useCallback, useState } from "react"
import { Scale, Link2, BookOpen, Book, BarChart3 } from "lucide-react"
import { toast } from "@/lib/toast"
import { HealthHeader } from "@/components/compta/HealthHeader"
import { HealthBannerLarge } from "@/components/compta/HealthBannerLarge"
import { HealthKpis } from "@/components/compta/HealthKpis"
import { HealthSectionAccordion } from "@/components/compta/HealthSectionAccordion"
import { HealthStatsGrid } from "@/components/compta/HealthStatsGrid"
import { HealthFixModal } from "@/components/compta/HealthFixModal"
import { useHealthDetailed } from "@/hooks/compta/useHealthDetailed"
import { useHealthFix } from "@/hooks/compta/useHealthFix"
import type { HealthAnomaly } from "@/types/compta-ui"

export default function HealthAuditPage() {
  const { data, loading, error, refetch } = useHealthDetailed()
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

  return (
    <div className="space-y-5">
      <HealthHeader
        ok={data?.ok ?? null}
        score={data?.score ?? null}
        checkedAt={data?.checked_at ?? null}
        loading={loading}
        onRefetch={refetch}
      />

      <HealthBannerLarge data={data} loading={loading} />
      <HealthKpis        data={data} loading={loading} />

      {error && !loading && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-700 dark:text-red-300">
          Erreur de chargement : {error}.{" "}
          <button onClick={() => refetch()} className="font-semibold underline">Réessayer</button>
        </div>
      )}

      {data && (
        <>
          <HealthSectionAccordion
            sectionKey="equilibre"
            accent="emerald"
            Icon={Scale}
            title="Équilibre comptable"
            description="Σ(débit) = Σ(crédit), écritures équilibrées et partie double respectée."
            payload={data.sections.equilibre}
          />
          <HealthSectionAccordion
            sectionKey="coherence_ops_ecritures"
            accent="amber"
            Icon={Link2}
            title="Cohérence opérations ↔ écritures"
            description="Liens FK opérations / écritures + détection des doublons."
            payload={data.sections.coherence_ops_ecritures}
            onFix={handleFix}
          />
          <HealthSectionAccordion
            sectionKey="mappings_syscohada"
            accent="violet"
            Icon={BookOpen}
            title="Mappings SYSCOHADA"
            description="Caisses, comptes et catégories ont un compte SYSCOHADA valide."
            payload={data.sections.mappings_syscohada}
          />
          <HealthSectionAccordion
            sectionKey="coherence_journaux"
            accent="cyan"
            Icon={Book}
            title="Cohérence des journaux"
            description="Numérotation continue, pas de doublons, journaux valides."
            payload={data.sections.coherence_journaux}
          />

          {/* Section 5 : Stats globales — toujours visibles, en bas */}
          <section id="stats_globales" className="relative rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
            <div className="px-5 py-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-500 flex items-center justify-center text-white shadow-md shadow-cyan-500/30 flex-shrink-0">
                <BarChart3 size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-cyan-700 dark:text-cyan-300">Statistiques globales</h3>
                <p className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-0.5">Vue de contexte (pas un check).</p>
              </div>
            </div>
            <div className="px-5 pb-5">
              <HealthStatsGrid payload={data.sections.stats_globales} />
            </div>
          </section>
        </>
      )}

      <HealthFixModal
        open={fixTarget !== null}
        anomaly={fixTarget}
        onConfirm={handleConfirmFix}
        onCancel={() => setFixTarget(null)}
      />
    </div>
  )
}
