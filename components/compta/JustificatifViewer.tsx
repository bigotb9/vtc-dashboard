"use client"

/**
 * Modal fullscreen pour visualiser un justificatif (Phase 4.x Vague 3 §3.4.3).
 *
 * - PDF : iframe vers la signed URL
 * - Image : <img> direct
 * - Navigation ← / → entre justificatifs si plusieurs
 * - Esc + clic backdrop pour fermer
 * - Bouton télécharger
 */

import { useEffect, useState, useCallback } from "react"
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react"
import type { JustificatifRef } from "@/types/compta-ui"

type Props = {
  open:     boolean
  items:    JustificatifRef[]
  /** Index initial à afficher. */
  index:    number
  onClose:  () => void
}

export function JustificatifViewer({ open, items, index, onClose }: Props) {
  const [cur, setCur] = useState(index)

  useEffect(() => { setCur(index) }, [index])

  // Esc + flèches clavier
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (!open) return
    if (e.key === "Escape") onClose()
    if (e.key === "ArrowLeft")  setCur(c => Math.max(0, c - 1))
    if (e.key === "ArrowRight") setCur(c => Math.min(items.length - 1, c + 1))
  }, [open, items.length, onClose])

  useEffect(() => {
    if (open) document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open, handleKey])

  if (!open || items.length === 0) return null
  const item = items[cur] ?? items[0]
  const isPdf = item.mime_type === "application/pdf"
  const isImg = item.mime_type === "image/jpeg" || item.mime_type === "image/png"

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Toolbar haut */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent z-10">
        <div className="text-white text-sm font-semibold truncate max-w-[60%]">
          {item.filename}
          {items.length > 1 && (
            <span className="ml-2 text-white/60 text-xs tabular-nums">
              {cur + 1} / {items.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/compta/justificatifs/${item.id}/download`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur transition"
            title="Télécharger"
          >
            <Download size={12} /> Télécharger
          </a>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onClose() }}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white inline-flex items-center justify-center transition"
            title="Fermer (Esc)"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Navigation gauche / droite */}
      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setCur(c => Math.max(0, c - 1)) }}
            disabled={cur === 0}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white inline-flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed z-10"
            title="Précédent (←)"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setCur(c => Math.min(items.length - 1, c + 1)) }}
            disabled={cur === items.length - 1}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white inline-flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed z-10"
            title="Suivant (→)"
          >
            <ChevronRight size={18} />
          </button>
        </>
      )}

      {/* Contenu */}
      <div
        className="relative max-w-[92vw] max-h-[88vh] w-full h-full flex items-center justify-center"
        onClick={e => e.stopPropagation()}
      >
        {isPdf && (
          <iframe
            src={item.signed_url}
            className="w-full h-full rounded-lg bg-white shadow-2xl"
            title={item.filename}
          />
        )}
        {isImg && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.signed_url}
            alt={item.filename}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        )}
        {!isPdf && !isImg && (
          <div className="bg-white p-8 rounded-lg text-center">
            <p className="text-gray-700">Format non prévisualisable.</p>
            <a
              href={`/api/compta/justificatifs/${item.id}/download`}
              className="inline-flex mt-3 px-3 py-2 rounded-lg bg-indigo-500 text-white text-sm font-semibold"
            >
              Télécharger
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
