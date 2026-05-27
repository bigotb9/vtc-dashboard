"use client"

/**
 * Sélecteur de caisse / compte avec logo + solde + type-cible.
 * Dropdown custom (pas un <select>), pour pouvoir afficher logos + sous-textes.
 *
 * Le popover utilise `position: fixed` calculé depuis `getBoundingClientRect()`
 * du trigger, pour échapper à l'`overflow-hidden` du parent (.section card).
 *
 * Référence : doc Phase 3 Écran 4 §3.1.4 + correctif "dropdown clippé".
 */

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { ChevronDown, Wallet } from "lucide-react"
import { CaisseLogo } from "@/components/compta/CaisseLogo"
import type { CaisseRefForm } from "@/types/compta-ui"

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR")

type Props = {
  /** Liste fusionnée caisses + comptes (déjà triée par useFormReferences). */
  items:     CaisseRefForm[]
  value:     CaisseRefForm | null
  onChange:  (next: CaisseRefForm | null) => void
  loading?:  boolean
  error?:    string | null
  required?: boolean
}

export function CaisseSelector({ items, value, onChange, loading, error, required }: Props) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null)

  // Compute popover position when open + listen to scroll/resize
  useLayoutEffect(() => {
    if (!open) { setCoords(null); return }
    const compute = () => {
      const el = triggerRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setCoords({ top: r.bottom + 6, left: r.left, width: r.width })
    }
    compute()
    // capture=true to also listen to nested scroll containers
    window.addEventListener("scroll", compute, true)
    window.addEventListener("resize", compute)
    return () => {
      window.removeEventListener("scroll", compute, true)
      window.removeEventListener("resize", compute)
    }
  }, [open])

  // Click outside → close. Le popover étant en position fixed, il n'est plus
  // descendant du wrapper, donc on check à la fois trigger ET popover.
  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      const t = e.target as Node
      const inTrigger = triggerRef.current?.contains(t)
      const inPopover = popoverRef.current?.contains(t)
      if (!inTrigger && !inPopover) setOpen(false)
    }
    function onEsc(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onClickOutside)
    document.addEventListener("keydown", onEsc)
    return () => {
      document.removeEventListener("mousedown", onClickOutside)
      document.removeEventListener("keydown", onEsc)
    }
  }, [open])

  return (
    <div className="relative">
      <label htmlFor={id} className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em] mb-1.5">
        Caisse / Compte {required && <span className="text-red-500">*</span>}
      </label>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        className={`w-full rounded-xl border bg-white dark:bg-white/[0.02] px-3 py-2.5 flex items-center gap-2.5 text-left transition focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${
          error
            ? "border-red-400 dark:border-red-500/50"
            : "border-gray-200/70 dark:border-white/[0.08] hover:border-violet-300 dark:hover:border-violet-500/30 focus:border-violet-400"
        } disabled:opacity-50`}
      >
        {value ? (
          <>
            <CaisseLogo caisse={{ code: value.code, libelle: value.libelle }} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-gray-900 dark:text-white truncate">
                {value.libelle}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
                <span className={`inline-block px-1.5 py-px rounded text-[9px] font-bold uppercase tracking-wider ${
                  value.type_cible === "caisse"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-violet-500/10 text-violet-600 dark:text-violet-400"
                }`}>
                  {value.type_cible}
                </span>
                <span className="tabular-nums">
                  Solde : <span className={`font-semibold ${
                    (value.solde_courant ?? 0) >= 0
                      ? "text-gray-700 dark:text-gray-200"
                      : "text-red-600 dark:text-red-400"
                  }`}>
                    {value.solde_courant != null ? `${fmt(value.solde_courant)} F` : "—"}
                  </span>
                </span>
              </p>
            </div>
          </>
        ) : (
          <>
            <span className="w-7 h-7 rounded-md bg-gray-100 dark:bg-white/[0.05] flex items-center justify-center text-gray-400 flex-shrink-0">
              <Wallet size={14} />
            </span>
            <span className="flex-1 text-[13px] text-gray-400 dark:text-gray-500">
              {loading ? "Chargement…" : "— Sélectionner une caisse —"}
            </span>
          </>
        )}
        <ChevronDown size={16} className={`text-gray-400 transition flex-shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      {error && (
        <p className="mt-1.5 text-[11px] font-semibold text-red-500">{error}</p>
      )}

      {open && coords && (
        <div
          ref={popoverRef}
          style={{
            position: "fixed",
            top:      coords.top,
            left:     coords.left,
            width:    coords.width,
            zIndex:   60,
          }}
          className="rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#1a1b1f] shadow-2xl shadow-black/30 max-h-[320px] overflow-y-auto"
        >
          {items.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
              Aucune caisse ou compte
            </div>
          ) : (
            <ul>
              {items.map(item => {
                const isSelected = value?.id === item.id && value?.type_cible === item.type_cible
                return (
                  <li key={`${item.type_cible}_${item.id}`}>
                    <button
                      type="button"
                      onClick={() => { onChange(item); setOpen(false) }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition ${
                        isSelected
                          ? "bg-violet-500/10"
                          : "hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                      } ${!item.actif ? "opacity-50" : ""}`}
                    >
                      <CaisseLogo caisse={{ code: item.code, libelle: item.libelle }} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-gray-900 dark:text-white truncate">
                          {item.libelle}
                          {!item.actif && <span className="ml-1.5 text-[10px] font-bold text-gray-400 uppercase">inactif</span>}
                        </p>
                        <p className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
                          <span className={`inline-block px-1.5 py-px rounded text-[9px] font-bold uppercase tracking-wider ${
                            item.type_cible === "caisse"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-violet-500/10 text-violet-600 dark:text-violet-400"
                          }`}>
                            {item.type_cible}
                          </span>
                          {item.compte_syscohada_code && (
                            <span className="font-mono text-[9.5px] bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1 py-px rounded">
                              {item.compte_syscohada_code}
                            </span>
                          )}
                          <span className="tabular-nums">
                            {item.solde_courant != null
                              ? `${fmt(item.solde_courant)} F`
                              : "solde —"}
                          </span>
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
