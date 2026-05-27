"use client"

/**
 * /comptabilite/categories/nouvelle — Écran 6 Phase 3 (création).
 */

export const dynamic = "force-dynamic"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowLeft, FilePlus } from "lucide-react"
import { toast } from "@/lib/toast"
import { CategorieForm } from "@/components/compta/CategorieForm"
import { useCategorieForm } from "@/hooks/compta/useCategorieForm"
import type { CategorieFormInput } from "@/types/compta-ui"

export default function NouvelleCategoriePage() {
  const router = useRouter()
  const { create, loading } = useCategorieForm()
  const [serverError, setServerError] = useState<string | null>(null)

  async function handleSubmit(input: CategorieFormInput) {
    setServerError(null)
    const res = await create(input)
    if (res.ok) {
      toast.success("Catégorie créée")
      router.push(`/comptabilite/categories/${res.data.id}`)
    } else {
      setServerError(res.error)
      toast.error(res.error)
    }
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <Link href="/dashboard" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Accueil</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <Link href="/comptabilite" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Comptabilité</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <Link href="/comptabilite/categories" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Catégories</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <span className="text-gray-700 dark:text-gray-300">Nouvelle</span>
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
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-amber-500 flex items-center justify-center shadow-lg shadow-violet-500/30 flex-shrink-0">
          <FilePlus size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-none">
            Nouvelle catégorie
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
            Créer une catégorie d&apos;opération avec mapping SYSCOHADA
          </p>
        </div>
      </div>

      <CategorieForm
        mode="create"
        loading={loading}
        serverError={serverError}
        onSubmit={handleSubmit}
        onCancel={() => router.push("/comptabilite/categories")}
      />
    </div>
  )
}
