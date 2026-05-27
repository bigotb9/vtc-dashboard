"use client"

/**
 * Modal d'export PDF (Phase 4.x Vague 3.5 §2.2.7).
 *
 * Sélection de la période (préremplie depuis la période active de la page).
 * Click Générer → POST /api/compta/[kind]/export-pdf avec les filtres courants
 * + download automatique du blob.
 */

import { useEffect, useState } from "react"
import { FileDown, Loader2, X } from "lucide-react"
import { authFetch } from "@/lib/authFetch"
import { toast } from "@/lib/toast"
import type { FlowFilters, FlowKind } from "@/types/compta-ui"

type Props = {
  open:     boolean
  kind:     FlowKind
  filters:  FlowFilters           // période active (from/to) + filtres
  onClose:  () => void
}

export function ExportPdfModal({ open, kind, filters, onClose }: Props) {
  const [from, setFrom] = useState(filters.from ?? "")
  const [to,   setTo]   = useState(filters.to   ?? "")
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (open) {
      setFrom(filters.from ?? "")
      setTo(filters.to     ?? "")
    }
  }, [open, filters.from, filters.to])

  if (!open) return null

  const accentBg = kind === "depenses"
    ? "from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-red-500/30"
    : "from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-emerald-500/30"

  async function handleGenerate() {
    if (!from || !to || from > to) {
      toast.error("Période invalide.")
      return
    }
    setBusy(true)
    try {
      const res = await authFetch(`/api/compta/${kind}/export-pdf`, {
        method: "POST",
        body:   JSON.stringify({ from, to, filters }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error((j as { error?: string })?.error ?? `HTTP ${res.status}`)
        return
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a = document.createElement("a")
      const dispo = res.headers.get("Content-Disposition") ?? ""
      const m = /filename="([^"]+)"/.exec(dispo)
      a.href = url
      a.download = m?.[1] ?? `${kind}-${from}_to_${to}.pdf`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      toast.success(`${kind === "depenses" ? "Rapport dépenses" : "Rapport recettes"} téléchargé`)
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm"
         onClick={() => !busy && onClose()}>
      <div className="relative w-full max-w-md rounded-2xl bg-[#0D1424] border border-[#1E2D45] shadow-2xl p-5"
           onClick={e => e.stopPropagation()}>
        <button onClick={onClose} disabled={busy}
          className="absolute top-3 right-3 w-7 h-7 rounded-md text-gray-400 hover:text-gray-100 hover:bg-[#1A2235] inline-flex items-center justify-center transition disabled:opacity-50">
          <X size={14} />
        </button>
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${accentBg} flex items-center justify-center shadow-md flex-shrink-0`}>
            <FileDown size={17} className="text-white" />
          </div>
          <div>
            <h3 className="text-base font-black text-white">
              Exporter le rapport {kind === "depenses" ? "Dépenses" : "Recettes"}
            </h3>
            <p className="text-[12px] text-gray-400 mt-1 leading-snug">
              Le PDF reprend les filtres actuellement appliqués + la période ci-dessous.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-[10.5px] font-bold uppercase tracking-[0.12em] text-gray-400 mb-1.5">Du</label>
            <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)}
              className="w-full bg-[#1A2235] border border-[#1E2D45] rounded-lg px-2 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/40" />
          </div>
          <div>
            <label className="block text-[10.5px] font-bold uppercase tracking-[0.12em] text-gray-400 mb-1.5">Au</label>
            <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)}
              className="w-full bg-[#1A2235] border border-[#1E2D45] rounded-lg px-2 py-1.5 text-xs text-gray-200 font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/40" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} disabled={busy}
            className="px-3 py-2 rounded-xl text-sm font-semibold text-gray-300 hover:text-white hover:bg-[#1A2235] transition disabled:opacity-50">
            Annuler
          </button>
          <button onClick={handleGenerate} disabled={busy || !from || !to || from > to}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r ${accentBg} text-white text-sm font-semibold shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed`}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
            {busy ? "Génération…" : "Générer le PDF"}
          </button>
        </div>
      </div>
    </div>
  )
}
