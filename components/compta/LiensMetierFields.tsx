"use client"

/**
 * 3 selects natifs Véhicule / Chauffeur / Client investisseur.
 * Tous optionnels. Si un véhicule est choisi et qu'un chauffeur est affecté
 * actuellement à ce véhicule, on l'affiche EN PREMIER de la liste (mais on
 * ne le sélectionne pas automatiquement).
 *
 * Référence : doc Phase 3 Écran 4 §3.2.
 */

import { useId } from "react"
import { Car, User, Briefcase } from "lucide-react"
import type { VehiculeFormRef, ChauffeurFormRef, ClientFormRef } from "@/types/compta-ui"

type Props = {
  vehicules:    VehiculeFormRef[]
  chauffeurs:   ChauffeurFormRef[]
  clients:      ClientFormRef[]
  vehiculeId:   number | null
  chauffeurId:  number | null
  clientId:     number | null
  onVehicule:   (id: number | null) => void
  onChauffeur:  (id: number | null) => void
  onClient:     (id: number | null) => void
  loading?:     boolean
}

function SelectShell({
  label, Icon, children,
}: {
  label: string
  Icon:  React.ElementType
  children: React.ReactNode
}) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em] mb-1.5 flex items-center gap-1.5">
        <Icon size={12} /> {label}
      </label>
      {children}
    </div>
  )
}

const selectClassName =
  "w-full rounded-xl border bg-white dark:bg-white/[0.02] border-gray-200/70 dark:border-white/[0.08] px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-400 hover:border-cyan-300 dark:hover:border-cyan-500/30 disabled:opacity-50"

export function LiensMetierFields({
  vehicules, chauffeurs, clients,
  vehiculeId, chauffeurId, clientId,
  onVehicule, onChauffeur, onClient,
  loading,
}: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      <SelectShell label="Véhicule" Icon={Car}>
        <select
          value={vehiculeId ?? ""}
          onChange={e => onVehicule(e.target.value ? Number(e.target.value) : null)}
          disabled={loading}
          className={selectClassName}
        >
          <option value="">— Aucun véhicule —</option>
          {vehicules.map(v => (
            <option key={v.id} value={v.id}>
              {v.immatriculation ?? `#${v.id}`}{v.type_vehicule ? ` · ${v.type_vehicule}` : ""}
            </option>
          ))}
        </select>
      </SelectShell>

      <SelectShell label="Chauffeur" Icon={User}>
        <select
          value={chauffeurId ?? ""}
          onChange={e => onChauffeur(e.target.value ? Number(e.target.value) : null)}
          disabled={loading}
          className={selectClassName}
        >
          <option value="">— Aucun chauffeur —</option>
          {chauffeurs.map(c => (
            <option key={c.id} value={c.id}>
              {c.nom ?? `#${c.id}`}{!c.actif ? " (inactif)" : ""}
            </option>
          ))}
        </select>
      </SelectShell>

      <SelectShell label="Client investisseur" Icon={Briefcase}>
        <select
          value={clientId ?? ""}
          onChange={e => onClient(e.target.value ? Number(e.target.value) : null)}
          disabled={loading}
          className={selectClassName}
        >
          <option value="">— Aucun client —</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>
              {c.nom ?? `#${c.id}`}
            </option>
          ))}
        </select>
      </SelectShell>
    </div>
  )
}
