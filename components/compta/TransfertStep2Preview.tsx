"use client"

/**
 * Étape 2 du wizard transfert interne (Phase 4.x Vague 1 §3.4).
 *
 * Affiche :
 *   - bloc visuel DEPUIS → VERS + montant
 *   - libellé éditable une dernière fois
 *   - preview SYSCOHADA (calculée serveur via /transferts/preview)
 *
 * Le parent fournit la `preview` calculée + sait gérer le bouton Confirmer.
 */

import { FileText } from "lucide-react"
import { TransfertVisualBlock } from "@/components/compta/TransfertVisualBlock"
import { TransfertSyscohadaPreview } from "@/components/compta/TransfertSyscohadaPreview"
import type { TransfertDestinationItem, TransfertPreview } from "@/types/compta-ui"

type Props = {
  source:  TransfertDestinationItem
  dest:    TransfertDestinationItem
  montant: number

  libelle:         string
  onLibelleChange: (s: string) => void

  preview:        TransfertPreview | null
  previewLoading: boolean
  previewError:   string | null
}

export function TransfertStep2Preview({
  source, dest, montant,
  libelle, onLibelleChange,
  preview, previewLoading, previewError,
}: Props) {
  return (
    <div className="space-y-4">
      {/* Bloc visuel */}
      <TransfertVisualBlock
        source={{
          libelle:        source.libelle,
          code:           source.code,
          syscohada_code: source.syscohada_code,
        }}
        dest={{
          libelle:        dest.libelle,
          code:           dest.code,
          syscohada_code: dest.syscohada_code,
        }}
        montant={montant}
      />

      {/* Libellé éditable */}
      <div>
        <label className="block text-[10.5px] font-bold uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400 mb-1.5">
          <FileText size={11} className="inline -mt-0.5 mr-1" />
          Libellé final
        </label>
        <input
          type="text"
          value={libelle}
          maxLength={255}
          onChange={e => onLibelleChange(e.target.value)}
          placeholder={preview?.libelle ?? `Transfert interne : ${source.libelle} → ${dest.libelle}`}
          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60 transition"
        />
      </div>

      {/* Preview SYSCOHADA */}
      <TransfertSyscohadaPreview
        preview={preview}
        loading={previewLoading}
        error={previewError}
      />
    </div>
  )
}
