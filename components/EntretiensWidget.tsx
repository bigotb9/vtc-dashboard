"use client"

import { useEffect, useState } from "react"
import {
  Droplets, Plus, Trash2, CalendarClock, AlertTriangle,
  CheckCircle2, XCircle, FileDown, ChevronDown, ChevronUp,
} from "lucide-react"
import { toast } from "@/lib/toast"
import { motion, AnimatePresence } from "framer-motion"

// ── Checklist items ────────────────────────────────────────────────────────────
const CHECKLIST = [
  { key: "huile_moteur",            label: "Huile moteur"            },
  { key: "filtre_huile",            label: "Filtre à huile"          },
  { key: "filtre_air",              label: "Filtre à air"            },
  { key: "filtre_pollen",           label: "Filtre à pollen"         },
  { key: "liquide_refroidissement", label: "Liquide refroidissement" },
  { key: "huile_frein",             label: "Huile de frein"          },
  { key: "pneus",                   label: "Pneus"                   },
] as const

type CheckKey = typeof CHECKLIST[number]["key"]

type Entretien = {
  id:                      string
  date_realise:            string
  date_prochain:           string
  huile_moteur:            boolean
  filtre_huile:            boolean
  filtre_air:              boolean
  filtre_pollen:           boolean
  liquide_refroidissement: boolean
  huile_frein:             boolean
  pneus:                   boolean
  km_vidange:              number | null
  cout:                    number
  technicien:              string | null
  notes:                   string | null
}

type FormState = {
  date_realise: string
  km_vidange:   string
  technicien:   string
  notes:        string
} & Record<CheckKey, boolean>

function emptyForm(): FormState {
  return {
    date_realise: new Date().toISOString().split("T")[0],
    km_vidange: "", technicien: "", notes: "",
    huile_moteur: false, filtre_huile: false, filtre_air: false,
    filtre_pollen: false, liquide_refroidissement: false,
    huile_frein: false, pneus: false,
  }
}

function joursRestants(date: string): number {
  return Math.floor((new Date(date).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)
}

function NextBadge({ dateProchain }: { dateProchain: string }) {
  const j = joursRestants(dateProchain)
  const cls = j < 0
    ? "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400"
    : j <= 7
    ? "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400"
    : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
  const icon = j < 0 ? <AlertTriangle size={9} /> : <CalendarClock size={9} />
  const txt  = j < 0 ? `Retard ${Math.abs(j)}j` : j === 0 ? "Aujourd'hui" : `J+${j}`
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}`}>
      {icon}{txt}
    </span>
  )
}

function CheckItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium ${
      done
        ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
        : "bg-gray-100 dark:bg-[#1A2235] text-gray-400 dark:text-gray-600"
    }`}>
      {done
        ? <CheckCircle2 size={11} className="flex-shrink-0" />
        : <XCircle     size={11} className="flex-shrink-0" />
      }
      {label}
    </div>
  )
}

// ── PDF export ─────────────────────────────────────────────────────────────────
async function exportPdf(immatriculation: string, entretiens: Entretien[], from: string, to: string) {
  const { generatePdf } = await import("@/lib/exportPdf")

  const rows = entretiens.map(e => [
    new Date(e.date_realise).toLocaleDateString("fr-FR"),
    new Date(e.date_prochain).toLocaleDateString("fr-FR"),
    e.km_vidange ? `${e.km_vidange.toLocaleString("fr-FR")} km` : "—",
    CHECKLIST.filter(c => e[c.key]).map(c => c.label).join(", ") || "Aucun",
    CHECKLIST.filter(c => !e[c.key]).map(c => c.label).join(", ") || "Tous faits ✓",
    e.technicien || "—",
  ])

  const periodLabel = from && to ? `du ${new Date(from).toLocaleDateString("fr-FR")} au ${new Date(to).toLocaleDateString("fr-FR")}` : "historique complet"

  const doc = await generatePdf({
    title:    `Rapport Vidanges — ${immatriculation}`,
    subtitle: `Cycle 21 jours · ${periodLabel} · ${entretiens.length} vidange${entretiens.length > 1 ? "s" : ""}`,
    sections: [{
      title:     "Historique des vidanges",
      headers:   ["Date", "Prochain", "Kilométrage", "Points faits", "Points manquants", "Technicien"],
      colWidths: [24, 24, 24, 52, 52, 26],
      rows,
    }],
  })
  doc.save(`vidanges_${immatriculation}_${new Date().toISOString().split("T")[0]}.pdf`)
  toast.success(`PDF généré — ${entretiens.length} vidange${entretiens.length > 1 ? "s" : ""}`)
}

// ── Widget principal ───────────────────────────────────────────────────────────
export default function EntretiensWidget({
  idVehicule,
  immatriculation,
}: {
  idVehicule:     number
  immatriculation: string
}) {
  const [entretiens,  setEntretiens]  = useState<Entretien[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showForm,    setShowForm]    = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [expandedId,  setExpandedId]  = useState<string | null>(null)
  const [exporting,   setExporting]   = useState(false)
  const [pdfFrom,     setPdfFrom]     = useState("")
  const [pdfTo,       setPdfTo]       = useState("")
  const [showPdfOpts, setShowPdfOpts] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())

  const load = async () => {
    setLoading(true)
    const res  = await fetch(`/api/entretiens?id_vehicule=${idVehicule}`)
    const data = await res.json()
    setEntretiens(data.entretiens || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [idVehicule])

  const save = async () => {
    if (!form.date_realise) return
    setSaving(true)
    const res  = await fetch("/api/entretiens", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id_vehicule: idVehicule, immatriculation, ...form, km_vidange: Number(form.km_vidange) || null }),
    })
    const data = await res.json()
    if (data.success) {
      toast.success("Vidange enregistrée — prochain rappel dans 21 jours")
      setShowForm(false)
      setForm(emptyForm())
      load()
    } else {
      toast.error(data.error || "Erreur")
    }
    setSaving(false)
  }

  const del = async (id: string) => {
    await fetch(`/api/entretiens?id=${id}`, { method: "DELETE" })
    toast.success("Vidange supprimée")
    load()
  }

  const handleExportPdf = async () => {
    setExporting(true)
    setShowPdfOpts(false)
    // Filtrer selon la période choisie
    const filtered = entretiens.filter(e => {
      if (pdfFrom && e.date_realise < pdfFrom) return false
      if (pdfTo   && e.date_realise > pdfTo)   return false
      return true
    })
    await exportPdf(immatriculation, filtered, pdfFrom, pdfTo)
    setExporting(false)
  }

  const inp = "w-full bg-gray-50 dark:bg-[#080C14] border border-gray-200 dark:border-[#1E2D45] rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"

  const dernier  = entretiens[0]
  const prochain = dernier?.date_prochain

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500">
            <Droplets size={13} className="text-white" />
          </span>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Vidanges</span>
            <p className="text-[10px] text-gray-400 dark:text-gray-600">
              Cycle 21 jours · {entretiens.length} enregistrée{entretiens.length > 1 ? "s" : ""}
              {prochain && <> · <NextBadge dateProchain={prochain} /></>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Export PDF */}
          <div className="relative">
            <button
              onClick={() => setShowPdfOpts(p => !p)}
              disabled={exporting || entretiens.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-[#1E2D45] text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-500/40 transition disabled:opacity-40">
              {exporting
                ? <span className="w-3.5 h-3.5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                : <FileDown size={13} />
              }
              PDF
            </button>
            {showPdfOpts && (
              <div className="absolute top-full mt-1 right-0 z-20 bg-white dark:bg-[#0D1424] border border-gray-200 dark:border-[#1E2D45] rounded-xl p-4 shadow-xl w-60 space-y-3">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Période du rapport</p>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Du</label>
                  <input type="date" value={pdfFrom} onChange={e => setPdfFrom(e.target.value)} className={inp} />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Au</label>
                  <input type="date" value={pdfTo} onChange={e => setPdfTo(e.target.value)} className={inp} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setPdfFrom(""); setPdfTo(""); handleExportPdf() }}
                    className="flex-1 py-1.5 rounded-lg border border-gray-200 dark:border-[#1E2D45] text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5 transition">
                    Tout exporter
                  </button>
                  <button onClick={handleExportPdf}
                    className="flex-1 py-1.5 rounded-lg bg-blue-600 text-xs text-white font-semibold hover:bg-blue-700 transition">
                    Exporter
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Nouvelle vidange */}
          <button onClick={() => { setShowForm(p => !p); setForm(emptyForm()) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition">
            <Plus size={13} />{showForm ? "Annuler" : "Nouvelle vidange"}
          </button>
        </div>
      </div>

      {/* Formulaire nouvelle vidange */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border border-blue-200 dark:border-blue-500/30 rounded-2xl bg-blue-50/30 dark:bg-blue-500/5 p-4 space-y-4">
              {/* Infos générales */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Date *</label>
                  <input type="date" value={form.date_realise} onChange={e => setForm(p => ({ ...p, date_realise: e.target.value }))} className={inp} />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Kilométrage</label>
                  <input type="number" placeholder="Ex: 45000" value={form.km_vidange} onChange={e => setForm(p => ({ ...p, km_vidange: e.target.value }))} className={inp} />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Technicien</label>
                  <input type="text" placeholder="Nom..." value={form.technicien} onChange={e => setForm(p => ({ ...p, technicien: e.target.value }))} className={inp} />
                </div>
              </div>

              {/* Checklist */}
              <div>
                <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Points de contrôle — cocher si fait ✓
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CHECKLIST.map(item => (
                    <label key={item.key}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition select-none ${
                        form[item.key]
                          ? "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/40"
                          : "bg-white dark:bg-[#080C14] border-gray-200 dark:border-[#1E2D45] hover:border-gray-300 dark:hover:border-gray-600"
                      }`}>
                      <input
                        type="checkbox"
                        checked={form[item.key]}
                        onChange={e => setForm(p => ({ ...p, [item.key]: e.target.checked }))}
                        className="accent-emerald-500 w-3.5 h-3.5 flex-shrink-0"
                      />
                      <span className={`text-xs font-medium ${form[item.key] ? "text-emerald-700 dark:text-emerald-400" : "text-gray-600 dark:text-gray-400"}`}>
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Notes</label>
                <input type="text" placeholder="Observations particulières..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className={inp} />
              </div>

              <div className="flex justify-between items-center pt-1">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  Prochain rappel automatique : {
                    form.date_realise
                      ? new Date(new Date(form.date_realise).getTime() + 21 * 86400000).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
                      : "—"
                  }
                </p>
                <button onClick={save} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold transition">
                  {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={14} />}
                  Enregistrer la vidange
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Historique */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <span className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : entretiens.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-gray-400 dark:text-gray-600">
          <Droplets size={28} className="opacity-30" />
          <p className="text-sm font-medium">Aucune vidange enregistrée</p>
          <p className="text-xs">Cliquez sur "Nouvelle vidange" pour commencer le suivi</p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[400px] overflow-y-auto">
          {entretiens.map(e => {
            const done    = CHECKLIST.filter(c => e[c.key])
            const missing = CHECKLIST.filter(c => !e[c.key])
            const isOpen  = expandedId === e.id
            return (
              <div key={e.id} className="rounded-2xl border border-gray-100 dark:border-[#1E2D45] bg-gray-50 dark:bg-[#080C14] overflow-hidden group">
                {/* Row summary */}
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpandedId(isOpen ? null : e.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        {new Date(e.date_realise).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                      </span>
                      <NextBadge dateProchain={e.date_prochain} />
                      {e.km_vidange && (
                        <span className="text-[10px] text-gray-400 font-numeric">{e.km_vidange.toLocaleString("fr-FR")} km</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ {done.length}/7 faits</span>
                      {missing.length > 0 && (
                        <span className="text-gray-400 dark:text-gray-600">· manque : {missing.map(c => c.label).join(", ")}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                    <button onClick={ev => { ev.stopPropagation(); del(e.id) }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Détail checklist */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-[#1E2D45] pt-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          {CHECKLIST.map(c => (
                            <CheckItem key={c.key} done={e[c.key]} label={c.label} />
                          ))}
                        </div>
                        {(e.technicien || e.notes) && (
                          <div className="flex gap-4 text-xs text-gray-400 dark:text-gray-600">
                            {e.technicien && <span>👤 {e.technicien}</span>}
                            {e.notes      && <span>📝 {e.notes}</span>}
                          </div>
                        )}
                        <p className="text-[10px] text-gray-400 dark:text-gray-600">
                          Prochain : {new Date(e.date_prochain).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
