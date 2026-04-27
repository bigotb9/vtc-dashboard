"use client"

import Link from "next/link"
import DashboardRefresh from "@/components/DashboardRefresh"
import { useProfile } from "@/hooks/useProfile"

export default function DashboardActions() {
  const { can, loading } = useProfile()
  if (loading) return <DashboardRefresh />

  return (
    <>
      {can("create_chauffeur") && (
        <Link href="/chauffeurs/create"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-white dark:bg-[#0D1424] border border-gray-200 dark:border-[#1E2D45] rounded-xl hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition shadow-sm">
          + Chauffeur
        </Link>
      )}
      {can("create_vehicle") && (
        <Link href="/vehicules/create"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-white dark:bg-[#0D1424] border border-gray-200 dark:border-[#1E2D45] rounded-xl hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition shadow-sm">
          + Véhicule
        </Link>
      )}
      {can("manage_recettes") && (
        <Link href="/recettes/create"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-sm shadow-indigo-500/25 ring-1 ring-indigo-500/30">
          + Recette
        </Link>
      )}
      <DashboardRefresh />
    </>
  )
}
