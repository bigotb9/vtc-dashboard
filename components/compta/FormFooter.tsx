"use client"

/**
 * Footer actions du formulaire de saisie : Annuler / Brouillon / Valider.
 *
 * Boutons :
 *  - Annuler  : outline gris, ramène à la liste
 *  - Brouillon : outline ambre, sauvegarde sans générer d'écriture
 *  - Valider   : plein vert, sauvegarde ET génère l'écriture SYSCOHADA
 *
 * Référence : doc Phase 3 Écran 4 §3.5.
 */

import { X, Bookmark, Check, Info, Loader2 } from "lucide-react"

type Props = {
  loading?:       boolean
  canSaveDraft:   boolean
  canValidate:    boolean
  /** Liste lisible des champs manquants pour activer le bouton Brouillon. */
  missingForDraft?:    string[]
  /** Liste lisible des champs manquants pour activer le bouton Valider. */
  missingForValidate?: string[]
  onCancel:       () => void
  onSaveDraft:    () => void
  onValidate:     () => void
}

export function FormFooter({
  loading, canSaveDraft, canValidate,
  missingForDraft, missingForValidate,
  onCancel, onSaveDraft, onValidate,
}: Props) {
  const showMissing = !canValidate && missingForValidate && missingForValidate.length > 0
  return (
    <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-4 space-y-3">
      <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
        <Info size={12} className="text-gray-400 flex-shrink-0" />
        <span>
          <span className="font-semibold text-gray-700 dark:text-gray-300">Brouillon</span> = modifiable plus tard ·{" "}
          <span className="font-semibold text-gray-700 dark:text-gray-300">Valider</span> = écriture comptable créée
        </span>
      </div>

      {showMissing && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
          <span className="font-bold">Champs manquants :</span>{" "}
          {missingForValidate!.join(", ")}
          {!canSaveDraft && missingForDraft && missingForDraft.length > 0 && (
            <span className="text-amber-600/80 dark:text-amber-400/80">
              {" "}· brouillon nécessite : {missingForDraft.join(", ")}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition disabled:opacity-50"
        >
          <X size={14} /> Annuler
        </button>

        <button
          type="button"
          onClick={onSaveDraft}
          disabled={loading || !canSaveDraft}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50/60 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-sm font-semibold hover:bg-amber-100 dark:hover:bg-amber-500/15 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Bookmark size={14} />}
          Enregistrer brouillon
        </button>

        <button
          type="button"
          onClick={onValidate}
          disabled={loading || !canValidate}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-sm font-semibold shadow-md shadow-emerald-500/30 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Valider
        </button>
      </div>
    </div>
  )
}
