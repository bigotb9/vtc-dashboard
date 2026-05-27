"use client"

/**
 * Barre de filtres de la liste opérations.
 * Référence : doc Phase 3 Écran 1 §4.2 + §6.1.
 *
 * Filtres :
 *   - Search libre (debounced 300ms par le hook useOperations)
 *   - Type (entree / sortie)
 *   - Source (recette_wave / depense_vehicule / versement_client / manuel)
 *   - Statut (valide / brouillon / annule — multi)
 *   - Catégorie (dropdown chargé via /api/compta/categories)
 *   - Chips actifs (suppression individuelle + reset global)
 */

import { useEffect, useState } from "react"
import { Search, ChevronDown, X } from "lucide-react"
import { authFetch } from "@/lib/authFetch"
import type { OperationsFilters, SourceOperation, StatutOperation, TypeOperation } from "@/types/compta-ui"

type Categorie = { id: string; libelle: string; type: string }
type TiersOpt   = { id: string; libelle: string; compte_syscohada_code: string }

type Props = {
  filters:   OperationsFilters
  onChange:  (next: OperationsFilters) => void
  onReset:   () => void
}

const TYPE_OPTIONS: { value: TypeOperation; label: string }[] = [
  { value: "entree", label: "Entrée" },
  { value: "sortie", label: "Sortie" },
]
const SOURCE_OPTIONS: { value: SourceOperation; label: string }[] = [
  { value: "recette_wave",      label: "Recette Wave" },
  { value: "depense_vehicule",  label: "Dépense véhicule" },
  { value: "versement_client",  label: "Versement client" },
  { value: "manuel",            label: "Manuelle" },
]
const STATUT_OPTIONS: { value: StatutOperation; label: string }[] = [
  { value: "valide",     label: "Validé" },
  { value: "brouillon",  label: "Brouillon" },
  { value: "annule",     label: "Annulé" },
]

export function OperationsFilters({ filters, onChange, onReset }: Props) {
  const [searchLocal, setSearchLocal] = useState(filters.search ?? "")
  const [categories,  setCategories]  = useState<Categorie[]>([])
  // Phase 4.x Vague 2 correctif §2.2 — liste des tiers pour le dropdown filtre
  const [tiersOpts,   setTiersOpts]   = useState<TiersOpt[]>([])

  // Sync local search ⟶ filters (le debounce est dans le hook qui consomme filters)
  useEffect(() => {
    setSearchLocal(filters.search ?? "")
  }, [filters.search])

  // Charge catégories + tiers au montage
  useEffect(() => {
    authFetch("/api/compta/categories?actif=true&avec_mapping=false")
      .then(r => r.json())
      .then(j => setCategories(Array.isArray(j.data) ? j.data : []))
      .catch(() => setCategories([]))
    authFetch("/api/compta/tiers?actifs_only=true&page_size=200")
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        const arr = (j?.data?.data ?? []) as Array<{ id: string; nom: string; compte_syscohada_code: string }>
        setTiersOpts(arr.map(t => ({ id: t.id, libelle: t.nom, compte_syscohada_code: t.compte_syscohada_code })))
      })
      .catch(() => setTiersOpts([]))
  }, [])

  // ─── Chips actifs ─────────────────────────────────────────────────────────
  const chips: { key: string; label: string; remove: () => void }[] = []
  if (filters.type)
    chips.push({ key: "type", label: `Type: ${filters.type}`, remove: () => onChange({ ...filters, type: undefined }) })
  if (filters.source) {
    const src = SOURCE_OPTIONS.find(s => s.value === filters.source)?.label ?? filters.source
    chips.push({ key: "source", label: `Source: ${src}`, remove: () => onChange({ ...filters, source: undefined }) })
  }
  if (filters.statuts && filters.statuts.length > 0)
    chips.push({
      key: "statuts",
      label: `Statut: ${filters.statuts.join(", ")}`,
      remove: () => onChange({ ...filters, statuts: undefined }),
    })
  if (filters.categorie_id) {
    const cat = categories.find(c => c.id === filters.categorie_id)?.libelle ?? "catégorie"
    chips.push({ key: "cat", label: `Catégorie: ${cat}`, remove: () => onChange({ ...filters, categorie_id: undefined }) })
  }
  // Phase 4.x Vague 2 correctif §2.2 — chip Tiers
  if (filters.tiers_ids && filters.tiers_ids.length > 0) {
    const names = filters.tiers_ids
      .map(id => tiersOpts.find(t => t.id === id)?.libelle ?? "tiers")
      .join(", ")
    chips.push({
      key: "tiers",
      label: `Tiers: ${names}`,
      remove: () => onChange({ ...filters, tiers_ids: undefined }),
    })
  }
  if (filters.date_from || filters.date_to)
    chips.push({
      key: "date",
      label: `Date: ${filters.date_from ?? "—"} → ${filters.date_to ?? "—"}`,
      remove: () => onChange({ ...filters, date_from: undefined, date_to: undefined }),
    })

  return (
    <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-4 space-y-3">

      {/* Ligne 1 : Recherche + selects */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Recherche libre */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchLocal}
            onChange={e => {
              setSearchLocal(e.target.value)
              onChange({ ...filters, search: e.target.value || undefined, page: 1 })
            }}
            placeholder="Rechercher dans les libellés…"
            className="w-full bg-gray-50 dark:bg-white/[0.04] border border-gray-200/70 dark:border-white/[0.08] text-gray-900 dark:text-gray-100 placeholder:text-gray-400 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition"
          />
        </div>

        {/* Type */}
        <SelectChip
          value={filters.type ?? ""}
          onChange={v => onChange({ ...filters, type: (v as TypeOperation) || undefined, page: 1 })}
          placeholder="Type"
          options={TYPE_OPTIONS}
        />

        {/* Source */}
        <SelectChip
          value={filters.source ?? ""}
          onChange={v => onChange({ ...filters, source: (v as SourceOperation) || undefined, page: 1 })}
          placeholder="Source"
          options={SOURCE_OPTIONS}
        />

        {/* Statut (single-select pour l'instant — on stocke en tableau pour compat API) */}
        <SelectChip
          value={(filters.statuts && filters.statuts[0]) ?? ""}
          onChange={v => onChange({
            ...filters,
            statuts: v ? [v as StatutOperation] : undefined,
            page: 1,
          })}
          placeholder="Statut"
          options={STATUT_OPTIONS}
        />

        {/* Catégorie */}
        <SelectChip
          value={filters.categorie_id ?? ""}
          onChange={v => onChange({ ...filters, categorie_id: v || undefined, page: 1 })}
          placeholder="Catégorie"
          options={categories.map(c => ({ value: c.id, label: c.libelle }))}
        />

        {/* Phase 4.x Vague 2 correctif §2.2 — Tiers (single-select, stocké en array) */}
        <SelectChip
          value={filters.tiers_ids && filters.tiers_ids[0] ? filters.tiers_ids[0] : ""}
          onChange={v => onChange({ ...filters, tiers_ids: v ? [v] : undefined, page: 1 })}
          placeholder="Tiers"
          options={tiersOpts.map(t => ({ value: t.id, label: `${t.libelle} · ${t.compte_syscohada_code}` }))}
        />
      </div>

      {/* Ligne 2 : Chips actifs */}
      {chips.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-gray-100 dark:border-white/[0.04]">
          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {chips.length} filtre{chips.length > 1 ? "s" : ""} actif{chips.length > 1 ? "s" : ""} ·
          </span>

          {chips.map(c => (
            <span
              key={c.key}
              className="inline-flex items-center gap-0.5 pl-2 pr-1 py-0.5 rounded-md text-xs font-medium bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/20"
            >
              {c.label}
              <button
                type="button"
                onClick={c.remove}
                aria-label={`Retirer le filtre ${c.key}`}
                title={`Retirer le filtre ${c.key}`}
                className="inline-flex items-center justify-center w-4 h-4 rounded-sm opacity-60 hover:opacity-100 hover:bg-violet-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:opacity-100 transition cursor-pointer"
              >
                <X size={11} strokeWidth={2.5} />
              </button>
            </span>
          ))}

          <button
            type="button"
            onClick={onReset}
            className="ml-auto text-xs font-semibold text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 underline underline-offset-2 decoration-violet-400/40 hover:decoration-violet-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded transition cursor-pointer"
          >
            Tout réinitialiser
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Sous-composant SelectChip ───────────────────────────────────────────────

function SelectChip({
  value, onChange, placeholder, options,
}: {
  value:        string
  onChange:     (v: string) => void
  placeholder:  string
  options:      { value: string; label: string }[]
}) {
  const hasValue = value !== ""
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`appearance-none pr-8 pl-3 py-2 rounded-xl text-sm border transition focus:outline-none focus:ring-2 focus:ring-violet-500/40 cursor-pointer ${
          hasValue
            ? "bg-violet-500/10 dark:bg-violet-500/15 border-violet-500/20 text-violet-700 dark:text-violet-200 font-semibold"
            : "bg-gray-50 dark:bg-white/[0.04] border-gray-200/70 dark:border-white/[0.08] text-gray-700 dark:text-gray-300"
        }`}
      >
        <option value="">{placeholder}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  )
}
