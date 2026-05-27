"use client"

/**
 * /comptabilite/comptes-caisses/[id]/modifier — Écran 5 (modification).
 *
 * Réutilise le CompteCaisseForm en mode edit avec pré-remplissage depuis le
 * détail enrichi. Le type_cible est figé.
 */

export const dynamic = "force-dynamic"

import Link from "next/link"
import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Pencil } from "lucide-react"
import { toast } from "@/lib/toast"
import { authFetch } from "@/lib/authFetch"
import { CompteCaisseForm } from "@/components/compta/CompteCaisseForm"
import { useCompteCaisseForm } from "@/hooks/compta/useCompteCaisseForm"
import { useCompteCaisseDetail } from "@/hooks/compta/useCompteCaisseDetail"
import type { CompteCaisseFormInput } from "@/types/compta-ui"

type Props = { params: Promise<{ id: string }> }

async function resolveKind(id: string): Promise<"caisse" | "compte" | null> {
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

export default function ModifierCaissePage({ params }: Props) {
  const router = useRouter()
  const { id } = use(params)
  const [kind, setKind] = useState<"caisse" | "compte" | null>(null)
  const [resolving, setResolving] = useState(true)
  const [serverError, setServerError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    resolveKind(id).then(k => { if (!cancelled) { setKind(k); setResolving(false) } })
    return () => { cancelled = true }
  }, [id])

  const { data, loading: detailLoading } = useCompteCaisseDetail(kind ?? "caisse", kind ? id : null)
  const { update, loading } = useCompteCaisseForm()

  async function handleSubmit(input: CompteCaisseFormInput) {
    if (!kind) return
    setServerError(null)
    const res = await update(kind, id, input)
    if (res.ok) {
      toast.success("Modifications enregistrées")
      router.push(`/comptabilite/comptes-caisses/${id}`)
    } else {
      setServerError(res.error)
      toast.error(res.error)
    }
  }

  if (resolving) {
    return (
      <div className="space-y-5">
        <div className="h-24 rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse" />
        <div className="h-[400px] rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse" />
      </div>
    )
  }

  if (!kind) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">Élément introuvable</h1>
        <Link href="/comptabilite/comptes-caisses" className="mt-4 text-violet-600 dark:text-violet-400 underline">
          Retour à la liste
        </Link>
      </div>
    )
  }

  const initial: Partial<CompteCaisseFormInput> | undefined = data ? {
    type_cible:             kind,
    libelle:                data.libelle,
    code:                   data.code,
    type:                   data.type as "cash" | "mobile_money" | null,
    operateur:              data.operateur,
    banque:                 data.banque,
    numero:                 data.numero,
    compte_syscohada_code:  data.compte_syscohada_code,
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
        <Link href="/comptabilite/comptes-caisses" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Comptes &amp; Caisses</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <Link href={`/comptabilite/comptes-caisses/${id}`} className="hover:text-gray-700 dark:hover:text-gray-200 transition truncate max-w-[180px]">
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
        <CompteCaisseForm
          mode="edit"
          initial={initial}
          loading={loading}
          serverError={serverError}
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/comptabilite/comptes-caisses/${id}`)}
        />
      )}
    </div>
  )
}
