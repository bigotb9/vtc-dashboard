"use client"

/**
 * /comptabilite/tiers/[id] — Fiche détaillée d'un tiers (Phase 4.x Vague 2 §3.4).
 */

export const dynamic = "force-dynamic"

import { use, useState } from "react"
import { useRouter, notFound } from "next/navigation"
import { TiersDetailHeader } from "@/components/compta/TiersDetailHeader"
import { TiersDetailKpis } from "@/components/compta/TiersDetailKpis"
import { TiersInfoCards } from "@/components/compta/TiersInfoCards"
import { TiersOperationsTable } from "@/components/compta/TiersOperationsTable"
import { TiersDisableModal } from "@/components/compta/TiersDisableModal"
import { useTiersDetail } from "@/hooks/compta/useTiersDetail"
import { useTiersOperations } from "@/hooks/compta/useTiersOperations"
import { useCreateTiers } from "@/hooks/compta/useCreateTiers"
import { authFetch } from "@/lib/authFetch"
import { toast } from "@/lib/toast"

type Params = Promise<{ id: string }>

export default function TiersDetailPage({ params }: { params: Params }) {
  const { id } = use(params)
  const router = useRouter()
  const { data, loading, error, notFound: nf, refetch } = useTiersDetail(id)
  const ops = useTiersOperations(id)
  const { disable, update, loading: actionLoading } = useCreateTiers()
  const [disableOpen, setDisableOpen] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  if (nf) notFound()

  if (loading || !data) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-2/3 max-w-md rounded bg-gray-200/70 dark:bg-white/[0.04] animate-pulse" />
        <div className="h-20 rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[112px] rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-5">
        <p className="text-sm font-semibold text-red-700 dark:text-red-300">Erreur : {error}</p>
        <button onClick={() => refetch()} className="mt-3 inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-500/30 text-red-700 dark:text-red-300 hover:bg-red-500/10 transition">
          Réessayer
        </button>
      </div>
    )
  }

  async function handleDisable() {
    const res = await disable(id)
    if (res.ok) {
      toast.success("Tiers désactivé")
      setDisableOpen(false)
      router.push("/comptabilite/tiers")
    } else {
      toast.error(res.error)
    }
  }

  // Phase 4.x Vague 2 correctif §2.1 — réactiver
  async function handleReactivate() {
    const res = await update(id, { actif: true })
    if (res.ok) {
      toast.success("Tiers réactivé")
      await refetch()
    } else {
      // Collision : le code SYSCOHADA est désormais utilisé par un autre tiers actif
      if (res.code === "CONFLICT" || /SYSCOHADA|déjà|duplicate/i.test(res.error)) {
        toast.error("Code SYSCOHADA déjà utilisé — modifie le suffixe avant de réactiver")
        router.push(`/comptabilite/tiers/${id}/modifier?focus=suffix&hint=collision`)
        return
      }
      toast.error(res.error)
    }
  }

  async function handleExportPdf() {
    setExportingPdf(true)
    try {
      const y = new Date().getFullYear()
      const res = await authFetch(`/api/compta/exports/tiers/${id}`, {
        method: "POST",
        body:   JSON.stringify({ date_from: `${y}-01-01`, date_to: `${y}-12-31` }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error((j as { error?: string })?.error ?? `HTTP ${res.status}`)
        return
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a = document.createElement("a")
      const dispo = res.headers.get("Content-Disposition") ?? ""
      const m = /filename="([^"]+)"/.exec(dispo)
      a.href = url
      a.download = m?.[1] ?? "fiche-tiers.pdf"
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      toast.success("Fiche tiers téléchargée")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setExportingPdf(false)
    }
  }

  return (
    <div className="space-y-5">
      <TiersDetailHeader
        detail={data}
        onDisable={() => setDisableOpen(true)}
        onReactivate={handleReactivate}
        reactivating={actionLoading}
        onExportPdf={handleExportPdf}
        exportingPdf={exportingPdf}
      />
      <TiersDetailKpis detail={data} loading={loading} />
      <TiersInfoCards detail={data} />
      <TiersOperationsTable
        rows={ops.data?.data ?? []}
        loading={ops.loading}
      />
      {data.notes && (
        <div className="rounded-2xl bg-amber-500/5 border border-amber-500/20 p-4">
          <h3 className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300 mb-2">Notes</h3>
          <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{data.notes}</p>
        </div>
      )}

      <TiersDisableModal
        open={disableOpen}
        nom={data.nom}
        onClose={() => setDisableOpen(false)}
        onConfirm={handleDisable}
      />
    </div>
  )
}
