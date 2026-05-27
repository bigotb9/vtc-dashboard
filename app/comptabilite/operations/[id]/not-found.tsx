"use client"

/**
 * Page 404 — opération introuvable.
 * Activée par `notFound()` dans la page parent quand l'API retourne 404.
 */

import Link from "next/link"
import { FileX, ArrowLeft } from "lucide-react"

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="inline-flex w-16 h-16 rounded-2xl items-center justify-center bg-violet-500/10 text-violet-500 mb-4">
        <FileX size={32} strokeWidth={2} />
      </div>
      <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">
        Opération introuvable
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-md">
        Cette opération n&apos;existe pas, ou son ID est invalide. Elle a peut-être été
        supprimée définitivement (cas d&apos;un brouillon).
      </p>
      <Link
        href="/comptabilite/operations"
        className="mt-6 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white text-sm font-semibold shadow-md shadow-violet-500/25 transition"
      >
        <ArrowLeft size={14} />
        Retour à la liste
      </Link>
    </div>
  )
}
