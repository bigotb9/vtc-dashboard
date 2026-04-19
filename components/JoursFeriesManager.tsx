"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { PartyPopper, Plus, Trash2, CalendarDays, Download } from "lucide-react"
import { toast } from "@/lib/toast"
import { motion, AnimatePresence } from "framer-motion"

type Ferie = { date: string; libelle: string; montant: number }

// Jours fériés officiels Côte d'Ivoire
// Les dates islamiques sont approximatives (dépendent du croissant lunaire, ajustables à ±1-2 jours)
const FERIES_CI: Record<number, { date: string; libelle: string }[]> = {
  2026: [
    { date: "2026-01-01", libelle: "Jour de l'an" },
    { date: "2026-03-20", libelle: "Aïd el-Fitr (approx.)" },
    { date: "2026-04-06", libelle: "Lundi de Pâques" },
    { date: "2026-05-01", libelle: "Fête du travail" },
    { date: "2026-05-14", libelle: "Ascension" },
    { date: "2026-05-25", libelle: "Lundi de Pentecôte" },
    { date: "2026-05-27", libelle: "Aïd el-Kebir / Tabaski (approx.)" },
    { date: "2026-08-07", libelle: "Fête de l'indépendance" },
    { date: "2026-08-15", libelle: "Assomption" },
    { date: "2026-08-25", libelle: "Maouloud (approx.)" },
    { date: "2026-11-01", libelle: "Toussaint" },
    { date: "2026-11-15", libelle: "Journée nationale de la paix" },
    { date: "2026-12-25", libelle: "Noël" },
  ],
  2027: [
    { date: "2027-01-01", libelle: "Jour de l'an" },
    { date: "2027-03-09", libelle: "Aïd el-Fitr (approx.)" },
    { date: "2027-03-29", libelle: "Lundi de Pâques" },
    { date: "2027-05-01", libelle: "Fête du travail" },
    { date: "2027-05-06", libelle: "Ascension" },
    { date: "2027-05-16", libelle: "Aïd el-Kebir / Tabaski (approx.)" },
    { date: "2027-05-17", libelle: "Lundi de Pentecôte" },
    { date: "2027-08-07", libelle: "Fête de l'indépendance" },
    { date: "2027-08-14", libelle: "Maouloud (approx.)" },
    { date: "2027-08-15", libelle: "Assomption" },
    { date: "2027-11-01", libelle: "Toussaint" },
    { date: "2027-11-15", libelle: "Journée nationale de la paix" },
    { date: "2027-12-25", libelle: "Noël" },
  ],
}

export default function JoursFeriesManager() {
  const [feries,  setFeries]  = useState<Ferie[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [form,    setForm]    = useState({ date: "", libelle: "", montant: "15000" })
  const [token,   setToken]   = useState("")

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) setToken(data.session.access_token)
    })
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    const res  = await fetch("/api/jours-feries")
    const data = await res.json()
    if (data.ok) setFeries(data.feries || [])
    setLoading(false)
  }

  const ajouter = async () => {
    if (!form.date || !form.libelle) {
      toast.warning("Date et libellé requis")
      return
    }
    setSaving(true)
    const res  = await fetch("/api/jours-feries", {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ date: form.date, libelle: form.libelle, montant: Number(form.montant) || 15000 }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.ok) {
      toast.success("Jour férié ajouté")
      setForm({ date: "", libelle: "", montant: "15000" })
      load()
    } else {
      toast.error(data.error || "Erreur")
    }
  }

  const importerAnnee = async (annee: number) => {
    const liste = FERIES_CI[annee]
    if (!liste) return
    setSaving(true)
    let imported = 0
    let skipped  = 0
    for (const f of liste) {
      const res = await fetch("/api/jours-feries", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ date: f.date, libelle: f.libelle, montant: 15000 }),
      })
      const data = await res.json()
      if (data.ok) imported++; else skipped++
    }
    setSaving(false)
    toast.success(`${imported} jours fériés ${annee} importés${skipped > 0 ? ` (${skipped} existaient déjà)` : ""}`)
    load()
  }

  const supprimer = async (date: string) => {
    const res  = await fetch(`/api/jours-feries?date=${date}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (data.ok) {
      toast.success("Jour férié supprimé")
      setFeries(f => f.filter(x => x.date !== date))
    } else {
      toast.error(data.error || "Erreur")
    }
  }

  const inp = "w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-[#1E2D45] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"

  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-6 shadow-sm space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-[#1E2D45] flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <PartyPopper size={13} className="text-white" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Jours fériés</span>
            <p className="text-[10px] text-gray-400 dark:text-gray-600">Recette attendue = 15 000 FCFA par défaut · justification auto dans le suivi</p>
          </div>
        </div>
        {/* Import rapide */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400 mr-1">Import CI :</span>
          {[2026, 2027].map(annee => (
            <button key={annee} onClick={() => importerAnnee(annee)} disabled={saving}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30 text-violet-700 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-500/20 transition disabled:opacity-50">
              <Download size={10} />{annee}
            </button>
          ))}
        </div>
      </div>

      {/* Formulaire ajout */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-1">
          <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase block mb-1.5">Date *</label>
          <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className={inp} />
        </div>
        <div className="sm:col-span-2">
          <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase block mb-1.5">Libellé *</label>
          <input type="text" value={form.libelle} onChange={e => setForm(p => ({ ...p, libelle: e.target.value }))}
            placeholder="Ex: Fête du travail, Tabaski…" className={inp} />
        </div>
        <div className="sm:col-span-1">
          <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase block mb-1.5">Montant (FCFA)</label>
          <input type="number" value={form.montant} onChange={e => setForm(p => ({ ...p, montant: e.target.value }))} className={inp} />
        </div>
        <button onClick={ajouter} disabled={saving}
          className="sm:col-span-4 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white text-sm font-semibold shadow-md shadow-violet-500/20 transition disabled:opacity-50">
          {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={14} />}
          Ajouter le jour férié
        </button>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <span className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : feries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-gray-400 dark:text-gray-600">
          <CalendarDays size={28} className="opacity-30" />
          <p className="text-sm">Aucun jour férié enregistré</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <AnimatePresence>
            {feries.map(f => (
              <motion.div key={f.date}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0  }}
                exit={{ opacity: 0, x: 100  }}
                className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-[#1E2D45] bg-gray-50/50 dark:bg-white/[0.02] group">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                    <PartyPopper size={14} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{f.libelle}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(f.date).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                      {" · "}
                      <span className="font-numeric text-violet-600 dark:text-violet-400">{Number(f.montant).toLocaleString("fr-FR")} FCFA</span>
                    </p>
                  </div>
                </div>
                <button onClick={() => supprimer(f.date)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition">
                  <Trash2 size={13} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
