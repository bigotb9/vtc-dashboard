"use client"

/**
 * Card "Justificatifs" sur la page détail opération (Phase 4.x Vague 3 §3.4.2).
 *
 * Lit /api/compta/operations/[id]/justificatifs au mount et présente :
 *   - Vignettes images PNG/JPG, icône PDF pour les PDFs
 *   - Click sur miniature → ouvre <JustificatifViewer>
 *   - Bouton "+ Ajouter" intégré (utilise JustificatifsUploader compact)
 *   - Indicateur "Ajouté par X le DD/MM"
 *
 * Pas d'overflow-hidden sur le wrapper.
 */

import { useCallback, useEffect, useState } from "react"
import { Paperclip, FileText, Image as ImageIcon, Plus } from "lucide-react"
import { JustificatifViewer } from "@/components/compta/JustificatifViewer"
import { JustificatifsUploader } from "@/components/compta/JustificatifsUploader"
import { authFetch } from "@/lib/authFetch"
import type { JustificatifRef } from "@/types/compta-ui"

type Props = {
  operationId:   string
  operationType: "entree" | "sortie"
  tiersLinked:   boolean        // true si tiers_id != null
  /** Si true, ouvre directement l'uploader (cas formulaire création). */
  uploaderOpen?: boolean
  /** Permet d'éditer (ajouter / supprimer). Sinon read-only. */
  editable?:     boolean
  /** Désactive édition (ex. op annulée). */
  disabled?:     boolean
}

function formatDateFr(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}

export function JustificatifsCard({
  operationId, operationType, tiersLinked,
  uploaderOpen, editable = true, disabled,
}: Props) {
  const [items,   setItems]   = useState<JustificatifRef[]>([])
  const [loading, setLoading] = useState(true)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerIdx,  setViewerIdx]  = useState(0)
  const [showUploader, setShowUploader] = useState(!!uploaderOpen)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch(`/api/compta/operations/${operationId}/justificatifs`)
      const json = await res.json().catch(() => ({}))
      const data = (json as { data?: JustificatifRef[] }).data ?? []
      setItems(data)
    } finally {
      setLoading(false)
    }
  }, [operationId])

  useEffect(() => { refetch() }, [refetch])

  const required = operationType === "sortie" && tiersLinked
  const empty = !loading && items.length === 0

  return (
    <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06]">
      <div className="h-1 bg-gradient-to-r from-indigo-500 to-violet-600" />
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/12 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
              <Paperclip size={13} />
            </div>
            <h3 className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
              Justificatifs
              {required && <span className="text-red-500 ml-1 normal-case">(obligatoire)</span>}
            </h3>
            {items.length > 0 && (
              <span className="text-[10px] font-bold tabular-nums text-gray-400">{items.length}</span>
            )}
          </div>
          {editable && !disabled && (
            <button
              type="button"
              onClick={() => setShowUploader(v => !v)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/10 transition"
            >
              <Plus size={11} /> {showUploader ? "Masquer" : "Ajouter / Gérer"}
            </button>
          )}
        </div>

        {loading && (
          <div className="space-y-1.5">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-9 rounded-md bg-gray-100 dark:bg-white/[0.04] animate-pulse" />
            ))}
          </div>
        )}

        {!loading && empty && !showUploader && (
          <p className="text-[12px] text-gray-500 dark:text-gray-400 italic">
            {required
              ? "Aucun justificatif. Une facture, un reçu ou une photo est requis pour cette opération."
              : "Aucun justificatif attaché à cette opération."}
          </p>
        )}

        {!loading && items.length > 0 && (
          <ul className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
            {items.map((j, i) => {
              const isImg = j.mime_type === "image/jpeg" || j.mime_type === "image/png"
              return (
                <li key={j.id}>
                  <button
                    type="button"
                    onClick={() => { setViewerIdx(i); setViewerOpen(true) }}
                    className="block w-full group relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.04] hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:shadow-md transition"
                    title={j.filename}
                  >
                    {isImg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={j.signed_url} alt={j.filename} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-red-500 dark:text-red-300">
                        <FileText size={26} strokeWidth={1.5} />
                        <span className="text-[9px] font-bold uppercase">PDF</span>
                      </div>
                    )}
                    {/* Overlay info au hover */}
                    <div className="absolute inset-x-0 bottom-0 px-1.5 py-1 bg-black/70 text-white text-[9px] leading-tight opacity-0 group-hover:opacity-100 transition">
                      <div className="truncate font-semibold">{j.filename}</div>
                      <div className="opacity-80">{formatDateFr(j.uploaded_at)}</div>
                    </div>
                    {isImg && (
                      <span className="absolute top-1 left-1 inline-flex items-center justify-center w-4 h-4 rounded bg-black/60 text-white">
                        <ImageIcon size={9} />
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {/* Uploader (cas édition / création) */}
        {showUploader && (
          <div className="pt-3 border-t border-gray-100 dark:border-white/[0.04]">
            <JustificatifsUploader
              operationId={operationId}
              items={items}
              onChange={refetch}
              required={required}
              disabled={disabled}
              compact
            />
          </div>
        )}

        <JustificatifViewer
          open={viewerOpen}
          items={items}
          index={viewerIdx}
          onClose={() => setViewerOpen(false)}
        />
      </div>
    </div>
  )
}
