"use client"

/**
 * Card "Liens métier" — Écran 2 Phase 3 §3.3.
 *
 * Affichée uniquement si au moins un lien existe (véhicule, chauffeur, client,
 * ou source non manuelle). La page parente est responsable de la condition.
 *
 * Liens cliquables vers /vehicules/[id], /chauffeurs/[id], /clients (si page),
 * tile "Données source" non navigable (juste info).
 */

import Link from "next/link"
import { Link2, Car, User, Users as UsersIcon, Database } from "lucide-react"
import type { OperationDetail } from "@/types/compta-ui"

const SOURCE_TABLE_LABELS: Record<string, string> = {
  recette_wave:      "Table versement_attribution",
  depense_vehicule:  "Table depenses_vehicules",
  versement_client:  "Table versements_clients",
  manuel:            "Saisie manuelle",
  import_csv:        "Import CSV",
  transfert_interne: "Table transferts_internes",
  dotation_amort:    "Dotation d'amortissement",
}

type Tile = {
  label:    string
  value:    string
  Icon:     React.ElementType
  bg:       string
  iconText: string
  href?:    string | null
}

type Props = { operation: OperationDetail }

export function LiensMetierCard({ operation }: Props) {
  const tiles: Tile[] = []

  if (operation.vehicule?.id != null) {
    tiles.push({
      label: "Véhicule",
      value: operation.vehicule.immatriculation ?? `Véh. #${operation.vehicule.id}`,
      Icon:  Car,
      bg:    "bg-cyan-500/10",
      iconText: "text-cyan-500",
      href:  `/vehicules/${operation.vehicule.id}`,
    })
  }
  if (operation.chauffeur?.id != null) {
    tiles.push({
      label: "Chauffeur",
      value: operation.chauffeur.nom ?? `Chauffeur #${operation.chauffeur.id}`,
      Icon:  User,
      bg:    "bg-violet-500/10",
      iconText: "text-violet-500",
      href:  `/chauffeurs/${operation.chauffeur.id}`,
    })
  }
  if (operation.client?.id != null) {
    tiles.push({
      label: "Client",
      value: operation.client.nom ?? `Client #${operation.client.id}`,
      Icon:  UsersIcon,
      bg:    "bg-pink-500/10",
      iconText: "text-pink-500",
      href:  null,   // /clients n'a pas (encore) de page de détail individuelle
    })
  }
  if (operation.source !== "manuel") {
    tiles.push({
      label: "Données source",
      value: SOURCE_TABLE_LABELS[operation.source] ?? operation.source,
      Icon:  Database,
      bg:    "bg-gray-500/10",
      iconText: "text-gray-500",
      href:  null,
    })
  }

  if (tiles.length === 0) return null

  return (
    <div className="relative rounded-2xl overflow-hidden bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] shadow-sm">
      {/* Liseré cyan */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />

      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100 dark:border-white/[0.04]">
        <span className="inline-flex w-8 h-8 rounded-lg items-center justify-center bg-cyan-500/10 text-cyan-500">
          <Link2 size={16} strokeWidth={2.5} />
        </span>
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 tracking-tight">
          Liens métier
        </h3>
      </div>

      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {tiles.map(t => {
          const inner = (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200/60 dark:border-white/[0.05] bg-gray-50/40 dark:bg-white/[0.02] hover:bg-gray-100/60 dark:hover:bg-white/[0.04] transition cursor-pointer h-full">
              <span className={`inline-flex w-10 h-10 rounded-lg items-center justify-center flex-shrink-0 ${t.bg} ${t.iconText}`}>
                <t.Icon size={18} strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t.label}</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{t.value}</p>
              </div>
            </div>
          )
          return t.href ? (
            <Link key={t.label} href={t.href}>{inner}</Link>
          ) : (
            <div key={t.label} className="cursor-default">{inner}</div>
          )
        })}
      </div>
    </div>
  )
}
