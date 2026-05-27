"use client"

/**
 * components/clients/UploadDocumentModal.tsx
 *
 * Modal d'upload d'un document client (E1).
 * Types acceptés : PDF, JPG, PNG, WebP (max 10 Mo).
 *
 * Extrait au Lot T (audit 27/05/2026) depuis app/clients/page.tsx.
 */

import { useState } from "react"
import { authFetch } from "@/lib/authFetch"
import ModalShell from "@/components/ModalShell"

type Props = {
  clientId:   number
  onClose:    () => void
  onUploaded: () => void
}

export default function UploadDocumentModal({ clientId, onClose, onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [type, setType] = useState<string>("contrat")
  const [notes, setNotes] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!file) { setError("Sélectionne un fichier"); return }
    setLoading(true); setError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", type)
      if (notes) formData.append("notes", notes)
      const res = await authFetch(`/api/clients/${clientId}/documents`, { method: "POST", body: formData })
      const d = await res.json()
      if (!d.ok) { setError(d.error || "Erreur"); return }
      onUploaded()
    } catch (e) {
      setError((e as Error).message)
    } finally { setLoading(false) }
  }

  return (
    <ModalShell
      open
      onClose={onClose}
      title="Ajouter un document"
      size="md"
      footer={
        <>
          <button onClick={onClose} disabled={loading} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#1E2D45] text-sm font-semibold text-gray-600 hover:bg-gray-50 dark:hover:bg-white/5 transition">
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={loading || !file}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white text-sm font-semibold transition shadow-sm">
            {loading ? "Upload..." : "Téléverser"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">Type</label>
          <select value={type} onChange={e => setType(e.target.value)} disabled={loading}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0D1424] border border-gray-200 dark:border-[#1E2D45] rounded-xl text-gray-700 dark:text-gray-300">
            <option value="contrat">Contrat</option>
            <option value="cni">CNI</option>
            <option value="carte_grise">Carte grise</option>
            <option value="assurance">Assurance</option>
            <option value="autre">Autre</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">Fichier (PDF, JPG, PNG, WebP - max 10 Mo)</label>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e => setFile(e.target.files?.[0] ?? null)} disabled={loading}
            className="w-full text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-600 file:font-semibold file:cursor-pointer hover:file:bg-indigo-100" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">Notes (optionnel)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} disabled={loading} rows={2}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0D1424] border border-gray-200 dark:border-[#1E2D45] rounded-xl text-gray-700 dark:text-gray-300" />
        </div>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    </ModalShell>
  )
}
