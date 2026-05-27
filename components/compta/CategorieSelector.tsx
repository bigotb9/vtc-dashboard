"use client"

/**
 * Sélecteur de catégorie filtré par sens (entrée → credit, sortie → debit).
 * Dropdown custom avec code SYSCOHADA en pastille + libellé du compte.
 *
 * Le popover utilise `position: fixed` calculé depuis `getBoundingClientRect()`
 * du trigger, pour échapper à l'`overflow-hidden` du parent (.section card).
 *
 * Référence : doc Phase 3 Écran 4 §3.1.5 + correctif "dropdown clippé".
 */

import Link from "next/link"
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { ChevronDown, Tag, AlertTriangle } from "lucide-react"
import type { CategorieForm } from "@/types/compta-ui"

type Props = {
  items:     CategorieForm[]
  value:     CategorieForm | null
  onChange:  (next: CategorieForm | null) => void
  loading?:  boolean
  error?:    string | null
  required?: boolean
}

export function CategorieSelector({ items, value, onChange, loading, error, required }: Props) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) { setCoords(null); return }
    const compute = () => {
      const el = triggerRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setCoords({ top: r.bottom + 6, left: r.left, width: r.width })
    }
    compute()
    window.addEventListener("scroll", compute, true)
    window.addEventListener("resize", compute)
    return () => {
      window.removeEventListener("scroll", compute, true)
      window.removeEventListener("resize", compute)
    }
  }, [open])

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
        Catégorie {required && <span className="text-red-500">*</span>}
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
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-gray-900 dark:text-white truncate">
                {value.libelle}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5 truncate">
                {value.compte_syscohada_code && (
                  <span className="font-mono text-[9.5px] bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1.5 py-px rounded font-bold">
                    {value.compte_syscohada_code}
                  </span>
                )}
                <span className="truncate">{value.compte_syscohada_libelle ?? "—"}</span>
              </p>
            </div>
            {!value.mapping_complet && (
              <span title="Mapping SYSCOHADA incomplet" className="flex-shrink-0 text-amber-500">
                <AlertTriangle size={14} />
              </span>
            )}
          </>
        ) : (
          <>
            <span className="w-7 h-7 rounded-md bg-gray-100 dark:bg-white/[0.05] flex items-center justify-center text-gray-400 flex-shrink-0">
              <Tag size={14} />
            </span>
            <span className="flex-1 text-[13px] text-gray-400 dark:text-gray-500">
              {loading ? "Chargement…" : "— Sélectionner une catégorie —"}
            </span>
          </>
        )}
        <ChevronDown size={16} className={`text-gray-400 transition flex-shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500 leading-snug">
        Détermine le compte SYSCOHADA utilisé pour l&apos;écriture comptable.
      </p>
      {error && (
        <p className="mt-1 text-[11px] font-semibold text-red-500">{error}</p>
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
            <div className="px-3 py-6 text-center text-xs text-gray-400 dark:text-gray-500 space-y-2">
              <p>Aucune catégorie disponible pour ce sens.</p>
              <Link
                href="/comptabilite/categories/nouvelle"
                className="inline-block text-violet-600 dark:text-violet-400 underline font-semibold hover:opacity-80"
              >
                Créer une catégorie
              </Link>
            </div>
          ) : (
            <ul>
              {items.map(item => {
                const isSelected = value?.id === item.id
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => { onChange(item); setOpen(false) }}
                      className={`w-full flex items-start gap-2 px-3 py-2.5 text-left transition ${
                        isSelected
                          ? "bg-violet-500/10"
                          : "hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-gray-900 dark:text-white truncate">
                          {item.libelle}
                        </p>
                        <p className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
                          {item.compte_syscohada_code ? (
                            <span className="font-mono text-[9.5px] bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1 py-px rounded font-bold">
                              {item.compte_syscohada_code}
                            </span>
                          ) : (
                            <span className="font-mono text-[9.5px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1 py-px rounded font-bold">
                              non mappé
                            </span>
                          )}
                          <span className="truncate">{item.compte_syscohada_libelle ?? "—"}</span>
                          {item.journal_par_defaut && (
                            <span className="ml-auto text-[9.5px] font-bold text-gray-400 uppercase">
                              {item.journal_par_defaut}
                            </span>
                          )}
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
