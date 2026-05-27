"use client"

/**
 * Sélecteur de compte SYSCOHADA filtré par classe (typiquement classe 5
 * trésorerie pour les caisses et comptes bancaires). Dropdown custom avec
 * recherche live + pastille code.
 *
 * Référence : doc Phase 3 Écran 5 §4.3.
 */

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, Search, Code } from "lucide-react"
import { authFetch } from "@/lib/authFetch"

export type SyscohadaCompte = {
  code:    string
  libelle: string
  classe:  number
  type:    string
}

type Props = {
  /** Classe SYSCOHADA à filtrer (par défaut : 5 = trésorerie). */
  classe?:   number
  value:     string | null
  onChange:  (code: string | null) => void
  error?:    string | null
  required?: boolean
}

export function SyscohadaSelector({ classe = 5, value, onChange, error, required }: Props) {
  const id = useId()
  const [open, setOpen]     = useState(false)
  const [comptes, setComptes] = useState<SyscohadaCompte[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null)

  // Charge les comptes au premier ouverture
  useEffect(() => {
    if (!open || comptes.length > 0) return
    let cancelled = false
    setLoading(true)
    authFetch(`/api/compta/comptes-syscohada?classe=${classe}`)
      .then(r => r.json())
      .then(j => {
        if (cancelled) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const list = ((j?.data ?? []) as any[]).map(r => ({
          code:    String(r.code),
          libelle: String(r.libelle),
          classe:  Number(r.classe),
          type:    String(r.type),
        }))
        setComptes(list)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, classe, comptes.length])

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
      if (!triggerRef.current?.contains(t) && !popoverRef.current?.contains(t)) setOpen(false)
    }
    function onEsc(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onClickOutside)
    document.addEventListener("keydown", onEsc)
    return () => {
      document.removeEventListener("mousedown", onClickOutside)
      document.removeEventListener("keydown", onEsc)
    }
  }, [open])

  const selected = useMemo(() => comptes.find(c => c.code === value) ?? null, [comptes, value])

  const filtered = useMemo(() => {
    if (!search) return comptes
    const q = search.toLowerCase()
    return comptes.filter(c =>
      c.code.toLowerCase().includes(q) ||
      c.libelle.toLowerCase().includes(q),
    )
  }, [comptes, search])

  return (
    <div className="relative">
      <label htmlFor={id} className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em] mb-1.5">
        Compte SYSCOHADA {required && <span className="text-red-500">*</span>}
      </label>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        onClick={() => setOpen(o => !o)}
        className={`w-full rounded-xl border bg-white dark:bg-white/[0.02] px-3 py-2.5 flex items-center gap-2.5 text-left transition focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${
          error
            ? "border-red-400 dark:border-red-500/50"
            : "border-gray-200/70 dark:border-white/[0.08] hover:border-violet-300 dark:hover:border-violet-500/30 focus:border-violet-400"
        }`}
      >
        {value ? (
          <>
            <span className="font-mono text-[11px] bg-violet-500/10 text-violet-600 dark:text-violet-400 px-2 py-0.5 rounded font-bold flex-shrink-0">
              {value}
            </span>
            <span className="flex-1 text-[13px] font-semibold text-gray-900 dark:text-white truncate">
              {selected?.libelle ?? "—"}
            </span>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex-shrink-0">
              Classe {selected?.classe ?? "?"}
            </span>
          </>
        ) : (
          <>
            <span className="w-7 h-7 rounded-md bg-gray-100 dark:bg-white/[0.05] flex items-center justify-center text-gray-400 flex-shrink-0">
              <Code size={14} />
            </span>
            <span className="flex-1 text-[13px] text-gray-400 dark:text-gray-500">— Sélectionner un compte SYSCOHADA —</span>
          </>
        )}
        <ChevronDown size={16} className={`text-gray-400 transition flex-shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500 leading-snug">
        Détermine le compte de trésorerie utilisé dans les écritures comptables (classe {classe}).
      </p>
      {error && <p className="mt-1 text-[11px] font-semibold text-red-500">{error}</p>}

      {open && coords && (
        <div
          ref={popoverRef}
          style={{
            position: "fixed", top: coords.top, left: coords.left, width: coords.width, zIndex: 60,
          }}
          className="rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#1a1b1f] shadow-2xl shadow-black/30 max-h-[360px] overflow-hidden flex flex-col"
        >
          <div className="px-2 py-2 border-b border-gray-100 dark:border-white/[0.06] flex items-center gap-2">
            <Search size={12} className="text-gray-400" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Code ou libellé…"
              className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-6 text-center text-xs text-gray-400">Chargement…</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-gray-400">Aucun résultat</div>
            ) : (
              <ul>
                {filtered.map(c => (
                  <li key={c.code}>
                    <button
                      type="button"
                      onClick={() => { onChange(c.code); setOpen(false); setSearch("") }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left transition ${
                        c.code === value
                          ? "bg-violet-500/10"
                          : "hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                      }`}
                    >
                      <span className="font-mono text-[10.5px] bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded font-bold flex-shrink-0">
                        {c.code}
                      </span>
                      <span className="flex-1 text-[12.5px] font-semibold text-gray-900 dark:text-white truncate">
                        {c.libelle}
                      </span>
                      <span className="text-[9.5px] font-bold text-gray-400 uppercase tracking-wider flex-shrink-0">
                        Cl. {c.classe}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
