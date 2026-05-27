"use client"

/**
 * LogoUploader — Drag-drop + preview du logo société (Phase 4.2 Module 1 §2.1.3).
 *
 * - Formats : PNG / JPG / SVG (max 2 Mo)
 * - Aperçu temps réel via signed URL
 * - Bouton "Supprimer le logo" → DELETE endpoint
 *
 * Pas d'overflow-hidden sur les wrappers.
 */

import { useRef, useState } from "react"
import { Image as ImageIcon, Upload, X, Loader2, AlertCircle } from "lucide-react"
import { authFetch } from "@/lib/authFetch"
import { toast } from "@/lib/toast"

const MAX_SIZE = 2 * 1024 * 1024
const ALLOWED  = ["image/png", "image/jpeg", "image/svg+xml"] as const
const ACCEPT   = ".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"

type Props = {
  currentSignedUrl: string | null
  hasLogo:          boolean
  onChange:         () => void          // refetch parent
  disabled?:        boolean
}

export function LogoUploader({ currentSignedUrl, hasLogo, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleFiles(files: FileList | File[]) {
    if (disabled) return
    const arr = Array.from(files)
    if (arr.length === 0) return
    const f = arr[0]
    if (!(ALLOWED as ReadonlyArray<string>).includes(f.type)) {
      toast.error("Format non supporté (PNG, JPG, SVG uniquement)")
      return
    }
    if (f.size > MAX_SIZE) {
      toast.error(`Fichier trop volumineux (max ${MAX_SIZE / 1024 / 1024} Mo)`)
      return
    }
    setBusy(true)
    try {
      const formData = new FormData()
      formData.append("file", f)
      const res = await authFetch("/api/compta/parametres-societe/logo", {
        method: "POST",
        body:   formData,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error((json as { error?: string })?.error ?? `HTTP ${res.status}`)
        return
      }
      toast.success("Logo uploadé")
      onChange()
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!hasLogo) return
    if (!confirm("Supprimer le logo de la société ?")) return
    setBusy(true)
    try {
      const res = await authFetch("/api/compta/parametres-societe/logo", { method: "DELETE" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error((json as { error?: string })?.error ?? `HTTP ${res.status}`)
        return
      }
      toast.success("Logo supprimé")
      onChange()
    } finally {
      setBusy(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    if (disabled || busy) return
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">Logo société</h3>
        {hasLogo && !disabled && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-red-600 dark:text-red-400 hover:bg-red-500/10 transition disabled:opacity-50"
          >
            <X size={11} /> Supprimer
          </button>
        )}
      </div>

      <div
        onDragOver={e => { e.preventDefault(); if (!disabled && !busy) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-2xl border-2 border-dashed transition p-5 flex items-center gap-4 ${
          dragging
            ? "border-indigo-500 bg-indigo-500/5"
            : "border-gray-200 dark:border-white/[0.08] bg-gray-50/50 dark:bg-white/[0.02]"
        } ${disabled ? "opacity-50" : ""}`}
      >
        {/* Preview */}
        <div className="w-28 h-28 rounded-xl bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.08] flex items-center justify-center shrink-0 overflow-hidden">
          {currentSignedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentSignedUrl} alt="Logo société" className="max-w-full max-h-full object-contain" />
          ) : (
            <ImageIcon size={32} className="text-gray-400" />
          )}
        </div>

        {/* Action */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            {hasLogo ? "Logo actuel" : "Aucun logo configuré"}
          </p>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
            PNG, JPG ou SVG · max {MAX_SIZE / 1024 / 1024} Mo · ratio ~3:1 recommandé pour le header PDF
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white text-xs font-semibold shadow-md shadow-indigo-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              {hasLogo ? "Remplacer" : "Uploader"}
            </button>
            <span className="text-[10.5px] text-gray-400">
              ou glisse un fichier ici
            </span>
          </div>
          {disabled && (
            <p className="mt-2 text-[10.5px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertCircle size={11} /> Enregistre d&apos;abord nom + raison sociale ci-dessus.
            </p>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={e => { if (e.target.files) handleFiles(e.target.files); if (inputRef.current) inputRef.current.value = "" }}
        className="hidden"
      />
    </div>
  )
}
