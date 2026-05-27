"use client"

/**
 * /comptabilite/tiers/[id]/modifier — Édition d'un tiers (Phase 4.x Vague 2 §3.5).
 */

export const dynamic = "force-dynamic"

import { use, useEffect } from "react"
import Link from "next/link"
import { useRouter, notFound, useSearchParams } from "next/navigation"
import { ArrowLeft, Pencil, AlertTriangle } from "lucide-react"
import { TiersForm } from "@/components/compta/TiersForm"
import { useTiersDetail } from "@/hooks/compta/useTiersDetail"
import { useCreateTiers } from "@/hooks/compta/useCreateTiers"
import { toast } from "@/lib/toast"

type Params = Promise<{ id: string }>

export default function EditTiersPage({ params }: { params: Params }) {
  const { id } = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const collisionHint = searchParams.get("hint") === "collision"
  const { data, loading, error, notFound: nf } = useTiersDetail(id)
  const { update, loading: saving } = useCreateTiers()

  useEffect(() => {
    if (collisionHint) {
      toast.info("Modifie le suffixe pour libérer le code SYSCOHADA puis sauvegarde.")
    }
  }, [collisionHint])

  if (nf) notFound()

  if (loading || !data) {
    return <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-32 rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse" />
      ))}
    </div>
  }

  if (error) {
    return <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-5 text-sm text-red-700 dark:text-red-300">Erreur : {error}</div>
  }

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <Link href="/dashboard" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Accueil</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <Link href="/comptabilite/tiers" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Tiers</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <Link href={`/comptabilite/tiers/${id}`} className="hover:text-gray-700 dark:hover:text-gray-200 transition truncate max-w-[200px]">{data.nom}</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <span className="text-gray-700 dark:text-gray-300">Modifier</span>
      </nav>

      <div className="flex items-start gap-3">
        <button onClick={() => router.back()} title="Retour"
          className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] text-gray-500 hover:text-indigo-500 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition shadow-sm">
          <ArrowLeft size={16} />
        </button>
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
          <Pencil size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-none">Modifier {data.nom}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
            Attention : changer le type ou le suffixe change le code SYSCOHADA et impacte le Grand Livre.
          </p>
        </div>
      </div>

      {/* Phase 4.x Vague 2 correctif §2.1 — Banner collision pendant réactivation */}
      {collisionHint && !data.actif && (
        <div className="rounded-xl border border-amber-400/50 bg-amber-500/10 p-3 flex items-start gap-2.5 text-sm">
          <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-amber-700 dark:text-amber-300">Collision SYSCOHADA</p>
            <p className="text-amber-700/90 dark:text-amber-300/90 text-[12.5px] mt-0.5">
              Le code <span className="font-mono font-bold">{data.compte_syscohada_code}</span> est désormais utilisé par un autre tiers actif.
              Choisis un autre suffixe puis enregistre pour réactiver ce tiers.
            </p>
          </div>
        </div>
      )}

      <TiersForm
        mode="edit"
        initial={data}
        loading={saving}
        onSubmit={async patch => {
          if (Object.keys(patch).length === 0) {
            toast.info("Aucun changement à enregistrer.")
            return
          }
          const res = await update(id, patch)
          if (res.ok) {
            toast.success("Tiers mis à jour")
            router.push(`/comptabilite/tiers/${id}`)
          } else {
            toast.error(res.error)
          }
        }}
        onCancel={() => router.push(`/comptabilite/tiers/${id}`)}
      />
    </div>
  )
}
