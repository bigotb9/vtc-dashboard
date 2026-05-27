"use client"

/**
 * Uploader de justificatifs (Phase 4.x Vague 3 §3.4.1).
 *
 * Fonctionnalités :
 *   - Drop-zone + bouton "Ajouter un fichier"
 *   - Multi-fichiers (max 5)
 *   - Validation client (mime + size avant upload)
 *   - Progress bar par fichier en cours d'upload
 *   - Suppression d'un upload réussi (soft delete via DELETE endpoint)
 *   - Sur mobile : input avec capture pour photo directe
 *
 * Pas d'overflow-hidden sur le wrapper (cohérent avec les conventions
 * V2 §4.4).
 */

import { useCallback, useRef, useState } from "react"
import { Paperclip, Upload, Loader2, X, File, Image as ImageIcon, AlertCircle } from "lucide-react"
import { authFetch } from "@/lib/authFetch"
import { toast } from "@/lib/toast"
import {
  JUSTIFICATIF_ACCEPT_ATTR,
  JUSTIFICATIF_ALLOWED_MIMES,
  JUSTIFICATIF_MAX_FILE_SIZE,
  JUSTIFICATIF_MAX_FILES,
  JUSTIFICATIF_MAX_TOTAL_SIZE,
} from "@/lib/compta/justificatifs/constants"
import type { JustificatifRef, JustificatifUploadResponse } from "@/types/compta-ui"

type Props = {
  operationId:   string | null
  /** Liste actuelle des justificatifs déjà attachés (re-fetch après upload). */
  items:         JustificatifRef[]
  /** Refresh callback (re-fetch la liste depuis le serveur). */
  onChange:      () => void
  /** UI plus compacte si true (mode formulaire). */
  compact?:      boolean
  /** Désactive l'upload (ex. opération annulée). */
  disabled?:     boolean
  /** Si true, étiquette "obligatoire" rouge sous le titre. */
  required?:     boolean
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} o`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} Ko`
  return `${(b / 1024 / 1024).toFixed(1)} Mo`
}

export function JustificatifsUploader({ operationId, items, onChange, compact, disabled, required }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState<Array<{ id: string; name: string; progress: number }>>([])

  const currentCount = items.length
  const currentTotal = items.reduce((a, i) => a + i.size_bytes, 0)
  const remainingFiles = Math.max(0, JUSTIFICATIF_MAX_FILES - currentCount)
  const remainingBytes = Math.max(0, JUSTIFICATIF_MAX_TOTAL_SIZE - currentTotal)

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    if (!operationId) {
      toast.error("Crée d'abord l'opération en brouillon, puis upload les justificatifs.")
      return
    }
    const arr = Array.from(files)
    if (arr.length === 0) return
    if (currentCount + arr.length > JUSTIFICATIF_MAX_FILES) {
      toast.error(`Limite atteinte (${JUSTIFICATIF_MAX_FILES} justificatifs maximum par opération)`)
      return
    }

    // Validation préalable côté client
    let runningTotal = currentTotal
    for (const f of arr) {
      if (!(JUSTIFICATIF_ALLOWED_MIMES as ReadonlyArray<string>).includes(f.type)) {
        toast.error(`Format non supporté pour "${f.name}" (PDF, JPG, PNG uniquement)`)
        return
      }
      if (f.size > JUSTIFICATIF_MAX_FILE_SIZE) {
        toast.error(`"${f.name}" trop volumineux (max ${JUSTIFICATIF_MAX_FILE_SIZE / 1024 / 1024} Mo)`)
        return
      }
      runningTotal += f.size
    }
    if (runningTotal > JUSTIFICATIF_MAX_TOTAL_SIZE) {
      toast.error(`Taille totale dépassée (${JUSTIFICATIF_MAX_TOTAL_SIZE / 1024 / 1024} Mo maximum par opération)`)
      return
    }

    // Upload séquentiel (évite de saturer la BP mobile)
    for (const f of arr) {
      const localId = Math.random().toString(36).slice(2)
      setUploading(prev => [...prev, { id: localId, name: f.name, progress: 10 }])
      try {
        const formData = new FormData()
        formData.append("file", f)
        const res = await authFetch(`/api/compta/operations/${operationId}/justificatifs`, {
          method: "POST",
          body:   formData,
        })
        setUploading(prev => prev.map(u => u.id === localId ? { ...u, progress: 80 } : u))
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast.error((json as { error?: string })?.error ?? `Upload ${f.name} : HTTP ${res.status}`)
        } else {
          void (json as { data: JustificatifUploadResponse }).data
        }
      } catch (e) {
        toast.error(`${f.name} : ${(e as Error).message}`)
      } finally {
        setUploading(prev => prev.filter(u => u.id !== localId))
      }
    }
    onChange()
  }, [operationId, currentCount, currentTotal, onChange])

  async function handleDelete(id: string, filename: string) {
    if (!confirm(`Supprimer "${filename}" ?`)) return
    const res = await authFetch(`/api/compta/justificatifs/${id}`, { method: "DELETE" })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      toast.error((j as { error?: string })?.error ?? `HTTP ${res.status}`)
      return
    }
    toast.success("Justificatif supprimé")
    onChange()
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Paperclip size={13} className="text-indigo-500" />
          <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-gray-600 dark:text-gray-300">
            Justificatifs
            {required && <span className="text-red-500 ml-1">(obligatoire)</span>}
          </span>
          {currentCount > 0 && (
            <span className="text-[10px] font-bold tabular-nums text-gray-400">
              {currentCount}/{JUSTIFICATIF_MAX_FILES}
            </span>
          )}
        </div>
        {remainingFiles > 0 && !disabled && operationId && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/10 transition"
          >
            <Upload size={11} /> Ajouter
          </button>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed transition ${
          dragging
            ? "border-indigo-500 bg-indigo-500/5"
            : "border-gray-200 dark:border-white/[0.08] bg-gray-50/50 dark:bg-white/[0.02]"
        } ${compact ? "p-3" : "p-4"} ${disabled ? "opacity-50" : ""}`}
      >
        {!operationId ? (
          <div className="text-center text-[12px] text-gray-500 dark:text-gray-400">
            <AlertCircle size={14} className="inline-block -mt-0.5 mr-1" />
            Enregistre d&apos;abord l&apos;opération en brouillon pour uploader des justificatifs.
          </div>
        ) : items.length === 0 && uploading.length === 0 ? (
          <div className="text-center">
            <Upload size={20} className="mx-auto text-gray-400" />
            <p className="mt-1.5 text-[12px] text-gray-500 dark:text-gray-400">
              Glisse un fichier ici, ou clique sur <strong className="text-indigo-600 dark:text-indigo-300">Ajouter</strong>
            </p>
            <p className="mt-0.5 text-[10.5px] text-gray-400">
              PDF, JPG, PNG · max {JUSTIFICATIF_MAX_FILE_SIZE / 1024 / 1024} Mo par fichier · {JUSTIFICATIF_MAX_FILES} fichiers max
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {items.map(j => {
              const isImg = j.mime_type === "image/jpeg" || j.mime_type === "image/png"
              const Icon = isImg ? ImageIcon : File
              return (
                <li key={j.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06]">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                    isImg ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" : "bg-red-500/15 text-red-600 dark:text-red-300"
                  }`}>
                    <Icon size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-gray-900 dark:text-white truncate">{j.filename}</div>
                    <div className="text-[10px] text-gray-400 dark:text-gray-500">
                      {formatBytes(j.size_bytes)} · {new Date(j.uploaded_at).toLocaleDateString("fr-FR")}
                      {j.uploaded_by_name && ` · par ${j.uploaded_by_name}`}
                    </div>
                  </div>
                  <a
                    href={`/api/compta/justificatifs/${j.id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-300 hover:underline shrink-0"
                  >
                    Voir
                  </a>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => handleDelete(j.id, j.filename)}
                      className="w-6 h-6 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-500/10 inline-flex items-center justify-center transition shrink-0"
                      title="Supprimer"
                    >
                      <X size={11} />
                    </button>
                  )}
                </li>
              )
            })}
            {uploading.map(u => (
              <li key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-indigo-500/5 border border-indigo-500/20">
                <Loader2 size={13} className="animate-spin text-indigo-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-gray-900 dark:text-white truncate">{u.name}</div>
                  <div className="h-1 mt-1 rounded bg-indigo-500/10 overflow-hidden">
                    <div className="h-full bg-indigo-500 transition-all" style={{ width: `${u.progress}%` }} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Hidden input */}
      <input
        ref={inputRef}
        type="file"
        accept={JUSTIFICATIF_ACCEPT_ATTR}
        multiple
        capture={undefined}
        onChange={e => { if (e.target.files) handleFiles(e.target.files); if (inputRef.current) inputRef.current.value = "" }}
        className="hidden"
      />

      {remainingBytes < JUSTIFICATIF_MAX_TOTAL_SIZE && (
        <p className="mt-1.5 text-[10px] text-gray-400 text-right">
          Reste : {formatBytes(remainingBytes)} sur {formatBytes(JUSTIFICATIF_MAX_TOTAL_SIZE)}
        </p>
      )}
    </div>
  )
}
