"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Wrench, HeartPulse, Plane, CarFront, AlertTriangle, HelpCircle, Check } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { toast } from "@/lib/toast"

export type JustifType = "panne" | "maladie" | "conge" | "accident" | "montant_reduit" | "autre"

const TYPES: { value: JustifType; label: string; icon: React.ElementType; color: string }[] = [
  { value: "panne",          label: "Véhicule en panne",   icon: Wrench,        color: "from-red-400 to-rose-500"    },
  { value: "maladie",        label: "Chauffeur malade",    icon: HeartPulse,    color: "from-pink-400 to-red-500"    },
  { value: "conge",          label: "Congé / Off",         icon: Plane,         color: "from-sky-400 to-blue-500"    },
  { value: "accident",       label: "Accident",            icon: CarFront,      color: "from-orange-400 to-red-500"  },
  { value: "montant_reduit", label: "Justification montant réduit", icon: AlertTriangle, color: "from-amber-400 to-yellow-500" },
  { value: "autre",          label: "Autre raison",        icon: HelpCircle,    color: "from-gray-400 to-gray-500"   },
]

type Props = {
  open:              boolean
  onClose:           () => void
  id_vehicule:       number
  immatriculation:   string
  jour_exploitation: string
  montant_attendu:   number
  montant_recu:      number
  existing?:         { type: string; motif: string | null } | null
  onSaved:           () => void
}

export default function JustificationModal({
  open, onClose, id_vehicule, immatriculation, jour_exploitation,
  montant_attendu, montant_recu, existing, onSaved,
}: Props) {
  const [type,   setType]   = useState<JustifType>("panne")
  const [motif,  setMotif]  = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setType((existing?.type as JustifType) || (montant_recu > 0 ? "montant_reduit" : "panne"))
      setMotif(existing?.motif || "")
    }
  }, [open, existing, montant_recu])

  const save = async () => {
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res  = await fetch("/api/justifications", {
      method:  "POST",
      headers: {
        "Content-Type":   "application/json",
        Authorization:    `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        id_vehicule, jour_exploitation, type, motif,
        montant_attendu, montant_recu,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.ok) {
      toast.success("Justification enregistrée")
      onSaved()
      onClose()
    } else {
      toast.error(data.error || "Erreur")
    }
  }

  const dateStr = new Date(jour_exploitation).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1,    y: 0   }}
            exit={{    opacity: 0, scale: 0.95, y: -10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-full max-w-lg p-4"
          >
            <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-200 dark:border-[#1E2D45] shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="px-6 py-5 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-500/5 dark:to-orange-500/5 border-b border-gray-100 dark:border-[#1E2D45]">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-bold text-gray-900 dark:text-white">Justifier l&apos;écart de versement</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 capitalize">
                      <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">{immatriculation}</span>
                      {" · "}{dateStr}
                    </p>
                  </div>
                  <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-white/50 dark:hover:bg-white/5 transition flex-shrink-0">
                    <X size={16} />
                  </button>
                </div>

                {/* Résumé montants */}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="bg-white/70 dark:bg-white/5 rounded-xl px-3 py-2 border border-white dark:border-white/10">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Attendu</p>
                    <p className="text-sm font-bold font-numeric text-gray-900 dark:text-white mt-0.5">{Math.round(montant_attendu).toLocaleString("fr-FR")} F</p>
                  </div>
                  <div className="bg-white/70 dark:bg-white/5 rounded-xl px-3 py-2 border border-white dark:border-white/10">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Reçu</p>
                    <p className={`text-sm font-bold font-numeric mt-0.5 ${montant_recu > 0 ? "text-amber-600 dark:text-amber-400" : "text-red-500"}`}>
                      {Math.round(montant_recu).toLocaleString("fr-FR")} F
                      {montant_recu > 0 && <span className="text-[10px] opacity-60 ml-1">(écart −{Math.round(montant_attendu - montant_recu).toLocaleString("fr-FR")})</span>}
                    </p>
                  </div>
                </div>
              </div>

              {/* Types */}
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Raison</p>
                  <div className="grid grid-cols-2 gap-2">
                    {TYPES.map(t => {
                      const Icon = t.icon
                      const active = type === t.value
                      return (
                        <button key={t.value} onClick={() => setType(t.value)}
                          className={`flex items-center gap-2.5 p-3 rounded-xl border transition text-left ${
                            active
                              ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-300 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-400"
                              : "bg-gray-50 dark:bg-white/[0.02] border-gray-200 dark:border-[#1E2D45] hover:border-gray-300 dark:hover:border-gray-600"
                          }`}>
                          <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${t.color} flex items-center justify-center flex-shrink-0`}>
                            <Icon size={13} className="text-white" />
                          </div>
                          <span className="text-xs font-semibold">{t.label}</span>
                          {active && <Check size={14} className="ml-auto text-indigo-500 flex-shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Motif libre */}
                <div>
                  <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">
                    Détails <span className="font-normal text-gray-400 normal-case">(optionnel)</span>
                  </label>
                  <textarea value={motif} onChange={e => setMotif(e.target.value)}
                    placeholder="Ex: boîte de vitesse en réparation, chauffeur fièvre typhoïde…"
                    rows={3}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-[#1E2D45] rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none" />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-6 py-4 bg-gray-50 dark:bg-white/[0.02] border-t border-gray-100 dark:border-[#1E2D45]">
                <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition">
                  Annuler
                </button>
                <button onClick={save} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold shadow-md shadow-indigo-500/20 transition">
                  {saving
                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <Check size={14} />
                  }
                  Enregistrer la justification
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
