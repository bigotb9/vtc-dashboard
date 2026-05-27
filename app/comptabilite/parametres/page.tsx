"use client"

/**
 * /comptabilite/parametres — Écran 7 Phase 3.
 *
 * Page unique scrollable avec scrollspy nav et 5 sections :
 *   Mode · Exercice · Workflow · Société · Zone dangereuse
 *
 * Toutes les actions passent par les hooks useParametres / useToggleMode /
 * useHealthCheck. Chaque PATCH déclenche un refetch automatique.
 */

export const dynamic = "force-dynamic"

import { ArrowLeftRight, Calendar, Route, Building2, AlertTriangle } from "lucide-react"
import { ParametresHeader } from "@/components/compta/ParametresHeader"
import { ScrollspyNav, type ScrollspyItem } from "@/components/compta/ScrollspyNav"
import { ModeSection } from "@/components/compta/ModeSection"
import { ExerciceSection } from "@/components/compta/ExerciceSection"
import { WorkflowSection } from "@/components/compta/WorkflowSection"
import { SocieteSection } from "@/components/compta/SocieteSection"
import { DangerZoneSection } from "@/components/compta/DangerZoneSection"
import { useParametres } from "@/hooks/compta/useParametres"

const NAV_ITEMS: ScrollspyItem[] = [
  { id: "mode",      label: "Mode",            Icon: ArrowLeftRight },
  { id: "exercice",  label: "Exercice",        Icon: Calendar },
  { id: "workflow",  label: "Workflow",        Icon: Route },
  { id: "societe",   label: "Société",         Icon: Building2 },
  { id: "danger",    label: "Zone dangereuse", Icon: AlertTriangle },
]

export default function ParametresPage() {
  const { data, loading, patching, error, refetch, patch } = useParametres()

  return (
    <div className="space-y-5">
      <ParametresHeader data={data} loading={loading} />

      <ScrollspyNav items={NAV_ITEMS} />

      {error && !loading && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-700 dark:text-red-300">
          Erreur de chargement : {error}.{" "}
          <button onClick={() => refetch()} className="font-semibold underline">Réessayer</button>
        </div>
      )}

      <ModeSection      data={data} loading={loading}                          onChanged={refetch} />
      <ExerciceSection  data={data} loading={loading} />
      <WorkflowSection  data={data} loading={loading} patching={patching}      onPatch={patch} />
      <SocieteSection   data={data} loading={loading} patching={patching}      onPatch={patch} />
      <DangerZoneSection data={data} loading={loading}                          onPatch={patch} onChanged={refetch} />
    </div>
  )
}
