"use client"

/**
 * Encart de rétroaction "Tiers" sur la page détail opération (Écran 2)
 * — Phase 4.x Vague 2 §5.2.
 *
 * Affiche :
 *   - Tiers actuellement lié (s'il y en a un) avec lien vers la fiche
 *   - Bouton "Lier un tiers" / "Changer" qui ouvre le TiersSelector
 *   - Bouton "Délier" pour retirer la liaison
 *
 * Compatible avec les opérations validées / annulées / reprise (PATCH spécial
 * tiers_id-only accepté par le backend).
 */

import { useState } from "react"
import Link from "next/link"
import { Users, X, Loader2, Pencil } from "lucide-react"
import { TiersTypeBadge } from "@/components/compta/TiersTypeBadge"
import { TiersSelector } from "@/components/compta/TiersSelector"
import { authFetch } from "@/lib/authFetch"
import { toast } from "@/lib/toast"
import type { TiersRef, TiersType, TypeOperation } from "@/types/compta-ui"

type Props = {
  operationId:  string
  operationType: TypeOperation
  tiers:        TiersRef | null
  onChanged:    () => void                      // refetch parent
}

export function TiersRetroactionCard({ operationId, operationType, tiers, onChanged }: Props) {
  const [editing, setEditing] = useState(false)
  const [saving,  setSaving]  = useState(false)

  async function patchTiers(nextId: string | null) {
    setSaving(true)
    try {
      const res = await authFetch(`/api/compta/operations/${operationId}`, {
        method: "PATCH",
        body:   JSON.stringify({ tiers_id: nextId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error((json as { error?: string })?.error ?? `HTTP ${res.status}`)
        return
      }
      toast.success(nextId ? "Tiers lié à l'opération" : "Tiers délié")
      setEditing(false)
      onChanged()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const allowedTypes: TiersType[] = operationType === "entree"
    ? ["client", "autre"]
    : ["fournisseur", "salarie", "autre"]
  const defaultNewType: TiersType = operationType === "entree" ? "client" : "fournisseur"

  return (
    <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06]">
      <div className="h-1 bg-gradient-to-r from-indigo-500 to-violet-600" />
      <div className="p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/12 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Users size={13} />
            </div>
            <h3 className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
              Tiers lié
            </h3>
          </div>
          {!editing && tiers && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={saving}
              className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50 inline-flex items-center gap-1"
            >
              <Pencil size={10} /> Changer
            </button>
          )}
          {!editing && !tiers && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={saving}
              className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
            >
              + Lier un tiers
            </button>
          )}
        </div>

        {editing && (
          <div className="space-y-2">
            <TiersSelector
              value={tiers?.id ?? null}
              onChange={(id) => patchTiers(id)}
              allowedTypes={allowedTypes}
              defaultNewType={defaultNewType}
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
                className="px-2 py-1 rounded-md text-[11px] font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition disabled:opacity-50"
              >
                Annuler
              </button>
              {tiers && (
                <button
                  type="button"
                  onClick={() => patchTiers(null)}
                  disabled={saving}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10 transition disabled:opacity-50"
                >
                  {saving ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
                  Délier
                </button>
              )}
            </div>
          </div>
        )}

        {!editing && tiers && (
          <Link
            href={`/comptabilite/tiers/${tiers.id}`}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-indigo-500/5 transition"
          >
            <TiersTypeBadge type={tiers.type} size="xs" />
            <span className="font-bold text-gray-900 dark:text-white truncate flex-1">{tiers.nom}</span>
            <span className="text-[10px] font-mono bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1.5 py-px rounded shrink-0">
              {tiers.compte_syscohada_code}
            </span>
            {!tiers.actif && (
              <span className="text-[9px] font-bold uppercase tracking-wider bg-gray-200 dark:bg-white/[0.08] text-gray-600 dark:text-gray-400 px-1 py-px rounded shrink-0">
                Désactivé
              </span>
            )}
          </Link>
        )}

        {!editing && !tiers && (
          <p className="text-[12px] text-gray-500 dark:text-gray-400 italic">
            Aucun tiers rattaché.
            Lie cette opération à un fournisseur / salarié / client pour suivre les flux par contrepartie.
          </p>
        )}
      </div>
    </div>
  )
}
