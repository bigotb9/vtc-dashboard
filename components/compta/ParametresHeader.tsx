"use client"

/**
 * Header de la page Paramètres (Écran 7 §2.1).
 * Icône settings + titre + sous-titre dynamique (mode + exercice).
 */

import { Settings } from "lucide-react"
import type { ParametresPayload } from "@/types/compta-ui"

type Props = {
  data:     ParametresPayload | null
  loading?: boolean
}

export function ParametresHeader({ data, loading }: Props) {
  const mode = data?.mode_actif
  const exercice = data?.exercice_courant.libelle

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30 flex-shrink-0">
          <Settings size={20} className="text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-none">
            Paramètres comptabilité
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
            {loading || !mode ? (
              <span className="text-gray-400">Chargement…</span>
            ) : (
              <>
                Mode actif :{" "}
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  mode === "avance"
                    ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 ring-1 ring-violet-500/20"
                    : "bg-gray-200 dark:bg-white/[0.08] text-gray-600 dark:text-gray-400"
                }`}>
                  {mode === "avance" ? "Avancé" : "Simple"}
                </span>
                {" "}· Exercice <span className="font-semibold text-gray-700 dark:text-gray-200">{exercice}</span>
                {data?.stats && (
                  <> · <span className="tabular-nums">{data.stats.nb_operations}</span> ops · <span className="tabular-nums">{data.stats.nb_ecritures}</span> écritures</>
                )}
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
