"use client"

/**
 * Barre de filtres avec panel collapsible — Phase 4.x Vague 3.5 §2.2.5.
 *
 * État replié (default) :
 *   - Input recherche libre (debouncée 200 ms)
 *   - Bouton "🔧 Filtres avancés" avec badge compteur si filtres actifs
 *
 * État déplié :
 *   - 8 filtres en 4 colonnes : Catégorie, Caisse/Compte, Véhicule, Chauffeur,
 *     Tiers, Source, Montant min, Montant max
 *   - Footer : Réinitialiser + Replier
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { Search, SlidersHorizontal, ChevronUp, X, RotateCcw } from "lucide-react"
import { authFetch } from "@/lib/authFetch"
import type { FlowFilters, FlowKind, FlowSource } from "@/types/compta-ui"

type RefItem = { id: string | number; label: string; meta?: string }

const SOURCE_OPTIONS: ReadonlyArray<{ key: FlowSource; label: string }> = [
  { key: "recette_wave",      label: "Recette Wave" },
  { key: "depense_vehicule",  label: "Dépense véhicule" },
  { key: "manuel",            label: "Saisie manuelle" },
  { key: "versement_client",  label: "Versement client" },
  { key: "dotation_amort",    label: "Dotation" },
  { key: "import_csv",        label: "Import CSV" },
]

type Props = {
  kind:     FlowKind
  filters:  FlowFilters
  onChange: (next: FlowFilters) => void
  onReset:  () => void
}

export function FiltersBar({ kind, filters, onChange, onReset }: Props) {
  const accent = kind === "depenses" ? "text-red-400" : "text-emerald-400"
  const [expanded, setExpanded] = useState(false)
  const [searchDraft, setSearchDraft] = useState(filters.search ?? "")
  useEffect(() => { setSearchDraft(filters.search ?? "") }, [filters.search])

  // Debounce 200ms sur la recherche
  const sTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (sTimerRef.current) clearTimeout(sTimerRef.current)
    sTimerRef.current = setTimeout(() => {
      if ((searchDraft || "") !== (filters.search || "")) {
        onChange({ ...filters, search: searchDraft.trim() || undefined, page: 1 })
      }
    }, 200)
    return () => { if (sTimerRef.current) clearTimeout(sTimerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft])

  // ── Counters (nombre de filtres actifs hors search) ────────────────────
  const activeCount = useMemo(() => {
    let n = 0
    if (filters.cat_ids?.length)        n += 1
    if (filters.caisse_ids?.length)     n += 1
    if (filters.vehicule_ids?.length)   n += 1
    if (filters.chauffeur_ids?.length)  n += 1
    if (filters.tiers_ids?.length)      n += 1
    if (filters.sources?.length)        n += 1
    if (filters.montant_min != null)    n += 1
    if (filters.montant_max != null)    n += 1
    return n
  }, [filters])

  return (
    <div className="space-y-2">
      {/* Barre principale */}
      <div className="rounded-xl border border-[#1E2D45] bg-[#0D1424] p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-xl">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" value={searchDraft}
            onChange={e => setSearchDraft(e.target.value)}
            placeholder="🔍 Rechercher (libellé, tiers, immat…)"
            className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-[#1A2235] border border-[#1E2D45] text-xs text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          />
          {searchDraft && (
            <button type="button" onClick={() => setSearchDraft("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200">
              <X size={12} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1E2D45] bg-[#1A2235] text-xs font-semibold transition ${
            expanded ? `${accent} hover:opacity-80` : "text-gray-300 hover:text-gray-100"
          }`}
        >
          {expanded ? <ChevronUp size={13} /> : <SlidersHorizontal size={13} />}
          Filtres avancés
          {activeCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9.5px] font-bold tabular-nums">
              {activeCount}
            </span>
          )}
        </button>
        {(activeCount > 0 || searchDraft) && (
          <button type="button" onClick={onReset}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-400 hover:text-gray-200 ml-auto">
            <RotateCcw size={11} /> Réinitialiser
          </button>
        )}
      </div>

      {/* Panel déplié */}
      {expanded && (
        <FiltersPanel
          kind={kind}
          filters={filters}
          onChange={onChange}
          onReset={onReset}
          onCollapse={() => setExpanded(false)}
        />
      )}
    </div>
  )
}

// ─── Panel déplié ──────────────────────────────────────────────────────────

type PanelProps = {
  kind:       FlowKind
  filters:    FlowFilters
  onChange:   (next: FlowFilters) => void
  onReset:    () => void
  onCollapse: () => void
}

function FiltersPanel({ kind, filters, onChange, onReset, onCollapse }: PanelProps) {
  const accent = kind === "depenses" ? "text-red-400" : "text-emerald-400"

  // Refs (lookups dynamiques)
  const cats       = useRefList(`/api/compta/categories?sens=${kind === "depenses" ? "debit" : "credit"}`,
                                (r: Array<{ id: string; libelle: string }>) =>
                                  r.map(c => ({ id: c.id, label: c.libelle })))
  const caisses    = useCaissesAndComptes()
  const tiers      = useRefList(`/api/compta/tiers?actifs_only=true&page_size=200`,
                                (r: { data?: { id: string; nom: string; type: string }[] }) => {
                                  // r = response.data.data
                                  const arr = (r?.data ?? []) as Array<{ id: string; nom: string; type: string }>
                                  return arr.map(t => ({ id: t.id, label: t.nom, meta: t.type }))
                                }, true)
  const vehicules  = useRefList(`/api/vehicules/list`,
                                (r: Array<{ id_vehicule: number; immatriculation: string }>) =>
                                  r.map(v => ({ id: v.id_vehicule, label: v.immatriculation ?? `#${v.id_vehicule}` })))
  const chauffeurs = useRefList(`/api/chauffeurs/list`,
                                (r: Array<{ id_chauffeur: number; nom: string }>) =>
                                  r.map(c => ({ id: c.id_chauffeur, label: c.nom ?? `#${c.id_chauffeur}` })))

  function patch<K extends keyof FlowFilters>(key: K, value: FlowFilters[K]) {
    onChange({ ...filters, [key]: value, page: 1 })
  }

  return (
    <div className="rounded-xl border border-[#1E2D45] bg-[#0D1424] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className={`text-[10.5px] font-bold uppercase tracking-[0.14em] ${accent}`}>
          🔧 Filtres avancés
        </h3>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MultiSelect label="Catégorie"      value={filters.cat_ids ?? []}        items={cats}       onChange={v => patch("cat_ids",        v.length > 0 ? v.map(String)   : undefined)} />
        <MultiSelect label="Caisse/Compte"  value={filters.caisse_ids ?? []}     items={caisses}    onChange={v => patch("caisse_ids",     v.length > 0 ? v.map(String)   : undefined)} />
        <MultiSelectN label="Véhicule"       value={filters.vehicule_ids ?? []}   items={vehicules}  onChange={v => patch("vehicule_ids",   v.length > 0 ? v               : undefined)} />
        <MultiSelectN label="Chauffeur"      value={filters.chauffeur_ids ?? []}  items={chauffeurs} onChange={v => patch("chauffeur_ids",  v.length > 0 ? v               : undefined)} />
        <MultiSelect label={kind === "depenses" ? "Tiers" : "Tiers / Client"} value={filters.tiers_ids ?? []} items={tiers}
                     onChange={v => patch("tiers_ids", v.length > 0 ? v.map(String) : undefined)} />
        <MultiSelectSource value={filters.sources ?? []}
                           onChange={v => patch("sources", v.length > 0 ? v : undefined)} />
        <NumberField label="Montant min" value={filters.montant_min ?? null}
                     onChange={n => patch("montant_min", n)} />
        <NumberField label="Montant max" value={filters.montant_max ?? null}
                     onChange={n => patch("montant_max", n)} />
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#1E2D45]">
        <button type="button" onClick={onReset}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold text-gray-300 hover:text-white hover:bg-[#1A2235] transition">
          <RotateCcw size={11} /> Réinitialiser
        </button>
        <button type="button" onClick={onCollapse}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold text-gray-300 hover:text-white hover:bg-[#1A2235] transition">
          <ChevronUp size={11} /> Replier
        </button>
      </div>
    </div>
  )
}

// ─── Hooks de chargement des refs ──────────────────────────────────────────

function useRefList<T>(url: string, mapper: (r: T) => RefItem[], wrapped = false): RefItem[] {
  const [items, setItems] = useState<RefItem[]>([])
  useEffect(() => {
    let cancelled = false
    authFetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (cancelled || !j) return
        const raw = wrapped ? j.data : (Array.isArray(j) ? j : j?.data ?? [])
        setItems(mapper(raw as T))
      })
      .catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])
  return items
}

function useCaissesAndComptes(): RefItem[] {
  const [items, setItems] = useState<RefItem[]>([])
  useEffect(() => {
    let cancelled = false
    Promise.all([
      authFetch("/api/compta/caisses?avec_solde=false").then(r => r.ok ? r.json() : null).catch(() => null),
      authFetch("/api/compta/comptes?avec_solde=false").then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([cs, co]) => {
      if (cancelled) return
      const out: RefItem[] = []
      for (const r of (Array.isArray(cs) ? cs : cs?.data ?? []) as Array<{ id: string; libelle: string }>) {
        out.push({ id: r.id, label: r.libelle, meta: "caisse" })
      }
      for (const r of (Array.isArray(co) ? co : co?.data ?? []) as Array<{ id: string; libelle: string }>) {
        out.push({ id: r.id, label: r.libelle, meta: "compte" })
      }
      out.sort((a, b) => a.label.localeCompare(b.label, "fr"))
      setItems(out)
    })
    return () => { cancelled = true }
  }, [])
  return items
}

// ─── Sous-composants : sélecteurs ──────────────────────────────────────────

function MultiSelect({ label, value, items, onChange }: {
  label: string; value: string[]; items: RefItem[]; onChange: (v: string[]) => void
}) {
  return (
    <SelectShell label={label} count={value.length}>
      <select multiple value={value}
        onChange={e => {
          const arr: string[] = []
          for (const opt of Array.from(e.target.selectedOptions)) arr.push(opt.value)
          onChange(arr)
        }}
        className="w-full bg-[#1A2235] border border-[#1E2D45] rounded-md px-2 py-1.5 text-[11.5px] text-gray-200 max-h-28 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
      >
        {items.length === 0 && <option disabled>— Aucun —</option>}
        {items.map(i => (
          <option key={String(i.id)} value={String(i.id)} className="bg-[#0D1424]">{i.label}</option>
        ))}
      </select>
    </SelectShell>
  )
}

function MultiSelectN({ label, value, items, onChange }: {
  label: string; value: number[]; items: RefItem[]; onChange: (v: number[]) => void
}) {
  return (
    <SelectShell label={label} count={value.length}>
      <select multiple value={value.map(String)}
        onChange={e => {
          const arr: number[] = []
          for (const opt of Array.from(e.target.selectedOptions)) {
            const n = Number(opt.value)
            if (Number.isFinite(n)) arr.push(n)
          }
          onChange(arr)
        }}
        className="w-full bg-[#1A2235] border border-[#1E2D45] rounded-md px-2 py-1.5 text-[11.5px] text-gray-200 max-h-28 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
      >
        {items.length === 0 && <option disabled>— Aucun —</option>}
        {items.map(i => (
          <option key={String(i.id)} value={String(i.id)} className="bg-[#0D1424]">{i.label}</option>
        ))}
      </select>
    </SelectShell>
  )
}

function MultiSelectSource({ value, onChange }: { value: FlowSource[]; onChange: (v: FlowSource[]) => void }) {
  return (
    <SelectShell label="Source" count={value.length}>
      <select multiple value={value}
        onChange={e => {
          const arr: FlowSource[] = []
          for (const opt of Array.from(e.target.selectedOptions)) arr.push(opt.value as FlowSource)
          onChange(arr)
        }}
        className="w-full bg-[#1A2235] border border-[#1E2D45] rounded-md px-2 py-1.5 text-[11.5px] text-gray-200 max-h-28 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
      >
        {SOURCE_OPTIONS.map(s => (
          <option key={s.key} value={s.key} className="bg-[#0D1424]">{s.label}</option>
        ))}
      </select>
    </SelectShell>
  )
}

function NumberField({ label, value, onChange }: {
  label: string; value: number | null; onChange: (n: number | null) => void
}) {
  return (
    <SelectShell label={label} count={value !== null ? 1 : 0}>
      <input
        type="number" min={0} step={1000}
        value={value ?? ""}
        onChange={e => {
          const n = Number(e.target.value)
          onChange(Number.isFinite(n) && e.target.value !== "" ? n : null)
        }}
        placeholder="ex 10 000"
        className="w-full bg-[#1A2235] border border-[#1E2D45] rounded-md px-2 py-1.5 text-[11.5px] text-gray-200 font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/40"
      />
    </SelectShell>
  )
}

function SelectShell({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400">{label}</label>
        {count > 0 && (
          <span className="text-[9px] font-bold text-violet-400 tabular-nums">{count}</span>
        )}
      </div>
      {children}
    </div>
  )
}
