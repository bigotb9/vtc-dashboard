"use client"

/**
 * Header de la page formulaire de saisie d'opération (Écran 4 Phase 3).
 * Breadcrumb + bouton retour + titre + sous-titre.
 *
 * Référence : doc Phase 3 Écran 4 §2.1.
 */

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, FilePlus } from "lucide-react"

type Props = {
  /** Si fourni, sous-titre additionnel (ex. "Mode Avancé"). */
  subtitle?: string
}

export function OperationFormHeader({ subtitle }: Props) {
  const router = useRouter()
  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <Link href="/dashboard" className="hover:text-gray-700 dark:hover:text-gray-200 transition">
          Accueil
        </Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <Link href="/comptabilite" className="hover:text-gray-700 dark:hover:text-gray-200 transition">
          Comptabilité
        </Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <Link href="/comptabilite/operations" className="hover:text-gray-700 dark:hover:text-gray-200 transition">
          Opérations
        </Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <span className="text-gray-700 dark:text-gray-300">Nouvelle opération</span>
      </nav>

      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          title="Retour"
          className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] text-gray-500 hover:text-violet-500 hover:border-violet-300 dark:hover:border-violet-500/40 transition shadow-sm"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 flex-shrink-0">
          <FilePlus size={20} className="text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-none">
            Nouvelle opération
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
            Saisie manuelle{subtitle ? ` · ${subtitle}` : ""}
          </p>
        </div>
      </div>
    </div>
  )
}
