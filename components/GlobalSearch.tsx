"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { supabase } from "@/lib/supabaseClient"
import { Search, Car, Users, X, ArrowRight, Command } from "lucide-react"

type Result = {
  id:    string
  label: string
  sub:   string
  href:  string
  type:  "chauffeur" | "vehicule"
}

export function useGlobalSearch() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return { open, setOpen }
}

export default function GlobalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router              = useRouter()
  const inputRef            = useRef<HTMLInputElement>(null)
  const [query,   setQuery] = useState("")
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)

  // Focus input quand ouvert
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery("")
      setResults([])
      setSelected(0)
    }
  }, [open])

  // Recherche debounced
  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setLoading(true)

    const [{ data: chauffeurs }, { data: vehicules }] = await Promise.all([
      supabase.from("chauffeurs").select("id_chauffeur, nom, numero_wave, actif").ilike("nom", `%${q}%`).limit(5),
      supabase.from("vehicules").select("id_vehicule, immatriculation, proprietaire, statut").ilike("immatriculation", `%${q}%`).limit(5),
    ])

    const items: Result[] = [
      ...(chauffeurs || []).map(c => ({
        id:    `c-${c.id_chauffeur}`,
        label: c.nom,
        sub:   c.actif ? "Actif" : "Inactif",
        href:  `/chauffeurs/${c.id_chauffeur}`,
        type:  "chauffeur" as const,
      })),
      ...(vehicules || []).map(v => ({
        id:    `v-${v.id_vehicule}`,
        label: v.immatriculation,
        sub:   v.proprietaire || v.statut || "",
        href:  `/vehicules/${v.id_vehicule}`,
        type:  "vehicule" as const,
      })),
    ]
    setResults(items)
    setSelected(0)
    setLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => search(query), 250)
    return () => clearTimeout(t)
  }, [query, search])

  // Navigation clavier
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!open) return
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
      if (e.key === "Enter" && results[selected]) {
        router.push(results[selected].href)
        onClose()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, results, selected, router, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -12 }}
            animate={{ opacity: 1, scale: 1,    y: 0    }}
            exit={{    opacity: 0, scale: 0.96, y: -12  }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed top-[15vh] left-1/2 -translate-x-1/2 z-[101] w-full max-w-lg"
          >
            <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-200 dark:border-[#1E2D45] shadow-2xl overflow-hidden">

              {/* Input */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 dark:border-[#1E2D45]">
                <Search size={16} className="text-gray-400 flex-shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Rechercher un chauffeur, véhicule…"
                  className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none"
                />
                {loading && <div className="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin flex-shrink-0" />}
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition flex-shrink-0">
                  <X size={15} />
                </button>
              </div>

              {/* Résultats */}
              <div className="max-h-80 overflow-y-auto">
                {results.length === 0 && query.length >= 2 && !loading && (
                  <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-600">
                    Aucun résultat pour &quot;{query}&quot;
                  </div>
                )}
                {results.length === 0 && query.length < 2 && (
                  <div className="px-4 py-6 text-center">
                    <p className="text-xs text-gray-400 dark:text-gray-600">Tapez au moins 2 caractères pour rechercher</p>
                  </div>
                )}
                {results.map((r, i) => (
                  <button
                    key={r.id}
                    onClick={() => { router.push(r.href); onClose() }}
                    onMouseEnter={() => setSelected(i)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${
                      selected === i ? "bg-indigo-50 dark:bg-indigo-500/10" : "hover:bg-gray-50 dark:hover:bg-white/5"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      r.type === "chauffeur"
                        ? "bg-gradient-to-br from-violet-400 to-indigo-500"
                        : "bg-gradient-to-br from-sky-400 to-cyan-500"
                    }`}>
                      {r.type === "chauffeur"
                        ? <Users size={14} className="text-white" />
                        : <Car   size={14} className="text-white" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{r.label}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-600 truncate">{r.sub}</p>
                    </div>
                    {selected === i && <ArrowRight size={14} className="text-indigo-500 flex-shrink-0" />}
                  </button>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 dark:border-[#1E2D45] bg-gray-50 dark:bg-[#080C14]">
                <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-gray-600">
                  <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-[#1A2235] rounded text-[9px]">↑↓</kbd> Naviguer</span>
                  <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-[#1A2235] rounded text-[9px]">↵</kbd> Ouvrir</span>
                  <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-[#1A2235] rounded text-[9px]">Esc</kbd> Fermer</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-600">
                  <Command size={10} />
                  <span>K</span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
