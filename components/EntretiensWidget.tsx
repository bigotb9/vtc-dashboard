"use client"

import { useEffect, useState, useMemo } from "react"
import {
  Droplets, Plus, Trash2, CalendarClock, AlertTriangle,
  CheckCircle2, XCircle, FileDown, ChevronDown, ChevronUp,
  Lightbulb, Car, Sofa, Wrench, Circle, Gauge, FileText, Shield, Printer,
} from "lucide-react"
import { toast } from "@/lib/toast"
import { motion, AnimatePresence } from "framer-motion"

// ── Types inspection ───────────────────────────────────────────────────────────
type EtatBon   = "bon" | "mauvais" | "tres_mauvais"
type EtatMeca  = "ok" | "a_surveiller" | "critique"
type EtatPneu  = "bon" | "use" | "a_changer"
type EtatDoc   = "valide" | "expire" | "absent"
type EtatElec  = "marche" | "panne" | "absent"

type Inspection = {
  eclairage: Record<string, boolean>
  carrosserie: Record<string, EtatBon>
  interieur: Record<string, EtatBon | EtatElec | "complet" | "incomplet">
  mecanique: Record<string, EtatMeca>
  pneus: Record<string, EtatPneu | "present" | "absent" | "ok" | "a_verifier">
  freinage: Record<string, EtatMeca | "marche" | "panne">
  documents: Record<string, EtatDoc>
  equipements: Record<string, boolean>
}

function defaultInspection(): Inspection {
  return {
    eclairage: {
      phares_croisement: true, phares_route: true, feux_arriere: true,
      feux_stop: true, clignotants_av_g: true, clignotants_av_d: true,
      clignotants_ar_g: true, clignotants_ar_d: true, feux_recul: true,
      feux_plaque: true, feux_detresse: true, feux_brouillard: true,
    },
    carrosserie: {
      avant: "bon", arriere: "bon", cote_conducteur: "bon",
      cote_passager: "bon", toit: "bon", pare_brise: "bon", vitres: "bon",
    },
    interieur: {
      sieges_avant: "bon", sieges_arriere: "bon", tableau_de_bord: "bon",
      clim: "marche", autoradio: "marche", ceintures: "complet", proprete: "bon",
    },
    mecanique: {
      huile_moteur: "ok", liquide_refroid: "ok", liquide_frein: "ok",
      lave_glace: "ok", courroie: "ok", filtre_air: "ok", batterie: "ok",
    },
    pneus: {
      avant_gauche: "bon", avant_droit: "bon",
      arriere_gauche: "bon", arriere_droit: "bon",
      secours: "present", pression: "ok",
    },
    freinage: { avant: "ok", arriere: "ok", frein_main: "marche" },
    documents: { carte_grise: "valide", assurance: "valide", controle_technique: "valide" },
    equipements: { extincteur: true, triangle: true, cric: true, cables: true },
  }
}

function detectAlertes(ins: Inspection): string[] {
  const a: string[] = []
  const ECL_FR: Record<string, string> = {
    phares_croisement: "Phares croisement", phares_route: "Phares route",
    feux_arriere: "Feux arrière", feux_stop: "Feux stop",
    clignotants_av_g: "Clignotant AV G", clignotants_av_d: "Clignotant AV D",
    clignotants_ar_g: "Clignotant AR G", clignotants_ar_d: "Clignotant AR D",
    feux_recul: "Feux recul", feux_plaque: "Feux plaque",
    feux_detresse: "Feux détresse", feux_brouillard: "Brouillard",
  }
  Object.entries(ins.eclairage).forEach(([k, v]) => { if (!v) a.push(`🔦 ${ECL_FR[k] || k} en panne`) })
  Object.entries(ins.carrosserie).forEach(([k, v]) => { if (v === "tres_mauvais") a.push(`🚗 Carrosserie ${k.replace(/_/g, " ")} — très mauvais`) })
  Object.entries(ins.interieur).forEach(([k, v]) => {
    if (v === "tres_mauvais" || v === "panne") a.push(`🪑 Intérieur: ${k.replace(/_/g, " ")} — ${v === "panne" ? "en panne" : "très mauvais"}`)
  })
  Object.entries(ins.mecanique).forEach(([k, v]) => { if (v === "critique") a.push(`🔧 Mécanique: ${k.replace(/_/g, " ")} critique`) })
  Object.entries(ins.pneus).forEach(([k, v]) => {
    if (v === "a_changer") a.push(`🛞 Pneu ${k.replace(/_/g, " ")} à changer`)
    if (k === "secours" && v === "absent") a.push("🛞 Pneu de secours absent")
  })
  Object.entries(ins.freinage).forEach(([k, v]) => {
    if (v === "critique" || v === "panne") a.push(`🛑 Freinage ${k.replace(/_/g, " ")} — ${v}`)
  })
  Object.entries(ins.documents).forEach(([k, v]) => {
    if (v === "expire") a.push(`📄 ${k.replace(/_/g, " ")} expiré`)
    if (v === "absent") a.push(`📄 ${k.replace(/_/g, " ")} absent`)
  })
  if (!ins.equipements.extincteur) a.push("🧯 Extincteur absent")
  if (!ins.equipements.triangle)   a.push("⚠️ Triangle absent")
  return a
}

// ── Points de vidange (ancienne checklist) ─────────────────────────────────────
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
  id: string; date_realise: string; date_prochain: string
  huile_moteur: boolean; filtre_huile: boolean; filtre_air: boolean
  filtre_pollen: boolean; liquide_refroidissement: boolean; huile_frein: boolean; pneus: boolean
  km_vidange: number | null; cout: number; technicien: string | null; notes: string | null
  inspection: Inspection | null
}

type FormState = {
  date_realise: string; km_vidange: string; technicien: string; notes: string
  inspection: Inspection
} & Record<CheckKey, boolean>

function emptyForm(): FormState {
  return {
    date_realise: new Date().toISOString().split("T")[0],
    km_vidange: "", technicien: "", notes: "",
    huile_moteur: false, filtre_huile: false, filtre_air: false,
    filtre_pollen: false, liquide_refroidissement: false, huile_frein: false, pneus: false,
    inspection: defaultInspection(),
  }
}

function joursRestants(date: string) {
  return Math.floor((new Date(date).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)
}

function NextBadge({ dateProchain }: { dateProchain: string }) {
  const j = joursRestants(dateProchain)
  const cls = j < 0
    ? "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400"
    : j <= 7
    ? "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400"
    : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}`}>
      {j < 0 ? <AlertTriangle size={9} /> : <CalendarClock size={9} />}
      {j < 0 ? `Retard ${Math.abs(j)}j` : j === 0 ? "Aujourd'hui" : `J+${j}`}
    </span>
  )
}

// ── Composants formulaire ──────────────────────────────────────────────────────
function SecHeader({ icon: Icon, label, color }: { icon: React.ElementType; label: string; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${color} mb-3`}>
      <Icon size={13} className="text-white flex-shrink-0" />
      <span className="text-[11px] font-bold text-white uppercase tracking-wider">{label}</span>
    </div>
  )
}

const BTN_BON   = "bg-emerald-500 text-white"
const BTN_MAUV  = "bg-amber-500 text-white"
const BTN_TRES  = "bg-red-500 text-white"
const BTN_OK    = "bg-emerald-500 text-white"
const BTN_SURV  = "bg-amber-500 text-white"
const BTN_CRIT  = "bg-red-500 text-white"
const BTN_BASE  = "bg-gray-100 dark:bg-[#1A2235] text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#1E2D45]"

function RadioBtn({ active, color, label, onClick }: { active: boolean; color: string; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${active ? color : BTN_BASE}`}>
      {label}
    </button>
  )
}

function InspRow3({ label, val, options, onChange }: {
  label: string; val: string
  options: { value: string; label: string; color: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-100 dark:border-[#1E2D45] last:border-0">
      <span className="text-xs text-gray-600 dark:text-gray-400 flex-1 min-w-0 truncate">{label}</span>
      <div className="flex gap-1 flex-shrink-0">
        {options.map(o => (
          <RadioBtn key={o.value} active={val === o.value} color={o.color} label={o.label} onClick={() => onChange(o.value)} />
        ))}
      </div>
    </div>
  )
}

function ToggleRow({ label, val, onLabel, offLabel, onChange }: {
  label: string; val: boolean; onLabel: string; offLabel: string; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-100 dark:border-[#1E2D45] last:border-0">
      <span className="text-xs text-gray-600 dark:text-gray-400 flex-1 min-w-0 truncate">{label}</span>
      <div className="flex gap-1 flex-shrink-0">
        <RadioBtn active={val}  color={BTN_OK}   label={onLabel}  onClick={() => onChange(true)} />
        <RadioBtn active={!val} color={BTN_CRIT}  label={offLabel} onClick={() => onChange(false)} />
      </div>
    </div>
  )
}

const OPT_BON3  = [
  { value: "bon",         label: "Bon",      color: BTN_BON  },
  { value: "mauvais",     label: "Mauvais",  color: BTN_MAUV },
  { value: "tres_mauvais",label: "Très mauv",color: BTN_TRES },
]
const OPT_MECA  = [
  { value: "ok",           label: "OK",       color: BTN_OK   },
  { value: "a_surveiller", label: "Surveiller",color: BTN_SURV },
  { value: "critique",     label: "Critique", color: BTN_CRIT },
]
const OPT_PNEU  = [
  { value: "bon",      label: "Bon",      color: BTN_BON  },
  { value: "use",      label: "Usé",      color: BTN_SURV },
  { value: "a_changer",label: "À changer",color: BTN_CRIT },
]
const OPT_DOC   = [
  { value: "valide", label: "Valide",  color: BTN_BON  },
  { value: "expire", label: "Expiré",  color: BTN_TRES },
  { value: "absent", label: "Absent",  color: BTN_CRIT },
]
const OPT_ELEC  = [
  { value: "marche", label: "Marche",  color: BTN_OK   },
  { value: "panne",  label: "Panne",   color: BTN_CRIT },
  { value: "absent", label: "Absent",  color: BTN_MAUV },
]
const OPT_PRES  = [
  { value: "present",  label: "Présent",   color: BTN_OK   },
  { value: "a_changer",label: "À changer", color: BTN_SURV },
  { value: "absent",   label: "Absent",    color: BTN_CRIT },
]

async function exportPdf(immatriculation: string, entretiens: Entretien[], from: string, to: string) {
  const { generatePdf } = await import("@/lib/exportPdf")
  const rows = entretiens.map(e => [
    new Date(e.date_realise).toLocaleDateString("fr-FR"),
    new Date(e.date_prochain).toLocaleDateString("fr-FR"),
    e.km_vidange ? `${e.km_vidange.toLocaleString("fr-FR")} km` : "—",
    CHECKLIST.filter(c => e[c.key]).map(c => c.label).join(", ") || "—",
    e.technicien || "—",
    e.notes || "—",
  ])
  const periodLabel = from && to
    ? `du ${new Date(from).toLocaleDateString("fr-FR")} au ${new Date(to).toLocaleDateString("fr-FR")}`
    : "historique complet"
  const doc = await generatePdf({
    title:    `Rapport Vidanges — ${immatriculation}`,
    subtitle: `Cycle 21 jours · ${periodLabel} · ${entretiens.length} vidange${entretiens.length > 1 ? "s" : ""}`,
    sections: [{
      title:     "Historique des vidanges",
      headers:   ["Date", "Prochain", "Kilométrage", "Points vidange", "Technicien", "Notes"],
      colWidths: [24, 24, 24, 50, 30, 42],
      rows,
    }],
  })
  doc.save(`vidanges_${immatriculation}_${new Date().toISOString().split("T")[0]}.pdf`)
  toast.success(`PDF généré — ${entretiens.length} vidange${entretiens.length > 1 ? "s" : ""}`)
}

// ── Widget principal ───────────────────────────────────────────────────────────
export default function EntretiensWidget({ idVehicule, immatriculation }: { idVehicule: number; immatriculation: string }) {
  const [entretiens,  setEntretiens]  = useState<Entretien[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showForm,    setShowForm]    = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [expandedId,  setExpandedId]  = useState<string | null>(null)
  const [exporting,   setExporting]   = useState(false)
  const [printingForm, setPrintingForm] = useState(false)
  const [pdfFrom,     setPdfFrom]     = useState("")
  const [pdfTo,       setPdfTo]       = useState("")
  const [showPdfOpts, setShowPdfOpts] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())

  const alertes = useMemo(() => detectAlertes(form.inspection), [form.inspection])

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
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_vehicule: idVehicule, immatriculation, ...form, km_vidange: Number(form.km_vidange) || null }),
    })
    const data = await res.json()
    if (data.success) {
      const nb = alertes.length
      toast.success(nb > 0
        ? `Vidange enregistrée · ${nb} réparation${nb > 1 ? "s" : ""} à programmer créée${nb > 1 ? "s" : ""}`
        : "Vidange enregistrée — prochain rappel dans 21 jours")
      setShowForm(false); setForm(emptyForm()); load()
    } else toast.error(data.error || "Erreur")
    setSaving(false)
  }

  const del = async (id: string) => {
    await fetch(`/api/entretiens?id=${id}`, { method: "DELETE" })
    toast.success("Vidange supprimée"); load()
  }

  // helpers pour mettre à jour l'inspection
  const setIns = <S extends keyof Inspection>(section: S, key: string, val: unknown) =>
    setForm(p => ({ ...p, inspection: { ...p.inspection, [section]: { ...p.inspection[section], [key]: val } } }))

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
            <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Vidanges & Inspection</span>
            <p className="text-[10px] text-gray-400 dark:text-gray-600">
              Cycle 21 jours · {entretiens.length} enregistrée{entretiens.length > 1 ? "s" : ""}
              {prochain && <> · <NextBadge dateProchain={prochain} /></>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Fiche papier */}
          <button onClick={async () => { setPrintingForm(true); const { exportFicheInspectionPdf } = await import("@/lib/exportPdf"); await exportFicheInspectionPdf(immatriculation); setPrintingForm(false) }}
            disabled={printingForm}
            title="Télécharger fiche d'inspection papier"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-[#1E2D45] text-xs font-semibold text-gray-500 hover:text-violet-600 hover:border-violet-300 dark:hover:border-violet-500/40 transition disabled:opacity-40">
            {printingForm ? <span className="w-3.5 h-3.5 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" /> : <Printer size={13} />}
            Fiche papier
          </button>

          {/* PDF */}
          <div className="relative">
            <button onClick={() => setShowPdfOpts(p => !p)} disabled={exporting || entretiens.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-[#1E2D45] text-xs font-semibold text-gray-500 hover:text-blue-600 hover:border-blue-300 transition disabled:opacity-40">
              {exporting ? <span className="w-3.5 h-3.5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /> : <FileDown size={13} />}
              PDF
            </button>
            {showPdfOpts && (
              <div className="absolute top-full mt-1 right-0 z-20 bg-white dark:bg-[#0D1424] border border-gray-200 dark:border-[#1E2D45] rounded-xl p-4 shadow-xl w-60 space-y-3">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Période du rapport</p>
                <div><label className="text-[10px] text-gray-400 block mb-1">Du</label>
                  <input type="date" value={pdfFrom} onChange={e => setPdfFrom(e.target.value)} className={inp} /></div>
                <div><label className="text-[10px] text-gray-400 block mb-1">Au</label>
                  <input type="date" value={pdfTo} onChange={e => setPdfTo(e.target.value)} className={inp} /></div>
                <div className="flex gap-2">
                  <button onClick={() => { setPdfFrom(""); setPdfTo(""); setExporting(true); exportPdf(immatriculation, entretiens, "", "").finally(() => setExporting(false)) }}
                    className="flex-1 py-1.5 rounded-lg border border-gray-200 dark:border-[#1E2D45] text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5 transition">Tout</button>
                  <button onClick={() => { const f = entretiens.filter(e => (!pdfFrom || e.date_realise >= pdfFrom) && (!pdfTo || e.date_realise <= pdfTo)); setExporting(true); exportPdf(immatriculation, f, pdfFrom, pdfTo).finally(() => setExporting(false)) }}
                    className="flex-1 py-1.5 rounded-lg bg-blue-600 text-xs text-white font-semibold hover:bg-blue-700 transition">Exporter</button>
                </div>
              </div>
            )}
          </div>
          <button onClick={() => { setShowForm(p => !p); setForm(emptyForm()) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition">
            <Plus size={13} />{showForm ? "Annuler" : "Nouvelle vidange"}
          </button>
        </div>
      </div>

      {/* Formulaire */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="border border-blue-200 dark:border-blue-500/30 rounded-2xl bg-blue-50/20 dark:bg-blue-500/5 p-4 space-y-5">

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

              {/* Points vidange */}
              <div className="bg-white dark:bg-[#080C14] rounded-xl border border-gray-200 dark:border-[#1E2D45] p-3 space-y-2">
                <SecHeader icon={Droplets} label="Points de vidange — cocher si fait ✓" color="bg-blue-500" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CHECKLIST.map(item => (
                    <label key={item.key}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition select-none ${
                        form[item.key]
                          ? "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/40"
                          : "bg-gray-50 dark:bg-[#0D1424] border-gray-200 dark:border-[#1E2D45] hover:border-gray-300"
                      }`}>
                      <input type="checkbox" checked={form[item.key]}
                        onChange={e => setForm(p => ({ ...p, [item.key]: e.target.checked }))}
                        className="accent-emerald-500 w-3.5 h-3.5 flex-shrink-0" />
                      <span className={`text-xs font-medium ${form[item.key] ? "text-emerald-700 dark:text-emerald-400" : "text-gray-600 dark:text-gray-400"}`}>
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* INSPECTION — Éclairage */}
              <div className="bg-white dark:bg-[#080C14] rounded-xl border border-gray-200 dark:border-[#1E2D45] p-3">
                <SecHeader icon={Lightbulb} label="Éclairage" color="bg-yellow-500" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  {[
                    ["phares_croisement","Phares croisement"],["phares_route","Phares route"],
                    ["feux_arriere","Feux arrière"],["feux_stop","Feux de stop"],
                    ["clignotants_av_g","Clignotants avant G"],["clignotants_av_d","Clignotants avant D"],
                    ["clignotants_ar_g","Clignotants arrière G"],["clignotants_ar_d","Clignotants arrière D"],
                    ["feux_recul","Feux de recul"],["feux_plaque","Feux de plaque"],
                    ["feux_detresse","Feux de détresse"],["feux_brouillard","Feux brouillard"],
                  ].map(([k, l]) => (
                    <ToggleRow key={k} label={l} val={!!form.inspection.eclairage[k]}
                      onLabel="Marche" offLabel="Panne"
                      onChange={v => setIns("eclairage", k, v)} />
                  ))}
                </div>
              </div>

              {/* INSPECTION — Carrosserie */}
              <div className="bg-white dark:bg-[#080C14] rounded-xl border border-gray-200 dark:border-[#1E2D45] p-3">
                <SecHeader icon={Car} label="Carrosserie" color="bg-slate-600" />
                {[
                  ["avant","Face avant"],["arriere","Face arrière"],
                  ["cote_conducteur","Côté conducteur"],["cote_passager","Côté passager"],
                  ["toit","Toit"],["pare_brise","Pare-brise"],["vitres","Vitres"],
                ].map(([k, l]) => (
                  <InspRow3 key={k} label={l} val={form.inspection.carrosserie[k] as string}
                    options={OPT_BON3} onChange={v => setIns("carrosserie", k, v)} />
                ))}
              </div>

              {/* INSPECTION — Intérieur */}
              <div className="bg-white dark:bg-[#080C14] rounded-xl border border-gray-200 dark:border-[#1E2D45] p-3">
                <SecHeader icon={Sofa} label="Intérieur" color="bg-violet-600" />
                {[
                  ["sieges_avant","Sièges avant",OPT_BON3],
                  ["sieges_arriere","Sièges arrière",OPT_BON3],
                  ["tableau_de_bord","Tableau de bord",OPT_BON3],
                  ["proprete","Propreté",OPT_BON3],
                ].map(([k, l, o]) => (
                  <InspRow3 key={k as string} label={l as string} val={form.inspection.interieur[k as string] as string}
                    options={o as typeof OPT_BON3} onChange={v => setIns("interieur", k as string, v)} />
                ))}
                {[
                  ["clim","Climatisation"],["autoradio","Autoradio"],
                ].map(([k, l]) => (
                  <InspRow3 key={k} label={l} val={form.inspection.interieur[k] as string}
                    options={OPT_ELEC} onChange={v => setIns("interieur", k, v)} />
                ))}
                <InspRow3 label="Ceintures de sécurité" val={form.inspection.interieur.ceintures as string}
                  options={[
                    { value: "complet",   label: "Complet",   color: BTN_OK   },
                    { value: "incomplet", label: "Incomplet", color: BTN_TRES },
                  ]}
                  onChange={v => setIns("interieur", "ceintures", v)} />
              </div>

              {/* INSPECTION — Mécanique */}
              <div className="bg-white dark:bg-[#080C14] rounded-xl border border-gray-200 dark:border-[#1E2D45] p-3">
                <SecHeader icon={Wrench} label="Mécanique & Moteur" color="bg-orange-600" />
                {[
                  ["huile_moteur","Huile moteur"],["liquide_refroid","Liquide refroidissement"],
                  ["liquide_frein","Liquide de frein"],["lave_glace","Lave-glace"],
                  ["courroie","Courroie accessoires"],["filtre_air","Filtre à air"],
                  ["batterie","Batterie"],
                ].map(([k, l]) => (
                  <InspRow3 key={k} label={l} val={form.inspection.mecanique[k] as string}
                    options={OPT_MECA} onChange={v => setIns("mecanique", k, v)} />
                ))}
              </div>

              {/* INSPECTION — Pneumatiques */}
              <div className="bg-white dark:bg-[#080C14] rounded-xl border border-gray-200 dark:border-[#1E2D45] p-3">
                <SecHeader icon={Circle} label="Pneumatiques" color="bg-gray-600" />
                {[
                  ["avant_gauche","Pneu avant gauche"],["avant_droit","Pneu avant droit"],
                  ["arriere_gauche","Pneu arrière gauche"],["arriere_droit","Pneu arrière droit"],
                ].map(([k, l]) => (
                  <InspRow3 key={k} label={l} val={form.inspection.pneus[k] as string}
                    options={OPT_PNEU} onChange={v => setIns("pneus", k, v)} />
                ))}
                <InspRow3 label="Pneu de secours" val={form.inspection.pneus.secours as string}
                  options={OPT_PRES} onChange={v => setIns("pneus", "secours", v)} />
                <InspRow3 label="Pression générale" val={form.inspection.pneus.pression as string}
                  options={[
                    { value: "ok",        label: "OK",        color: BTN_OK   },
                    { value: "a_verifier",label: "À vérifier",color: BTN_SURV },
                  ]}
                  onChange={v => setIns("pneus", "pression", v)} />
              </div>

              {/* INSPECTION — Freinage */}
              <div className="bg-white dark:bg-[#080C14] rounded-xl border border-gray-200 dark:border-[#1E2D45] p-3">
                <SecHeader icon={Gauge} label="Freinage" color="bg-red-600" />
                <InspRow3 label="Freins avant" val={form.inspection.freinage.avant as string}
                  options={OPT_MECA} onChange={v => setIns("freinage", "avant", v)} />
                <InspRow3 label="Freins arrière" val={form.inspection.freinage.arriere as string}
                  options={OPT_MECA} onChange={v => setIns("freinage", "arriere", v)} />
                <ToggleRow label="Frein à main" val={form.inspection.freinage.frein_main === "marche"}
                  onLabel="Marche" offLabel="Panne"
                  onChange={v => setIns("freinage", "frein_main", v ? "marche" : "panne")} />
              </div>

              {/* INSPECTION — Documents */}
              <div className="bg-white dark:bg-[#080C14] rounded-xl border border-gray-200 dark:border-[#1E2D45] p-3">
                <SecHeader icon={FileText} label="Documents" color="bg-teal-600" />
                {[
                  ["carte_grise","Carte grise"],
                  ["assurance","Assurance"],
                  ["controle_technique","Contrôle technique"],
                ].map(([k, l]) => (
                  <InspRow3 key={k} label={l} val={form.inspection.documents[k] as string}
                    options={OPT_DOC} onChange={v => setIns("documents", k, v)} />
                ))}
              </div>

              {/* INSPECTION — Équipements de sécurité */}
              <div className="bg-white dark:bg-[#080C14] rounded-xl border border-gray-200 dark:border-[#1E2D45] p-3">
                <SecHeader icon={Shield} label="Équipements de sécurité" color="bg-indigo-600" />
                {[
                  ["extincteur","Extincteur"],["triangle","Triangle de signalisation"],
                  ["cric","Cric + clés de roue"],["cables","Câbles de démarrage"],
                ].map(([k, l]) => (
                  <ToggleRow key={k} label={l} val={!!form.inspection.equipements[k]}
                    onLabel="Présent" offLabel="Absent"
                    onChange={v => setIns("equipements", k, v)} />
                ))}
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Notes libres</label>
                <textarea rows={2} placeholder="Observations particulières..." value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className={`${inp} resize-none`} />
              </div>

              {/* Alerte si points critiques */}
              {alertes.length > 0 && (
                <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                    <span className="text-xs font-bold text-red-700 dark:text-red-400">
                      {alertes.length} point{alertes.length > 1 ? "s" : ""} critique{alertes.length > 1 ? "s" : ""} détecté{alertes.length > 1 ? "s" : ""} — réparations créées automatiquement
                    </span>
                  </div>
                  <ul className="space-y-0.5">
                    {alertes.map((a, i) => (
                      <li key={i} className="text-[11px] text-red-600 dark:text-red-400">• {a}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-between items-center pt-1">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  Prochain rappel : {form.date_realise
                    ? new Date(new Date(form.date_realise).getTime() + 21 * 86400000).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
                    : "—"}
                </p>
                <button onClick={save} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold transition">
                  {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={14} />}
                  Enregistrer
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
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[500px] overflow-y-auto">
          {entretiens.map(e => {
            const done    = CHECKLIST.filter(c => e[c.key])
            const missing = CHECKLIST.filter(c => !e[c.key])
            const isOpen  = expandedId === e.id
            const insAlertes = e.inspection ? detectAlertes(e.inspection) : []
            return (
              <div key={e.id} className="rounded-2xl border border-gray-100 dark:border-[#1E2D45] bg-gray-50 dark:bg-[#080C14] overflow-hidden group">
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpandedId(isOpen ? null : e.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        {new Date(e.date_realise).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                      </span>
                      <NextBadge dateProchain={e.date_prochain} />
                      {e.km_vidange && <span className="text-[10px] text-gray-400 font-numeric">{e.km_vidange.toLocaleString("fr-FR")} km</span>}
                      {insAlertes.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400">
                          <AlertTriangle size={9} />{insAlertes.length} alerte{insAlertes.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✓ {done.length}/7 faits</span>
                      {missing.length > 0 && <span className="text-gray-400">· {missing.map(c => c.label).join(", ")}</span>}
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
                <AnimatePresence>
                  {isOpen && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                      <div className="px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-[#1E2D45] pt-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          {CHECKLIST.map(c => (
                            <div key={c.key} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium ${
                              e[c.key]
                                ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                : "bg-gray-100 dark:bg-[#1A2235] text-gray-400"
                            }`}>
                              {e[c.key] ? <CheckCircle2 size={11} className="flex-shrink-0" /> : <XCircle size={11} className="flex-shrink-0" />}
                              {c.label}
                            </div>
                          ))}
                        </div>
                        {insAlertes.length > 0 && (
                          <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 p-2.5">
                            <p className="text-[10px] font-bold text-red-600 dark:text-red-400 mb-1">Alertes inspection</p>
                            {insAlertes.map((a, i) => <p key={i} className="text-[11px] text-red-500 dark:text-red-400">• {a}</p>)}
                          </div>
                        )}
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
