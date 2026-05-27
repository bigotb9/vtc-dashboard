"use client"

/**
 * /comptabilite/parametres-societe — Configuration tenant (Phase 4.2 Module 1).
 *
 * 4 sections orchestrées : Identité commerciale, Informations légales,
 * Exercice par défaut, Logo. Le LogoUploader est rendu en parallèle du
 * formulaire texte (les 2 endpoints sont indépendants).
 */

export const dynamic = "force-dynamic"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Building2 } from "lucide-react"
import { IdentiteForm } from "@/components/compta/societe/IdentiteForm"
import { LogoUploader } from "@/components/compta/societe/LogoUploader"
import { authFetch } from "@/lib/authFetch"
import { toast } from "@/lib/toast"
import type { SocieteParametres, SocieteParametresPayload } from "@/types/compta-ui"

export default function ParametresSocietePage() {
  const [data,    setData]    = useState<SocieteParametres | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await authFetch("/api/compta/parametres-societe")
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((json as { error?: string })?.error ?? `HTTP ${res.status}`)
        return
      }
      setData((json as { data: SocieteParametres | null }).data ?? null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refetch() }, [refetch])

  async function handleSubmit(payload: SocieteParametresPayload) {
    setSaving(true)
    try {
      const res  = await authFetch("/api/compta/parametres-societe", {
        method: "PUT",
        body:   JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error((json as { error?: string })?.error ?? `HTTP ${res.status}`)
        return
      }
      toast.success("Paramètres enregistrés")
      setData((json as { data: SocieteParametres }).data)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <Link href="/dashboard" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Accueil</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <Link href="/comptabilite" className="hover:text-gray-700 dark:hover:text-gray-200 transition">Comptabilité</Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <span className="text-gray-700 dark:text-gray-300">Paramètres société</span>
      </nav>

      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
          <Building2 size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-none">
            Paramètres société
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
            Identité légale + logo utilisés sur tous les PDF officiels (Grand Livre, Balance, Bilan, CR, fiche tiers…).
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-700 dark:text-red-300">
          Erreur : {error}.{" "}
          <button onClick={() => refetch()} className="font-semibold underline">Réessayer</button>
        </div>
      )}

      {loading && !data && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] animate-pulse" />
          ))}
        </div>
      )}

      {(!loading || data) && (
        <>
          <IdentiteForm initial={data} loading={saving} onSubmit={handleSubmit} />

          <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-4">
            <LogoUploader
              currentSignedUrl={data?.logo_signed_url ?? null}
              hasLogo={!!data?.logo_storage_path}
              onChange={refetch}
              disabled={!data}
            />
          </div>
        </>
      )}
    </div>
  )
}
