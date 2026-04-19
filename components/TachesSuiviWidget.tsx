"use client"

import { useEffect, useState } from "react"
import { Wrench, CheckCircle2, Trash2, Plus, X } from "lucide-react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "@/lib/toast"

type Tache = {
  id:             string
  id_vehicule:    number
  immatriculation: string
  description:     string
  fait:            boolean
  id_entretien:    string | null
  created_at:      string
}

type Vehicule = { id_vehicule: number; immatriculation: string }

export default function TachesSuiviWidget() {
  const [taches,    setTaches]    = useState<Tache[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showAdd,   setShowAdd]   = useState(false)
  const [vehicules, setVehicules] = useState<Vehicule[]>([])
  const [saving,    setSaving]    = useState(false)
  const [form,      setForm]      = useState({ id_vehicule: "", description: "" })

  const load = async () => {
    setLoading(true)
    const res  = await fetch("/api/taches?fait=false")
    const data = await res.json()
    setTaches(data.taches || [])
    setLoading(false)
  }

  const loadVehicules = async () => {
    const res  = await fetch("/api/vehicules/list")
    const data = await res.json()
    setVehicules(data.vehicules || [])
  }

  useEffect(() => { load(); loadVehicules() }, [])

  const cocher = async (id: string) => {
    await fetch("/api/taches", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, fait: true }),
    })
    setTaches(t => t.filter(x => x.id !== id))
    toast.success("Tâche marquée comme faite")
  }

  const supprimer = async (id: string) => {
    await fetch(`/api/taches?id=${id}`, { method: "DELETE" })
    setTaches(t => t.filter(x => x.id !== id))
    toast.success("Tâche supprimée")
  }

  const ajouter = async () => {
    if (!form.id_vehicule || !form.description.trim()) return
    setSaving(true)
    const v = vehicules.find(x => x.id_vehicule === Number(form.id_vehicule))
    if (!v) { setSaving(false); return }
    const res  = await fetch("/api/taches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id_vehicule:     v.id_vehicule,
        immatriculation: v.immatriculation,
        description:     form.description.trim(),
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.success) {
      toast.success("Tâche ajoutée")
      setForm({ id_vehicule: "", description: "" })
      setShowAdd(false)
      load()
    } else {
      toast.error(data.error || "Erreur")
    }
  }

  // Grouper par véhicule
  const grouped: Record<string, Tache[]> = {}
  for (const t of taches) {
    if (!grouped[t.immatriculation]) grouped[t.immatriculation] = []
    grouped[t.immatriculation].push(t)
  }

  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] shadow-sm">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#1E2D45]">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500">
            <Wrench size={13} className="text-white" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Réparations à programmer</h2>
            <p className="text-[10px] text-gray-400 dark:text-gray-600">
              {taches.length} réparation{taches.length > 1 ? "s" : ""} en attente
            </p>
          </div>
        </div>
        <button onClick={() => setShowAdd(p => !p)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-500/20 transition">
          {showAdd ? <><X size={12} />Annuler</> : <><Plus size={12} />Ajouter</>}
        </button>
      </div>

      {/* Formulaire ajout */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-gray-100 dark:border-[#1E2D45]"
          >
            <div className="p-4 bg-amber-50/30 dark:bg-amber-500/5 space-y-3">
              <select
                value={form.id_vehicule}
                onChange={e => setForm(p => ({ ...p, id_vehicule: e.target.value }))}
                className="w-full bg-white dark:bg-[#080C14] border border-gray-200 dark:border-[#1E2D45] rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="">-- Choisir un véhicule --</option>
                {vehicules.map(v => <option key={v.id_vehicule} value={v.id_vehicule}>{v.immatriculation}</option>)}
              </select>
              <input
                type="text"
                placeholder="Ex: Changer disques frein arrière"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && ajouter()}
                className="w-full bg-white dark:bg-[#080C14] border border-gray-200 dark:border-[#1E2D45] rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <div className="flex justify-end">
                <button onClick={ajouter} disabled={saving || !form.id_vehicule || !form.description.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-semibold transition">
                  {saving ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={12} />}
                  Créer la tâche
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contenu */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : taches.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-gray-400 dark:text-gray-600">
          <CheckCircle2 size={28} className="opacity-40 text-emerald-500" />
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Tout est à jour</p>
          <p className="text-xs">Aucune tâche en attente sur la flotte</p>
        </div>
      ) : (
        <div className="max-h-[400px] overflow-y-auto">
          {Object.entries(grouped).map(([immat, items]) => {
            const vehicule = items[0]
            return (
              <div key={immat} className="border-b border-gray-50 dark:border-[#1A2235] last:border-0">
                {/* Header véhicule */}
                <div className="flex items-center gap-2 px-5 py-2.5 bg-gray-50 dark:bg-[#080F1E]">
                  <Link href={`/vehicules/${vehicule.id_vehicule}`}
                    className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-[#0D1424] px-2 py-0.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition">
                    {immat}
                  </Link>
                  <span className="text-[10px] text-gray-400 dark:text-gray-600">{items.length} point{items.length > 1 ? "s" : ""}</span>
                </div>
                {/* Tâches */}
                <div className="divide-y divide-gray-50 dark:divide-[#1A2235]">
                  {items.map(t => (
                    <motion.div
                      key={t.id}
                      layout
                      exit={{ opacity: 0, x: 100, transition: { duration: 0.3 } }}
                      className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition group"
                    >
                      <button onClick={() => cocher(t.id)}
                        className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 flex items-center justify-center transition flex-shrink-0 mt-0.5 group-hover:border-emerald-400">
                        <CheckCircle2 size={12} className="text-emerald-500 opacity-0 group-hover:opacity-100 transition" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 dark:text-gray-200">{t.description}</p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-0.5">
                          Ajouté le {new Date(t.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                        </p>
                      </div>
                      <button onClick={() => supprimer(t.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition flex-shrink-0">
                        <Trash2 size={12} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
