"use client"

/**
 * Header de la page de détail — Écran 2 Phase 3 §2.3.
 *
 * Structure :
 *   - bouton retour (flèche) → router.back()
 *   - titre (libellé) + #id court + badge statut
 *   - sous-titre métadonnées
 *   - actions à droite selon statut (Valider/Modifier/Supprimer | Modifier/Annuler | Voir extourne)
 */

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Check, Pencil, Trash2, X as XIcon, Eye } from "lucide-react"
import type { OperationDetail, ExtourneRef } from "@/types/compta-ui"
import { OperationStatusBadge } from "./OperationStatusBadge"

const fmtDateTime = (s: string | null) => {
  if (!s) return ""
  const d = new Date(s)
  return Number.isNaN(d.getTime())
    ? s
    : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

type Props = {
  operation:    OperationDetail
  extourne:     ExtourneRef | null
  onValider:    () => void
  onAnnuler:    () => void
  onSupprimer:  () => void
  loading?:     false | "valider" | "annuler" | "supprimer"
}

export function OperationHeader({ operation, extourne, onValider, onAnnuler, onSupprimer, loading }: Props) {
  const router = useRouter()
  const idShort = operation.id.substring(0, 8)

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <Link href="/dashboard" className="hover:text-gray-700 dark:hover:text-gray-200 transition">
          Accueil
        </Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <Link href="/comptabilite" className="hover:text-gray-700 dark:hover:text-gray-200 transition">
          Comptabilité
        </Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <Link href="/comptabilite/operations" className="hover:text-gray-700 dark:hover:text-gray-200 transition">
          Opérations
        </Link>
        <span className="text-gray-300 dark:text-gray-700">/</span>
        <span className="text-gray-700 dark:text-gray-300 truncate max-w-[280px]">
          {operation.libelle}
        </span>
      </nav>

      <div className="flex items-start gap-3">
        {/* Bouton retour */}
        <button
          type="button"
          onClick={() => router.back()}
          title="Retour"
          className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] text-gray-500 hover:text-violet-500 hover:border-violet-300 dark:hover:border-violet-500/40 transition shadow-sm"
        >
          <ArrowLeft size={16} />
        </button>

        {/* Titre + métadonnées */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white leading-tight truncate">
              {operation.libelle}
            </h1>
            <code className="text-[11px] font-mono text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-white/[0.04] rounded px-1.5 py-0.5">
              #{idShort}
            </code>
            <OperationStatusBadge statut={operation.statut} />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
            Opération du <span className="text-gray-700 dark:text-gray-300 font-medium">{fmtDateTime(operation.date_operation)}</span>
            {operation.created_at && (
              <>
                {" · "}Créée le <span className="text-gray-700 dark:text-gray-300">{fmtDateTime(operation.created_at)}</span>
              </>
            )}
            {operation.created_by_name && (
              <>
                {" · "}par <span className="text-gray-700 dark:text-gray-300">{operation.created_by_name}</span>
              </>
            )}
          </p>
        </div>

        {/* Actions — selon statut */}
        <div className="flex items-center gap-2 flex-wrap justify-end flex-shrink-0">
          {operation.statut === "brouillon" && (
            <>
              <Btn
                onClick={onValider}
                variant="success"
                loading={loading === "valider"}
                Icon={Check}
                label="Valider"
              />
              <Btn
                onClick={() => { /* Écran 4 */ }}
                variant="outline"
                disabled
                title="Disponible Écran 4"
                Icon={Pencil}
                label="Modifier"
              />
              <Btn
                onClick={onSupprimer}
                variant="danger"
                loading={loading === "supprimer"}
                Icon={Trash2}
                label="Supprimer"
              />
            </>
          )}
          {operation.statut === "valide" && (
            <>
              <Btn
                onClick={() => { /* Écran 4 */ }}
                variant="outline"
                disabled
                title="Disponible Écran 4"
                Icon={Pencil}
                label="Modifier"
              />
              <Btn
                onClick={onAnnuler}
                variant="danger"
                loading={loading === "annuler"}
                Icon={XIcon}
                label="Annuler"
              />
            </>
          )}
          
        </div>
      </div>
    </div>
  )
}

// ─── Bouton ──────────────────────────────────────────────────────────────────

type Variant = "success" | "danger" | "outline"

function Btn({
  onClick, variant, Icon, label, loading, disabled, title,
}: {
  onClick:   () => void
  variant:   Variant
  Icon:      React.ElementType
  label:     string
  loading?:  boolean
  disabled?: boolean
  title?:    string
}) {
  const base = "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
  const styles: Record<Variant, string> = {
    success: "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md shadow-emerald-500/25",
    danger:  "bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-md shadow-red-500/25",
    outline: "border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04]",
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={`${base} ${styles[variant]}`}
    >
      {loading
        ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        : <Icon size={14} />}
      {label}
    </button>
  )
}
