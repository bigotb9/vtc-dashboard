"use client"

/**
 * /comptabilite/categories/[id] — détail enrichi (Écran 6).
 */

export const dynamic = "force-dynamic"

import { use, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "@/lib/toast"
import { CategorieDetailHeader } from "@/components/compta/CategorieDetailHeader"
import { CategorieDetailKpis } from "@/components/compta/CategorieDetailKpis"
import { CategorieInfos } from "@/components/compta/CategorieInfos"
import { CategorieOpsList } from "@/components/compta/CategorieOpsList"
import { CategorieDangerZone } from "@/components/compta/CategorieDangerZone"
import { useCategorieDetail } from "@/hooks/compta/useCategorieDetail"
import { useCategorieForm } from "@/hooks/compta/useCategorieForm"

type Props = { params: Promise<{ id: string }> }

export default function CategorieDetailPage({ params }: Props) {
  const router = useRouter()
  const { id } = use(params)
  const { data, loading, error, refetch } = useCategorieDetail(id)
  const { update, remove, loading: actionLoading } = useCategorieForm()

  const handleDeactivate = useCallback(async () => {
    if (!data) return
    const res = await update(id, {
      libelle:               data.libelle,
      type:                  data.type,
      sens:                  data.sens ?? "credit",
      compte_syscohada_code: data.compte_syscohada_code,
      journal_par_defaut:    data.journal_par_defaut,
      description:           data.description,
      actif:                 false,
    })
    if (res.ok) { toast.success("Catégorie désactivée"); await refetch() }
    else toast.error(res.error)
  }, [data, id, update, refetch])

  const handleReactivate = useCallback(async () => {
    if (!data) return
    const res = await update(id, {
      libelle:               data.libelle,
      type:                  data.type,
      sens:                  data.sens ?? "credit",
      compte_syscohada_code: data.compte_syscohada_code,
      journal_par_defaut:    data.journal_par_defaut,
      description:           data.description,
      actif:                 true,
    })
    if (res.ok) { toast.success("Catégorie réactivée"); await refetch() }
    else toast.error(res.error)
  }, [data, id, update, refetch])

  const handleDelete = useCallback(async () => {
    const res = await remove(id)
    if (res.ok) {
      toast.success("Catégorie supprimée")
      router.push("/comptabilite/categories")
    } else {
      toast.error(res.error)
    }
  }, [id, remove, router])

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
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <CategorieDetailHeader detail={data} />
      <CategorieDetailKpis   detail={data} loading={loading} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CategorieInfos   detail={data} />
        <CategorieOpsList detail={data} />
      </div>
      <CategorieDangerZone
        detail={data}
        loading={actionLoading}
        onDeactivate={handleDeactivate}
        onReactivate={handleReactivate}
        onDelete={handleDelete}
      />
    </div>
  )
}
