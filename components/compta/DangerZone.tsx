"use client"

/**
 * Danger zone d'une caisse/compte (Écran 5 Phase 3 §3.7).
 *
 * Affiche :
 *  - bouton Désactiver si actif=true
 *  - bouton Réactiver si actif=false (et solde≠0 OU mouvements>0)
 *  - bouton Supprimer rouge si actif=false ET solde=0 ET nb_mouvements=0
 *
 * Chaque action est confirmée par une modale.
 */

import { useState } from "react"
import { AlertTriangle, Power, Trash2, PowerOff, Loader2, X } from "lucide-react"
import type { ComptesCaissesDetail } from "@/types/compta-ui"

type Props = {
  detail:        ComptesCaissesDetail
  loading?:      boolean
  onDeactivate:  () => Promise<void> | void
  onReactivate:  () => Promise<void> | void
  onDelete:      () => Promise<void> | void
}

type ModalKind = "deactivate" | "reactivate" | "delete" | null

export function DangerZone({ detail, loading, onDeactivate, onReactivate, onDelete }: Props) {
  const [modal, setModal] = useState<ModalKind>(null)
  const [busy, setBusy] = useState(false)

  const canDelete = !detail.actif && detail.solde === 0 && detail.nb_mouvements === 0

  async function handleConfirm() {
    setBusy(true)
    try {
      if (modal === "deactivate") await onDeactivate()
      else if (modal === "reactivate") await onReactivate()
      else if (modal === "delete") await onDelete()
      setModal(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="rounded-2xl bg-red-500/5 dark:bg-red-500/[0.06] border border-red-500/20 p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white shadow-md shadow-red-500/30 flex-shrink-0">
            <AlertTriangle size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-red-700 dark:text-red-300">Actions sensibles</h3>
            <p className="text-[11.5px] text-red-600/80 dark:text-red-400/80 mt-1">
              {detail.actif
                ? "Désactiver masquera ce contenant dans les sélecteurs sans perdre les données."
                : canDelete
                  ? "Cette caisse est inactive et sans mouvement. Suppression définitive possible."
                  : `Cette ${detail.type_cible} contient ${detail.nb_mouvements} mouvement${detail.nb_mouvements > 1 ? "s" : ""} et un solde de ${Math.round(detail.solde).toLocaleString("fr-FR")} F. Suppression impossible.`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {detail.actif ? (
            <button
              type="button"
              onClick={() => setModal("deactivate")}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-300 dark:border-red-500/40 bg-white dark:bg-white/[0.02] text-red-700 dark:text-red-300 text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-500/10 transition disabled:opacity-50"
            >
              <PowerOff size={14} /> Désactiver
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setModal("reactivate")}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-300 dark:border-emerald-500/40 bg-white dark:bg-white/[0.02] text-emerald-700 dark:text-emerald-300 text-sm font-semibold hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition disabled:opacity-50"
            >
              <Power size={14} /> Réactiver
            </button>
          )}

          {canDelete && (
            <button
              type="button"
              onClick={() => setModal("delete")}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white text-sm font-semibold shadow-md shadow-red-500/30 transition disabled:opacity-50"
            >
              <Trash2 size={14} /> Supprimer
            </button>
          )}
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !busy && setModal(null)}>
          <div
            className="relative w-full max-w-md rounded-2xl bg-white dark:bg-[#1a1b1f] border border-gray-200 dark:border-white/[0.08] shadow-2xl p-5"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => !busy && setModal(null)}
              className="absolute top-3 right-3 w-7 h-7 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.05] inline-flex items-center justify-center transition disabled:opacity-50"
              disabled={busy}
            >
              <X size={14} />
            </button>

            <div className="flex items-start gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md flex-shrink-0 ${
                modal === "delete"
                  ? "bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/30"
                  : modal === "deactivate"
                    ? "bg-gradient-to-br from-amber-500 to-orange-500 shadow-amber-500/30"
                    : "bg-gradient-to-br from-emerald-500 to-teal-500 shadow-emerald-500/30"
              }`}>
                {modal === "delete" ? <Trash2 size={17} /> : modal === "deactivate" ? <PowerOff size={17} /> : <Power size={17} />}
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900 dark:text-white">
                  {modal === "delete" ? "Supprimer définitivement ?" : modal === "deactivate" ? "Désactiver cette " + detail.type_cible + " ?" : "Réactiver cette " + detail.type_cible + " ?"}
                </h3>
                <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">
                  {modal === "delete"
                    ? `« ${detail.libelle} » sera supprimée sans possibilité de retour.`
                    : modal === "deactivate"
                      ? `« ${detail.libelle} » sera masquée dans les sélecteurs. Vous pourrez la réactiver à tout moment.`
                      : `« ${detail.libelle} » redeviendra disponible dans les sélecteurs.`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setModal(null)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={busy}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold shadow-md transition disabled:opacity-50 ${
                  modal === "delete"
                    ? "bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-red-500/30"
                    : modal === "deactivate"
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/30"
                      : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-emerald-500/30"
                }`}
              >
                {busy && <Loader2 size={14} className="animate-spin" />}
                {modal === "delete" ? "Supprimer" : modal === "deactivate" ? "Désactiver" : "Réactiver"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
