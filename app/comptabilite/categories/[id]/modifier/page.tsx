"use client"

/**
 * /comptabilite/categories/[id]/modifier — Écran 6 (modification).
 */

export const dynamic = "force-dynamic"

import Link from "next/link"
import { use, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Pencil } from "lucide-react"
import { toast } from "@/lib/toast"
import { CategorieForm } from "@/components/compta/CategorieForm"
import { useCategorieForm } from "@/hooks/compta/useCategorieForm"
import { useCategorieDetail } from "@/hooks/compta/useCategorieDetail"
import type { CategorieFormInput } from "@/types/compta-ui"

type Props = { params: Promise<{ id: string }> }

export default function ModifierCategoriePage({ params }: Props) {
  const router = useRouter()
  const { id } = use(params)
  const { data, loading: detailLoading } = useCategorieDetail(id)
  const { update, loading } = useCategorieForm()
  const [serverError, setServerError] = useState<string | null>(null)

  async function handleSubmit(input: CategorieFormInput) {
    setServerError(null)
    const res = await update(id, input)
    if (res.ok) {
      toast.success("Modifications enregistrées")
      router.push(`/comptabilite/categories/${id}`)
    } else {
      setServerError(res.error)
      toast.error(res.error)
    }
  }

  const initial: Partial<CategorieFormInput> | undefined = data ? {
    libelle:                data.libelle,
    type:                   data.type,
    sens:                   (data.sens ?? "credit") as "debit" | "credit",
    compte_syscohada_code:  data.compte_syscohada_code,
    journal_par_defaut:     data.journal_par_defaut,
    description:            data.description,
    actif:                  data.actif,
  } : undefined

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <Link href="/dashboard" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Accueil</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <Link href="/comptabilite" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Comptabilité</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <Link href="/comptabilite/categories" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Catégories</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <Link href={`/comptabilite/categories/${id}`} className="hover:text-gray-700 dark:hover:text-gray-200 transition truncate max-w-[180px]">
          {data?.libelle ?? "…"}
        </Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <span className="text-gray-700 dark:text-gray-300">Modifier</span>
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
          <Pencil size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-none">
            Modifier {data?.libelle ?? "…"}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
            Mise à jour des métadonnées
          </p>
        </div>
      </div>

      {detailLoading || !data ? (
        <div className="h-[400px] rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse" />
      ) : (
        <CategorieForm
          mode="edit"
          initial={initial}
          loading={loading}
          serverError={serverError}
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/comptabilite/categories/${id}`)}
        />
      )}
    </div>
  )
}
