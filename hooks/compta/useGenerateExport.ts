"use client"

/**
 * Hook de génération PDF (Phase 4).
 *
 * Expose :
 *   - generate(type, body) : POST /api/compta/exports/[type] et déclenche le
 *                            téléchargement du PDF côté navigateur.
 *   - preview(type, body)  : POST /api/compta/exports/[type]/preview et ouvre
 *                            le HTML dans un nouvel onglet.
 */

import { useCallback, useState } from "react"
import { authFetch } from "@/lib/authFetch"
import type { ExportType } from "@/types/compta-ui"

export interface ExportRequestBody {
  date_from:    string
  date_to:      string
  journaux?:    string[]
  caisses_ids?: string[]
}

export type ExportResult = {
  ok:        true
} | {
  ok:        false
  error:     string
  status?:   number
}

export function useGenerateExport() {
  const [loading, setLoading] = useState(false)
  const [currentType, setCurrentType] = useState<ExportType | null>(null)

  const generate = useCallback(async (type: ExportType, body: ExportRequestBody): Promise<ExportResult> => {
    setLoading(true)
    setCurrentType(type)
    try {
      const res = await authFetch(`/api/compta/exports/${type}`, {
        method: "POST",
        body:   JSON.stringify(body),
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => "")
        let parsed: { error?: string } = {}
        try { parsed = JSON.parse(txt) } catch { /* not JSON */ }
        return { ok: false, error: parsed?.error ?? txt ?? `HTTP ${res.status}`, status: res.status }
      }
      // Récupère le blob PDF
      const blob = await res.blob()
      // Récupère le nom de fichier depuis Content-Disposition si dispo
      const dispo = res.headers.get("Content-Disposition") ?? ""
      const match = /filename="([^"]+)"/i.exec(dispo)
      const filename = match?.[1] ?? `${type}.pdf`

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    } finally {
      setLoading(false)
      setCurrentType(null)
    }
  }, [])

  const preview = useCallback(async (type: ExportType, body: ExportRequestBody): Promise<ExportResult> => {
    setLoading(true)
    setCurrentType(type)
    try {
      const res = await authFetch(`/api/compta/exports/${type}/preview`, {
        method: "POST",
        body:   JSON.stringify(body),
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => "")
        let parsed: { error?: string } = {}
        try { parsed = JSON.parse(txt) } catch { /* not JSON */ }
        return { ok: false, error: parsed?.error ?? txt ?? `HTTP ${res.status}`, status: res.status }
      }
      const html = await res.text()
      const blob = new Blob([html], { type: "text/html;charset=utf-8" })
      const url  = URL.createObjectURL(blob)
      const w = window.open(url, "_blank", "noopener,noreferrer")
      if (!w) {
        return { ok: false, error: "Le navigateur a bloqué l'ouverture du nouvel onglet" }
      }
      // Ne pas revoke immédiatement, l'onglet est en train de charger.
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    } finally {
      setLoading(false)
      setCurrentType(null)
    }
  }, [])

  return { generate, preview, loading, currentType }
}
