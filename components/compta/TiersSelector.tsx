"use client"

/**
 * Sélecteur de tiers pour formulaire opération (Phase 4.x Vague 2 §3.7).
 *
 * Combobox avec :
 *   - Recherche live (chargement initial des actifs uniquement)
 *   - Filtrage par types autorisés (cf. prop `allowedTypes`)
 *   - Bouton "+ Nouveau tiers" → ouvre TiersQuickCreateModal
 *   - "Aucun tiers" si l'utilisateur veut effacer la sélection
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, Plus, X, Search, Loader2 } from "lucide-react"
import { TiersTypeBadge } from "@/components/compta/TiersTypeBadge"
import { TiersQuickCreateModal } from "@/components/compta/TiersQuickCreateModal"
import { authFetch } from "@/lib/authFetch"
import type { TiersListItem, TiersType } from "@/types/compta-ui"

type Props = {
  value:        string | null
  onChange:     (id: string | null, nom?: string) => void
  allowedTypes?: TiersType[]                          // ex. sortie → ['fournisseur','salarie','autre']
  defaultNewType?: TiersType
  /** Petit hint sous le champ pour orienter l'utilisateur. */
  hint?: string
}

export function TiersSelector({ value, onChange, allowedTypes, defaultNewType = "fournisseur", hint }: Props) {
  const [items, setItems] = useState<TiersListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Chargement initial : tous les actifs
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    authFetch("/api/compta/tiers?actifs_only=true&page_size=200")
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (cancelled) return
        const data = (j?.data?.data ?? []) as TiersListItem[]
        setItems(data)
        setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Fermeture click-outside
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!dropdownRef.current) return
      if (!dropdownRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  // Filtrage allowedTypes + recherche
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return items.filter(t => {
      if (allowedTypes && allowedTypes.length > 0 && !allowedTypes.includes(t.type)) return false
      if (!q) return true
      return (
        t.nom.toLowerCase().includes(q) ||
        (t.telephone ?? "").toLowerCase().includes(q) ||
        (t.numero_rccm ?? "").toLowerCase().includes(q) ||
        t.compte_syscohada_code.toLowerCase().includes(q)
      )
    })
  }, [items, filter, allowedTypes])

  const selected = items.find(t => t.id === value) ?? null

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-sm hover:border-indigo-300 dark:hover:border-indigo-500/40 transition"
      >
        {selected ? (
          <span className="flex items-center gap-2 min-w-0">
            <TiersTypeBadge type={selected.type} size="xs" />
            <span className="font-bold text-gray-900 dark:text-white truncate">{selected.nom}</span>
            <span className="text-[10px] font-mono bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1 py-px rounded shrink-0">{selected.compte_syscohada_code}</span>
          </span>
        ) : (
          <span className="text-gray-400">Aucun tiers (optionnel)</span>
        )}
        <span className="flex items-center gap-1.5 shrink-0">
          {selected && (
            <span role="button" tabIndex={-1} onClick={e => { e.stopPropagation(); onChange(null) }} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer" title="Effacer">
              <X size={12} />
            </span>
          )}
          <ChevronDown size={14} className={`text-gray-400 transition ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {hint && (
        <div className="mt-1 text-[10px] text-gray-400 dark:text-gray-600">{hint}</div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-xl bg-white dark:bg-[#1a1b1f] border border-gray-200 dark:border-white/[0.08] shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100 dark:border-white/[0.06]">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="Rechercher…"
                autoFocus
                className="w-full pl-7 pr-2 py-1.5 rounded-lg bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {loading && (
              <div className="px-3 py-4 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
                <Loader2 size={12} className="animate-spin" /> Chargement…
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-gray-400">
                {filter ? "Aucun tiers correspondant." : "Aucun tiers compatible."}
              </div>
            )}
            {!loading && filtered.map(t => (
              <button key={t.id} type="button"
                onClick={() => { onChange(t.id, t.nom); setOpen(false); setFilter("") }}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-indigo-500/5 dark:hover:bg-indigo-500/10 transition ${
                  value === t.id ? "bg-indigo-500/10" : ""
                }`}>
                <TiersTypeBadge type={t.type} size="xs" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-900 dark:text-white truncate">{t.nom}</div>
                  {t.telephone && <div className="text-[11px] font-mono text-gray-400 truncate">{t.telephone}</div>}
                </div>
                <span className="text-[10px] font-mono bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1 py-px rounded shrink-0">{t.compte_syscohada_code}</span>
              </button>
            ))}
          </div>
          <div className="border-t border-gray-100 dark:border-white/[0.06] p-2">
            <button type="button"
              onClick={() => { setOpen(false); setModalOpen(true) }}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white text-xs font-bold shadow-md transition">
              <Plus size={12} /> Nouveau tiers
            </button>
          </div>
        </div>
      )}

      <TiersQuickCreateModal
        open={modalOpen}
        defaultType={defaultNewType}
        onClose={() => setModalOpen(false)}
        onCreated={created => {
          // Recharger la liste + sélectionner le nouveau
          setItems(prev => [
            { id: created.tiers_id, nom: created.nom, type: created.type,
              telephone: null, email: null, numero_rccm: null, numero_contribuable: null,
              compte_syscohada_code: created.compte_syscohada_code, actif: true,
              nb_operations: 0, total_flux_signe: 0, derniere_op_date: null },
            ...prev,
          ])
          onChange(created.tiers_id, created.nom)
        }}
      />
    </div>
  )
}
