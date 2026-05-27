"use client"

/**
 * Sélecteur multi-caisses pour la card Relevés (Phase 4 §3.4).
 *
 * Pastilles avec logos (réutilise CaisseLogo).
 * "Tous" exclut les autres ; click sur une caisse l'ajoute/retire.
 */

import { useEffect, useState } from "react"
import { Wallet, Loader2 } from "lucide-react"
import { CaisseLogo } from "@/components/compta/CaisseLogo"
import { authFetch } from "@/lib/authFetch"

type CaisseLike = {
  id:      string
  libelle: string
  code:    string | null
  type:    "caisse" | "compte"
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asArray(v: any): unknown[] {
  if (Array.isArray(v)) return v
  if (Array.isArray(v?.data)) return v.data
  return []
}

type Props = {
  value:    string[]    // ["all"] OU UUIDs
  onChange: (next: string[]) => void
}

export function ExportsCaissesSelector({ value, onChange }: Props) {
  const [items,   setItems]   = useState<CaisseLike[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      authFetch("/api/compta/caisses?avec_solde=false").then(r => r.json()).catch(() => null),
      authFetch("/api/compta/comptes?avec_solde=false").then(r => r.json()).catch(() => null),
    ]).then(([cs, co]) => {
      if (cancelled) return
      const list: CaisseLike[] = []
      for (const r of asArray(cs)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = r as any
        list.push({ id: String(row.id), libelle: row.libelle, code: row.code ?? null, type: "caisse" })
      }
      for (const r of asArray(co)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = r as any
        list.push({ id: String(row.id), libelle: row.libelle, code: row.code ?? null, type: "compte" })
      }
      list.sort((a, b) => {
        if (a.type !== b.type) return a.type === "caisse" ? -1 : 1
        return a.libelle.localeCompare(b.libelle, "fr")
      })
      setItems(list)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const isAllMode = value.length === 0 || value.includes("all")

  function pickAll() { onChange(["all"]) }
  function toggle(id: string) {
    const set = new Set(isAllMode ? [] : value)
    if (set.has(id)) set.delete(id)
    else              set.add(id)
    const next = Array.from(set)
    onChange(next.length === 0 ? ["all"] : next)
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Wallet size={12} className="text-amber-500" />
        <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400">
          Caisses incluses
        </span>
        {loading && <Loader2 size={11} className="text-gray-400 animate-spin" />}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={pickAll}
          className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold transition ${
            isAllMode
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30"
              : "bg-gray-100 dark:bg-white/[0.05] text-gray-600 dark:text-gray-300 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400"
          }`}
        >
          Tous
        </button>
        {items.map(c => {
          const active = !isAllMode && value.includes(c.id)
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold transition ${
                active
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30"
                  : "bg-gray-100 dark:bg-white/[0.05] text-gray-600 dark:text-gray-300 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400"
              }`}
            >
              <CaisseLogo caisse={{ code: c.code, libelle: c.libelle }} size="xs" />
              <span className="truncate max-w-[120px]">{c.libelle}</span>
              <span className={`text-[9px] font-bold uppercase ${
                c.type === "caisse" ? "text-emerald-500" : "text-violet-500"
              }`}>
                {c.type === "caisse" ? "C" : "B"}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
