"use client"

/**
 * components/clients/SortirClientModal.tsx
 *
 * Modal de workflow de sortie d'un Client (E3) :
 *   - vérification prérequis (versements régularisés)
 *   - choix du sort des véhicules (hors_gestion / retirer / transferer)
 *   - génération auto du PDF "État des comptes à la sortie"
 *
 * Extrait au Lot T (audit 27/05/2026) depuis app/clients/page.tsx.
 */

import { useState } from "react"
import { AlertTriangle, Check, FileText } from "lucide-react"
import { authFetch } from "@/lib/authFetch"
import ModalShell from "@/components/ModalShell"
import type { Client } from "@/types/clients"

type Props = {
  client:    Client
  onClose:   () => void
  onSuccess: () => void
}

export default function SortirClientModal({ client, onClose, onSuccess }: Props) {
  const [sortVehicules, setSortVehicules] = useState<"hors_gestion" | "transferer" | "retirer">("hors_gestion")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [moisEnRetard, setMoisEnRetard] = useState<string[] | null>(null)
  const retards = client.retards_count ?? 0

  const handleConfirm = async () => {
    setLoading(true); setError(null); setMoisEnRetard(null)
    try {
      const res = await authFetch(`/api/clients/${client.id}/sortir`, {
        method: "POST",
        body: JSON.stringify({ sort_vehicules: sortVehicules }),
      })
      const d = await res.json()
      if (!d.ok) {
        setError(d.error || "Erreur")
        if (d.mois_en_retard) setMoisEnRetard(d.mois_en_retard)
        return
      }
      onSuccess()
    } catch (e) {
      setError((e as Error).message)
    } finally { setLoading(false) }
  }

  return (
    <ModalShell
      open
      onClose={onClose}
      title={`Sortir le Client — ${client.nom}`}
      subtitle="Workflow guidé de clôture"
      size="lg"
      footer={
        <>
          <button onClick={onClose} disabled={loading} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#1E2D45] text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition">
            Annuler
          </button>
          <button onClick={handleConfirm} disabled={loading || retards > 0}
            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold transition shadow-sm">
            {loading ? "Sortie en cours..." : "Confirmer la sortie"}
          </button>
        </>
      }
    >
      <div className="max-h-[70vh] overflow-y-auto">
        {/* Avertissement */}
        <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-3 mb-4">
          <p className="text-xs font-bold text-red-700 dark:text-red-400 flex items-center gap-1.5">
            <AlertTriangle size={12} />Action irréversible
          </p>
          <p className="text-xs text-red-600/80 dark:text-red-500/80 mt-1">
            Le Client sera archivé (soft-delete). Son historique reste consultable via la checkbox &quot;Inactifs&quot; mais il ne pourra plus recevoir de nouveaux versements.
          </p>
        </div>

        {/* Verification prerequis */}
        <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Vérification des prérequis</p>
        <div className="space-y-1.5 mb-4">
          {retards > 0 ? (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
              <AlertTriangle size={12} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400">{retards} versement{retards > 1 ? "s" : ""} en retard non régularisé{retards > 1 ? "s" : ""}</p>
                <p className="text-xs text-amber-600/80 dark:text-amber-500/80 mt-0.5">Régularise ces versements avant de pouvoir clôturer ce Client.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50/30 dark:bg-emerald-500/5">
              <Check size={11} className="text-emerald-500 flex-shrink-0" />
              <p className="text-xs text-gray-700 dark:text-gray-300">Tous les versements sont à jour</p>
            </div>
          )}
        </div>

        {/* Sort des vehicules */}
        <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Sort des {client.vehicules.length} véhicule{client.vehicules.length > 1 ? "s" : ""}
        </p>
        <select value={sortVehicules} onChange={e => setSortVehicules(e.target.value as "hors_gestion" | "transferer" | "retirer")}
          disabled={loading}
          className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0D1424] border border-gray-200 dark:border-[#1E2D45] rounded-xl text-gray-700 dark:text-gray-300 mb-4">
          <option value="hors_gestion">Marquer hors gestion (Boyah n&apos;exploite plus, mais véhicule reste au Client)</option>
          <option value="retirer">Retirer complètement (id_client = NULL, sous_gestion = FALSE)</option>
          <option value="transferer" disabled>Transférer à un autre Client (non disponible)</option>
        </select>

        {/* PDF mention */}
        <div className="rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 p-3 mb-4">
          <p className="text-xs text-indigo-700 dark:text-indigo-400">
            <FileText size={11} className="inline-block mr-1" />
            <strong>PDF &quot;État des comptes à la sortie&quot;</strong> sera généré automatiquement et archivé dans l&apos;onglet Documents.
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-3">
            <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
            {moisEnRetard && (
              <p className="text-[10px] text-red-600/80 mt-1">Mois concernés : {moisEnRetard.join(", ")}</p>
            )}
          </div>
        )}
      </div>
    </ModalShell>
  )
}
