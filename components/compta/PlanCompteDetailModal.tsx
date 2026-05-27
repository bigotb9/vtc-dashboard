"use client"

/**
 * Modal de détail d'un compte SYSCOHADA (Écran 10 §4).
 * Header code+libellé · Section infos · Section usage cliquable · Footer Fermer.
 */

import { X, Loader2 } from "lucide-react"
import { CLASSE_TITLES, type SyscoClasse } from "@/components/compta/planComptableConstants"
import { PlanUsageBlock } from "@/components/compta/PlanUsageBlock"
import { usePlanCompteDetail } from "@/hooks/compta/usePlanCompteDetail"

type Props = {
  code:    string | null
  onClose: () => void
}

export function PlanCompteDetailModal({ code, onClose }: Props) {
  const { data, loading, error } = usePlanCompteDetail(code)

  if (!code) return null

  const totalUsage = data
    ? data.usage.caisses.length + data.usage.comptes.length + data.usage.categories.length
    : 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-[#1a1b1f] border border-gray-200 dark:border-white/[0.08] shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "85vh" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-200 dark:border-white/[0.06] flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {loading || !data ? (
              <div className="space-y-2">
                <div className="h-7 w-28 rounded bg-gray-100 dark:bg-white/[0.06] animate-pulse" />
                <div className="h-4 w-48 rounded bg-gray-100 dark:bg-white/[0.06] animate-pulse" />
              </div>
            ) : (
              <>
                <p className="font-mono text-xl font-black tracking-tight bg-violet-500/15 text-violet-700 dark:text-violet-300 inline-block px-2 py-1 rounded">
                  {data.code}
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1.5 truncate">
                  {data.libelle}
                </p>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 w-7 h-7 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.05] inline-flex items-center justify-center transition"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {error && !loading && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-700 dark:text-red-300">
              Erreur de chargement : {error}
            </div>
          )}

          {loading && !data && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 size={14} className="animate-spin" /> Chargement…
            </div>
          )}

          {data && (
            <>
              {/* Section Informations */}
              <section>
                <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400 mb-2">
                  Informations
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <Row label="Classe">
                    <span className="text-[12.5px] text-gray-900 dark:text-white">
                      Classe {data.classe} — {CLASSE_TITLES[data.classe as SyscoClasse]?.title ?? "—"}
                    </span>
                  </Row>
                  <Row label="Parent">
                    {data.parent ? (
                      <span className="font-mono text-[11.5px] bg-gray-100 dark:bg-white/[0.05] px-1.5 py-0.5 rounded">
                        {data.parent}
                      </span>
                    ) : <span className="text-gray-400">—</span>}
                  </Row>
                  <Row label="Ordre">
                    <span className="font-mono tabular-nums text-[12.5px] text-gray-900 dark:text-white">
                      {data.ordre}
                    </span>
                  </Row>
                  <Row label="Type">
                    {data.type_compte ? (
                      <span className="inline-block px-1.5 py-px rounded text-[10px] font-bold uppercase tracking-wider bg-violet-500/10 text-violet-600 dark:text-violet-400">
                        {data.type_compte}
                      </span>
                    ) : <span className="text-gray-400">—</span>}
                  </Row>
                </div>
              </section>

              {/* Section Usage */}
              <section>
                <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400 mb-3">
                  Utilisé par {totalUsage} entité{totalUsage > 1 ? "s" : ""}
                </p>
                {totalUsage === 0 ? (
                  <div className="rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-dashed border-gray-300 dark:border-white/[0.10] p-4 text-center">
                    <p className="text-[12.5px] text-gray-500 dark:text-gray-400">
                      Ce compte n&apos;est utilisé par aucune caisse, compte ou catégorie.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <PlanUsageBlock variant="caisse"    items={data.usage.caisses}    onLeave={onClose} />
                    <PlanUsageBlock variant="compte"    items={data.usage.comptes}    onLeave={onClose} />
                    <PlanUsageBlock variant="categorie" items={data.usage.categories} onLeave={onClose} />
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-200 dark:border-white/[0.06] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-100 dark:bg-white/[0.05] hover:bg-gray-200 dark:hover:bg-white/[0.08] text-sm font-semibold text-gray-700 dark:text-gray-300 transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9.5px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em] mb-1">{label}</p>
      {children}
    </div>
  )
}
