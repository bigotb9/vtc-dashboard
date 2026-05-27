"use client"

/**
 * /comptabilite/tiers/nouveau — Création d'un tiers (Phase 4.x Vague 2 §3.3).
 */

export const dynamic = "force-dynamic"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Users } from "lucide-react"
import { TiersForm } from "@/components/compta/TiersForm"
import { useCreateTiers } from "@/hooks/compta/useCreateTiers"
import { toast } from "@/lib/toast"

export default function NewTiersPage() {
  const router = useRouter()
  const { create, loading } = useCreateTiers()

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <Link href="/dashboard" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Accueil</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <Link href="/comptabilite" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Comptabilité</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <Link href="/comptabilite/tiers" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Tiers</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <span className="text-gray-700 dark:text-gray-300">Nouveau</span>
      </nav>

      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          title="Retour"
          className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] text-gray-500 hover:text-indigo-500 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition shadow-sm"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
          <Users size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-none">
            Nouveau tiers
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
            Le code SYSCOHADA est généré automatiquement à partir du nom et du type.
          </p>
        </div>
      </div>

      <TiersForm
        mode="create"
        loading={loading}
        onSubmit={async (payload) => {
          const res = await create(payload)
          if (res.ok) {
            toast.success(`Tiers créé · ${res.result.compte_syscohada_code}`)
            router.push(`/comptabilite/tiers/${res.result.tiers_id}`)
          } else {
            toast.error(res.error)
          }
        }}
        onCancel={() => router.push("/comptabilite/tiers")}
      />
    </div>
  )
}
