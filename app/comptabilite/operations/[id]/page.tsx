"use client"

/**
 * /comptabilite/operations/[id] — Écran 2 Phase 3.
 *
 * Page détail d'une opération comptable :
 *   - Header (breadcrumb + back + titre + actions contextuelles)
 *   - Card Informations (liseré vert/rouge selon entrée/sortie)
 *   - Card Écriture comptable SYSCOHADA (si ecriture_id non null)
 *   - Card Liens métier (cyan) si au moins 1 lien
 *   - Card Historique (ambre)
 *   - Card Métadonnées techniques (collapse, gris)
 *
 * Layout retenu : empilement vertical (Option A du doc §2.2).
 */

export const dynamic = "force-dynamic"

import { use, useState } from "react"
import { useRouter } from "next/navigation"
import { notFound } from "next/navigation"
import { OperationHeader } from "@/components/compta/OperationHeader"
import { OperationInfoCard } from "@/components/compta/OperationInfoCard"
import { EcritureComptableCard } from "@/components/compta/EcritureComptableCard"
import { OperationTransfertCard } from "@/components/compta/OperationTransfertCard"
import { TiersRetroactionCard } from "@/components/compta/TiersRetroactionCard"
import { JustificatifsCard } from "@/components/compta/JustificatifsCard"
import { LiensMetierCard } from "@/components/compta/LiensMetierCard"
import { HistoriqueCard } from "@/components/compta/HistoriqueCard"
import { MetadonneesCard } from "@/components/compta/MetadonneesCard"
import { ConfirmAnnulerModal } from "@/components/compta/ConfirmAnnulerModal"
import { ConfirmDeleteModal } from "@/components/compta/ConfirmDeleteModal"
import { useOperationDetail } from "@/hooks/compta/useOperationDetail"
import { useOperationActions } from "@/hooks/compta/useOperationActions"
import { toast } from "@/lib/toast"

type Params = Promise<{ id: string }>

export default function OperationDetailPage({ params }: { params: Params }) {
  const { id } = use(params)
  const router = useRouter()

  const { data, loading, error, notFound: nf, refetch } = useOperationDetail(id)
  const actions = useOperationActions(id)

  const [annulerOpen, setAnnulerOpen] = useState(false)
  const [deleteOpen,  setDeleteOpen]  = useState(false)

  // 404 → délègue à not-found.tsx via le helper Next.js
  if (nf) notFound()

  // Loading initial
  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-2/3 max-w-md rounded bg-gray-200/70 dark:bg-white/[0.04] animate-pulse" />
        <div className="h-5 w-1/3 max-w-xs rounded bg-gray-200/70 dark:bg-white/[0.04] animate-pulse" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-44 rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse"
          />
        ))}
      </div>
    )
  }

  // Erreur réseau / serveur
  if (error || !data) {
    return (
      <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-5">
        <p className="text-sm font-semibold text-red-700 dark:text-red-300">
          Erreur de chargement : {error ?? "réponse vide"}
        </p>
        <button
          onClick={() => refetch()}
          className="mt-3 inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-500/30 text-red-700 dark:text-red-300 hover:bg-red-500/10 transition"
        >
          Réessayer
        </button>
      </div>
    )
  }

  const { operation, ecriture, extourne, historique } = data
  // Phase 4.x Vague 1 — lien vers l'opération jumelle si transfert interne
  const transfertJumelle = data.transfert_jumelle ?? null
  const selfLibelle = operation.caisse?.libelle ?? operation.compte?.libelle ?? null

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleValider = async () => {
    const ok = await actions.valider()
    if (ok) {
      toast.success("Opération validée")
      await refetch()
    } else {
      toast.error(actions.error ?? "Validation impossible")
    }
  }

  const handleAnnulerConfirm = async (raison: string | undefined) => {
    const ok = await actions.annuler(raison)
    if (ok) {
      setAnnulerOpen(false)
      toast.success("Opération annulée · extourne générée")
      await refetch()
    } else {
      toast.error(actions.error ?? "Annulation impossible")
    }
  }

  const handleSupprimerConfirm = async () => {
    const ok = await actions.supprimer()
    if (ok) {
      setDeleteOpen(false)
      toast.success("Brouillon supprimé")
      router.push("/comptabilite/operations")
    } else {
      toast.error(actions.error ?? "Suppression impossible")
    }
  }

  return (
    <div className="space-y-5 animate-in">
      <OperationHeader
        operation={operation}
        extourne={extourne}
        loading={actions.loading}
        onValider={handleValider}
        onAnnuler={() => setAnnulerOpen(true)}
        onSupprimer={() => setDeleteOpen(true)}
      />

      <OperationInfoCard operation={operation} />

      {/* Phase 4.x Vague 1 — encart transfert interne */}
      {transfertJumelle && (
        <OperationTransfertCard link={transfertJumelle} selfLibelle={selfLibelle} />
      )}

      {/* Phase 4.x Vague 2 — encart Tiers (rétroaction supportée) */}
      <TiersRetroactionCard
        operationId={operation.id}
        operationType={operation.type}
        tiers={operation.tiers}
        onChanged={refetch}
      />

      {/* Phase 4.x Vague 3 — Justificatifs (obligatoire si sortie + tiers) */}
      <JustificatifsCard
        operationId={operation.id}
        operationType={operation.type}
        tiersLinked={!!operation.tiers}
        uploaderOpen={operation.statut === "brouillon" && operation.type === "sortie" && !!operation.tiers}
        editable={operation.statut !== "annule"}
        disabled={operation.statut === "annule"}
      />

      {ecriture && <EcritureComptableCard ecriture={ecriture} />}

      <LiensMetierCard operation={operation} />

      <HistoriqueCard historique={historique} />

      <MetadonneesCard operation={operation} />

      <ConfirmAnnulerModal
        open={annulerOpen}
        loading={actions.loading === "annuler"}
        onClose={() => setAnnulerOpen(false)}
        onConfirm={handleAnnulerConfirm}
      />
      <ConfirmDeleteModal
        open={deleteOpen}
        loading={actions.loading === "supprimer"}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleSupprimerConfirm}
      />
    </div>
  )
}
