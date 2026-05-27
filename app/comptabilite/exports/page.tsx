"use client"

/**
 * /comptabilite/exports — Phase 4 (Vague 1 + Vague 2 complète).
 *
 * Page d'exports PDF avec 5 cards de rapports actifs :
 *   GL (Grand Livre), BL (Balance), JR (Journaux), RC (Relevés), RM (Rapport mensuel).
 *
 * - Journaux : multi-sélection préfixes (VE, OD, CA, BQ, AC, PA)
 * - Relevés : multi-sélection caisses + comptes
 * - Rapport mensuel : 7 sections, full-width
 */

export const dynamic = "force-dynamic"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "@/lib/toast"
import { ExportsHeader } from "@/components/compta/ExportsHeader"
import { ExportsPeriodBar, computePeriodRange } from "@/components/compta/ExportsPeriodBar"
import { ExportsReportCard } from "@/components/compta/ExportsReportCard"
import { ExportsJournauxSelector } from "@/components/compta/ExportsJournauxSelector"
import { ExportsCaissesSelector } from "@/components/compta/ExportsCaissesSelector"
import { ExportProgressModal } from "@/components/compta/ExportProgressModal"
import { useExportsMetadata } from "@/hooks/compta/useExportsMetadata"
import { useGenerateExport } from "@/hooks/compta/useGenerateExport"
import { authFetch } from "@/lib/authFetch"
import type { ExportType, ExportsPeriodKey } from "@/types/compta-ui"

export default function ExportsPage() {
  const router = useRouter()
  const params = useSearchParams()

  // ── Période active ────────────────────────────────────────────────────────
  const [period, setPeriod] = useState<ExportsPeriodKey>("mois_prec")
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo,   setDateTo]   = useState<string>("")

  // Initialisation depuis URL ou défaut "mois_prec"
  useEffect(() => {
    const urlFrom = params.get("from")
    const urlTo   = params.get("to")
    if (urlFrom && urlTo) {
      setDateFrom(urlFrom); setDateTo(urlTo); setPeriod("personnalise")
    } else {
      const r = computePeriodRange("mois_prec")
      setDateFrom(r.date_from); setDateTo(r.date_to)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handlePeriodChange(p: ExportsPeriodKey, range: { date_from: string; date_to: string }) {
    setPeriod(p)
    setDateFrom(range.date_from)
    setDateTo(range.date_to)
    if (p === "personnalise") {
      router.replace(`/comptabilite/exports?from=${range.date_from}&to=${range.date_to}`)
    } else {
      router.replace(`/comptabilite/exports`)
    }
  }

  // ── Sélecteurs extras ─────────────────────────────────────────────────────
  const [journauxSelected, setJournauxSelected] = useState<string[]>(["all"])
  const [caissesSelected,  setCaissesSelected]  = useState<string[]>(["all"])

  // ── Métadonnées ───────────────────────────────────────────────────────────
  const { data: metadata, loading: metaLoading } = useExportsMetadata(dateFrom, dateTo)

  // ── Société (sous-titre) ──────────────────────────────────────────────────
  const [raisonSociale, setRaisonSociale] = useState<string | null>(null)
  useEffect(() => {
    authFetch("/api/compta/parametres")
      .then(r => r.ok ? r.json() : null)
      .then(j => setRaisonSociale(j?.data?.societe?.raison_sociale ?? null))
      .catch(() => {})
  }, [])

  // ── Génération ────────────────────────────────────────────────────────────
  const { generate, preview, loading: exporting, currentType } = useGenerateExport()
  const [busyAction, setBusyAction] = useState<{ type: ExportType; action: "preview" | "generate" } | null>(null)

  const buildBody = useCallback((type: ExportType) => {
    const body: { date_from: string; date_to: string; journaux?: string[]; caisses_ids?: string[] } = {
      date_from: dateFrom,
      date_to:   dateTo,
    }
    if (type === "journaux")        body.journaux    = journauxSelected
    if (type === "releves-caisses") body.caisses_ids = caissesSelected
    return body
  }, [dateFrom, dateTo, journauxSelected, caissesSelected])

  const handlePreview = useCallback(async (type: ExportType) => {
    if (!dateFrom || !dateTo) return
    setBusyAction({ type, action: "preview" })
    const res = await preview(type, buildBody(type))
    if (!res.ok) toast.error(res.error)
    setBusyAction(null)
  }, [dateFrom, dateTo, preview, buildBody])

  const handleGenerate = useCallback(async (type: ExportType) => {
    if (!dateFrom || !dateTo) return
    setBusyAction({ type, action: "generate" })
    const res = await generate(type, buildBody(type))
    if (res.ok) toast.success("PDF téléchargé")
    else toast.error(res.error)
    setBusyAction(null)
  }, [dateFrom, dateTo, generate, buildBody])

  // ── Helpers pour les cards ────────────────────────────────────────────────
  function pageEstimation(type: ExportType): string {
    const p = metadata?.estimations?.[type]
    if (!p) return "—"
    return `~${p} page${p > 1 ? "s" : ""}`
  }
  const busy = exporting ? (currentType ?? "grand-livre") : null

  // Métadonnées des cards (mémoïsées au top du composant)
  const metaGl = useMemo(() => [
    { label: "Pages estimées", value: pageEstimation("grand-livre") },
    { label: "Écritures",      value: String(metadata?.stats.nb_ecritures   ?? "—") },
    { label: "Comptes",        value: String(metadata?.stats.nb_comptes     ?? "—") },
    { label: "Opérations",     value: String(metadata?.stats.nb_operations  ?? "—") },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [metadata])

  const metaBl = useMemo(() => [
    { label: "Pages estimées", value: pageEstimation("balance") },
    { label: "Comptes",        value: String(metadata?.stats.nb_comptes ?? "—") },
    { label: "Écritures",      value: String(metadata?.stats.nb_ecritures ?? "—") },
    { label: "Format",         value: "A4 paysage" },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [metadata])

  const metaJr = useMemo(() => [
    { label: "Pages estimées",    value: pageEstimation("journaux") },
    { label: "Écritures",         value: String(metadata?.stats.nb_ecritures ?? "—") },
    { label: "Journaux dispos",   value: String(metadata?.stats.journaux_utilises.length ?? "—") },
    { label: "Sélection",         value: journauxSelected.includes("all") ? "Tous" : `${journauxSelected.length}` },
  ], [metadata, journauxSelected])

  const metaRc = useMemo(() => [
    { label: "Pages estimées",  value: pageEstimation("releves-caisses") },
    { label: "Caisses actives", value: String(metadata?.stats.nb_caisses ?? "—") },
    { label: "Mouvements",      value: String(metadata?.stats.nb_operations ?? "—") },
    { label: "Sélection",       value: caissesSelected.includes("all") ? "Toutes" : `${caissesSelected.length}` },
  ], [metadata, caissesSelected])

  const metaRm = useMemo(() => [
    { label: "Pages",     value: pageEstimation("rapport-mensuel") },
    { label: "Sections",  value: "7" },
    { label: "Charts",    value: "SVG natif" },
    { label: "Format",    value: "Premium" },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [metadata])

  return (
    <div className="space-y-5">
      <ExportsHeader raisonSociale={raisonSociale} />

      <ExportsPeriodBar
        period={period}
        dateFrom={dateFrom}
        dateTo={dateTo}
        metadata={metadata}
        loading={metaLoading}
        onPeriodChange={handlePeriodChange}
        onDateFromChange={s => { setDateFrom(s); setPeriod("personnalise") }}
        onDateToChange={s => { setDateTo(s); setPeriod("personnalise") }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Grand Livre */}
        <ExportsReportCard
          shortCode="GL"
          accent="violet"
          title="Grand Livre"
          description="Détail des écritures comptables compte par compte avec totaux et soldes. Document de référence pour l'expert-comptable."
          tag="A4 portrait"
          metadata={metaGl}
          loading={metaLoading}
          busyAction={busyAction?.type === "grand-livre" ? busyAction.action : null}
          onPreview={() => handlePreview("grand-livre")}
          onGenerate={() => handleGenerate("grand-livre")}
        />

        {/* Balance */}
        <ExportsReportCard
          shortCode="BL"
          accent="emerald"
          title="Balance des comptes"
          description="Totaux et soldes par compte SYSCOHADA avec vérification d'équilibre Σ Débits = Σ Crédits. Regroupé par classe."
          tag="A4 paysage"
          metadata={metaBl}
          loading={metaLoading}
          busyAction={busyAction?.type === "balance" ? busyAction.action : null}
          onPreview={() => handlePreview("balance")}
          onGenerate={() => handleGenerate("balance")}
        />

        {/* Journaux */}
        <ExportsReportCard
          shortCode="JR"
          accent="cyan"
          title="Journaux comptables"
          description="Vue chronologique par préfixe de journal (VE, OD, CA, BQ, etc.) avec filtre multi-sélection."
          tag="A4 portrait"
          metadata={metaJr}
          loading={metaLoading}
          busyAction={busyAction?.type === "journaux" ? busyAction.action : null}
          extras={
            <ExportsJournauxSelector
              available={metadata?.stats.journaux_utilises ?? []}
              value={journauxSelected}
              onChange={setJournauxSelected}
            />
          }
          onPreview={() => handlePreview("journaux")}
          onGenerate={() => handleGenerate("journaux")}
        />

        {/* Relevés caisses */}
        <ExportsReportCard
          shortCode="RC"
          accent="amber"
          title="Relevés de trésorerie"
          description="Mouvements par caisse et compte bancaire avec solde initial, mouvements et solde final."
          tag="A4 portrait"
          metadata={metaRc}
          loading={metaLoading}
          busyAction={busyAction?.type === "releves-caisses" ? busyAction.action : null}
          extras={
            <ExportsCaissesSelector
              value={caissesSelected}
              onChange={setCaissesSelected}
            />
          }
          onPreview={() => handlePreview("releves-caisses")}
          onGenerate={() => handleGenerate("releves-caisses")}
        />

        {/* Rapport mensuel — full width */}
        <ExportsReportCard
          shortCode="RM"
          accent="red"
          title="Rapport mensuel synthétique"
          description="Document premium 8-12 pages avec couverture, résumé exécutif auto-généré, charts d'évolution sur 6 mois, top catégories/véhicules, soldes trésorerie, audit santé, annexes top 20."
          tag="A4 portrait · design premium"
          fullWidth
          metadata={metaRm}
          loading={metaLoading}
          busyAction={busyAction?.type === "rapport-mensuel" ? busyAction.action : null}
          onPreview={() => handlePreview("rapport-mensuel")}
          onGenerate={() => handleGenerate("rapport-mensuel")}
        />
      </div>

      <ExportProgressModal open={exporting} type={busy} />
    </div>
  )
}
