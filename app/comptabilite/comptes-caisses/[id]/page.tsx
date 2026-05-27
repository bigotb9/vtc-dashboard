"use client"

/**
 * /comptabilite/comptes-caisses/[id] — détail d'une caisse OU d'un compte
 * (Écran 5 Phase 3).
 *
 * On essaie d'abord GET /api/compta/caisses/[id] puis GET /api/compta/comptes/[id]
 * si l'id n'est pas trouvé du premier coup. Une fois résolu, on fetch via le
 * bon endpoint pour avoir le détail enrichi.
 */

export const dynamic = "force-dynamic"

import { use, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "@/lib/toast"
import { authFetch } from "@/lib/authFetch"
import { CompteCaisseDetailHeader } from "@/components/compta/CompteCaisseDetailHeader"
import { CompteCaisseDetailKpis } from "@/components/compta/CompteCaisseDetailKpis"
import { EvolutionSoldeChart } from "@/components/compta/EvolutionSoldeChart"
import { CompteCaisseInfos } from "@/components/compta/CompteCaisseInfos"
import { DernieresOperationsCaisse } from "@/components/compta/DernieresOperationsCaisse"
import { DangerZone } from "@/components/compta/DangerZone"
import { TransfertInterneModal } from "@/components/compta/TransfertInterneModal"
import { useCompteCaisseDetail } from "@/hooks/compta/useCompteCaisseDetail"
import { useCompteCaisseForm } from "@/hooks/compta/useCompteCaisseForm"
import type { TransfertDestinationItem } from "@/types/compta-ui"

type Props = { params: Promise<{ id: string }> }

/** Détermine si un id est une caisse ou un compte en essayant les 2 endpoints
 *  (les ids sont des UUIDs uniques par table mais on ne sait pas a priori). */
async function resolveKind(id: string): Promise<"caisse" | "compte" | null> {
  // Essai caisse d'abord (plus probable selon volumétrie)
  try {
    const r = await authFetch(`/api/compta/caisses/${id}`)
    if (r.ok) return "caisse"
  } catch { /* ignore */ }
  try {
    const r = await authFetch(`/api/compta/comptes/${id}`)
    if (r.ok) return "compte"
  } catch { /* ignore */ }
  return null
}

export default function CompteCaisseDetailPage({ params }: Props) {
  const router = useRouter()
  const { id } = use(params)
  const [kind, setKind] = useState<"caisse" | "compte" | null>(null)
  const [resolving, setResolving] = useState(true)

  useEffect(() => {
    let cancelled = false
    setResolving(true)
    resolveKind(id).then(k => {
      if (cancelled) return
      setKind(k)
      setResolving(false)
    })
    return () => { cancelled = true }
  }, [id])

  const { data, loading, error, refetch } = useCompteCaisseDetail(kind ?? "caisse", kind ? id : null)
  const { update, remove, loading: actionLoading } = useCompteCaisseForm()

  // ─── Phase 4.x Vague 1 — Modal transfert interne ──────────────────────────
  const [transfertOpen, setTransfertOpen] = useState(false)
  const sourceAsDestination: TransfertDestinationItem | null = (data && kind)
    ? {
        id:             data.id,
        kind,
        libelle:        data.libelle,
        code:           data.code,
        shortCode:      (data.code ?? data.libelle).slice(0, 4).toUpperCase(),
        syscohada_code: data.compte_syscohada_code,
        solde_courant:  data.solde,
        actif:          data.actif,
      }
    : null

  const handleDeactivate = useCallback(async () => {
    if (!kind || !data) return
    const res = await update(kind, id, {
      type_cible: kind,
      libelle:    data.libelle,
      code:       data.code,
      type:       data.type as "cash" | "mobile_money" | null,
      operateur:  data.operateur,
      banque:     data.banque,
      numero:     data.numero,
      compte_syscohada_code: data.compte_syscohada_code,
      description: data.description,
      actif:      false,
    })
    if (res.ok) {
      toast.success("Désactivée")
      await refetch()
    } else {
      toast.error(res.error)
    }
  }, [kind, data, id, update, refetch])

  const handleReactivate = useCallback(async () => {
    if (!kind || !data) return
    const res = await update(kind, id, {
      type_cible: kind,
      libelle:    data.libelle,
      code:       data.code,
      type:       data.type as "cash" | "mobile_money" | null,
      operateur:  data.operateur,
      banque:     data.banque,
      numero:     data.numero,
      compte_syscohada_code: data.compte_syscohada_code,
      description: data.description,
      actif:      true,
    })
    if (res.ok) {
      toast.success("Réactivée")
      await refetch()
    } else {
      toast.error(res.error)
    }
  }, [kind, data, id, update, refetch])

  const handleDelete = useCallback(async () => {
    if (!kind) return
    const res = await remove(kind, id)
    if (res.ok) {
      toast.success("Supprimée définitivement")
      router.push("/comptabilite/comptes-caisses")
    } else {
      toast.error(res.error)
    }
  }, [kind, id, remove, router])

  if (resolving) {
    return (
      <div className="space-y-5">
        <div className="h-20 rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[112px] rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!kind) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">
          Caisse ou compte introuvable
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md">
          Cet identifiant ne correspond à aucune caisse ni compte bancaire.
        </p>
        <Link
          href="/comptabilite/comptes-caisses"
          className="mt-6 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white text-sm font-semibold"
        >
          Retour à la liste
        </Link>
      </div>
    )
  }

  if (error && !loading) {
    return (
      <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-700 dark:text-red-300">
        Erreur : {error}.{" "}
        <button onClick={() => refetch()} className="font-semibold underline">Réessayer</button>
      </div>
    )
  }

  if (loading || !data) {
    return (
      <div className="space-y-5">
        <div className="h-20 rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[112px] rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse" />
          ))}
        </div>
        <div className="h-[320px] rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <CompteCaisseDetailHeader
        detail={data}
        onTransfert={() => setTransfertOpen(true)}
      />
      <CompteCaisseDetailKpis detail={data} loading={loading} />
      <EvolutionSoldeChart data={data.evolution_solde_12_mois} loading={loading} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CompteCaisseInfos detail={data} />
        <DernieresOperationsCaisse detail={data} />
      </div>
      <DangerZone
        detail={data}
        loading={actionLoading}
        onDeactivate={handleDeactivate}
        onReactivate={handleReactivate}
        onDelete={handleDelete}
      />

      {/* Phase 4.x Vague 1 — Modal transfert interne */}
      <TransfertInterneModal
        open={transfertOpen}
        source={sourceAsDestination}
        onClose={() => setTransfertOpen(false)}
        onSuccess={() => { refetch() }}
      />
    </div>
  )
}
