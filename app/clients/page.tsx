"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Users, Car, TrendingUp, TrendingDown, Wallet, ChevronDown, ChevronRight,
  Phone, Mail, RefreshCw, Plus, Building2, AlertCircle, Check, X,
  CalendarCheck, Clock, Banknote, Trash2
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────
type VehiculeStat = {
  id_vehicule: number
  immatriculation: string
  montant_mensuel_client: number
  revenu: number
  total_depenses: number
  boyah_support: number
  surplus_depense: number
  net_client: number
  profit_boyah: number
}

type Versement = {
  id: number
  id_client: number
  mois: string
  montant: number
  date_versement: string
  notes: string | null
}

type Client = {
  id: number
  nom: string
  telephone: string | null
  email: string | null
  notes: string | null
  vehicules: VehiculeStat[]
  totaux: {
    revenu: number
    total_depenses: number
    boyah_support: number
    net_client: number
    profit_boyah: number
  }
}

type Global = {
  revenu: number
  boyah_support: number
  net_client: number
  profit_boyah: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt      = (n: number) => Math.round(n).toLocaleString("fr-FR")
const sign     = (n: number) => (n >= 0 ? "+" : "") + fmt(n)
const moisLabel= (m: string) => new Date(m + "-15").toLocaleDateString("fr-FR", { month: "long", year: "numeric" })

// ── Logique de versement ──────────────────────────────────────────────────────
// Les clients sont payés entre le 5 et le 10 du mois SUIVANT l'exploitation.
// Ex : exploitation mars 2026 → versement entre le 5 et le 10 avril 2026.
type VersementStatus =
  | "deja_verse"    // vert — déjà payé
  | "a_verser"      // orange pulsé — fenêtre ouverte (5-10 du mois suivant)
  | "en_retard"     // rouge — passé le 10 sans paiement
  | "pas_encore_du" // bleu clair — mois terminé mais avant le 5 du suivant
  | "en_cours"      // gris clair — exploitation en cours (pas encore fini)
  | "futur"         // gris foncé — mois non encore commencé

function getVersementStatus(mois: string, today: Date, versement: { id: number } | null): VersementStatus {
  if (versement) return "deja_verse"
  const [y, m] = mois.split("-").map(Number)
  const debutMois   = new Date(y, m - 1, 1)
  const finMois     = new Date(y, m, 0, 23, 59, 59)         // dernier jour du mois
  const jour5Next   = new Date(y, m, 5)                     // 5 du mois suivant
  const jour10Next  = new Date(y, m, 10, 23, 59, 59)        // 10 du mois suivant

  if (today < debutMois)  return "futur"
  if (today <= finMois)   return "en_cours"
  if (today < jour5Next)  return "pas_encore_du"
  if (today <= jour10Next) return "a_verser"
  return "en_retard"
}

function fenetrePaiement(mois: string): string {
  const [y, m] = mois.split("-").map(Number)
  const j5  = new Date(y, m, 5)
  const j10 = new Date(y, m, 10)
  return `${j5.toLocaleDateString("fr-FR", { day: "numeric" })}–${j10.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`
}

const STATUS_CONFIG: Record<VersementStatus, {
  label: string; bg: string; border: string; iconBg: string; text: string; btnVariant: "primary" | "warn" | "danger" | "muted"
}> = {
  deja_verse: {
    label: "Payé", bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-500/20",
    iconBg: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400", btnVariant: "muted",
  },
  a_verser: {
    label: "À verser", bg: "bg-amber-50 dark:bg-amber-500/10", border: "border-amber-300 dark:border-amber-500/40",
    iconBg: "bg-amber-500", text: "text-amber-700 dark:text-amber-400", btnVariant: "warn",
  },
  en_retard: {
    label: "En retard", bg: "bg-red-50 dark:bg-red-500/10", border: "border-red-300 dark:border-red-500/40",
    iconBg: "bg-red-500", text: "text-red-700 dark:text-red-400", btnVariant: "danger",
  },
  pas_encore_du: {
    label: "Pas encore dû", bg: "bg-blue-50/50 dark:bg-blue-500/5", border: "border-blue-100 dark:border-blue-500/15",
    iconBg: "bg-blue-400", text: "text-blue-600 dark:text-blue-400", btnVariant: "primary",
  },
  en_cours: {
    label: "Exploitation en cours", bg: "bg-indigo-50/50 dark:bg-indigo-500/5", border: "border-indigo-100 dark:border-indigo-500/15",
    iconBg: "bg-indigo-400", text: "text-indigo-600 dark:text-indigo-400", btnVariant: "muted",
  },
  futur: {
    label: "À venir", bg: "bg-gray-50 dark:bg-white/[0.02]", border: "border-gray-100 dark:border-white/5",
    iconBg: "bg-gray-300 dark:bg-gray-700", text: "text-gray-400 dark:text-gray-600", btnVariant: "muted",
  },
}

/** Génère les 12 derniers mois (du plus récent au plus ancien) */
function derniersMois(n = 12): string[] {
  const mois: string[] = []
  const d = new Date()
  for (let i = 0; i < n; i++) {
    mois.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    d.setMonth(d.getMonth() - 1)
  }
  return mois
}

// ── KpiCard ───────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color, textColor }: {
  label: string; value: string; sub?: string
  icon: React.ElementType; color: string; textColor: string
}) {
  return (
    <div className="relative bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 overflow-hidden">
      <div className={`absolute -top-5 -right-5 w-24 h-24 rounded-full opacity-10 blur-2xl ${color}`} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</p>
          <p className={`text-2xl font-black mt-1 ${textColor}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center shadow-md flex-shrink-0`}>
          <Icon size={18} className="text-white" />
        </div>
      </div>
    </div>
  )
}

// ── Modal création client ─────────────────────────────────────────────────────
function CreateClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ nom: "", telephone: "", email: "", notes: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const submit = async () => {
    if (!form.nom.trim()) { setError("Le nom est requis"); return }
    setLoading(true)
    const res  = await fetch("/api/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
    const data = await res.json()
    if (data.ok) { onCreated() }
    else { setError(data.error || "Erreur"); setLoading(false) }
  }

  const inp = "w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-[#1E2D45]">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Nouveau client</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-white/5 transition"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Nom *</label>
            <input className={inp} placeholder="Nom du propriétaire" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Téléphone</label>
              <input className={inp} placeholder="+225 07..." value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Email</label>
              <input type="email" className={inp} placeholder="email@..." value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Notes</label>
            <textarea className={inp + " resize-none"} rows={2} placeholder="Infos supplémentaires..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-xs text-red-600 dark:text-red-400">
              <AlertCircle size={12} />{error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition">Annuler</button>
          <button onClick={submit} disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition disabled:opacity-50">
            {loading ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}Créer
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal versement ───────────────────────────────────────────────────────────
function VersementModal({
  client, mois, montantSuggere, versementExistant, onClose, onSaved
}: {
  client: Client
  mois: string
  montantSuggere: number
  versementExistant: Versement | null
  onClose: () => void
  onSaved: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [montant, setMontant]   = useState(String(versementExistant?.montant ?? Math.round(montantSuggere)))
  const [date, setDate]         = useState(versementExistant?.date_versement ?? today)
  const [notes, setNotes]       = useState(versementExistant?.notes ?? "")
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState("")

  const save = async () => {
    if (!montant || isNaN(Number(montant))) { setError("Montant invalide"); return }
    setLoading(true)
    try {
      const res  = await fetch("/api/clients/versements", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id_client: client.id, mois, montant: Number(montant), date_versement: date, notes }),
      })
      const data = await res.json()
      if (data.ok) { onSaved() }
      else { setError(data.error || "Erreur"); setLoading(false) }
    } catch { setLoading(false) }
  }

  const inp = "w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-[#1E2D45]">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Versement — {moisLabel(mois)}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{client.nom}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition"><X size={15} /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Montant suggéré */}
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
            <Banknote size={14} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              Net client calculé : <span className="font-bold">{fmt(montantSuggere)} FCFA</span>
            </p>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Montant versé (FCFA) *</label>
            <input type="number" className={inp} value={montant} onChange={e => setMontant(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Date du versement</label>
            <input type="date" className={inp} value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Notes (optionnel)</label>
            <input className={inp} placeholder="Virement Wave, espèces..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-xs text-red-600 dark:text-red-400">
              <AlertCircle size={12} />{error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition">Annuler</button>
          <button onClick={save} disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition disabled:opacity-50">
            {loading ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
            {versementExistant ? "Modifier" : "Confirmer versement"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Section versements ────────────────────────────────────────────────────────
function VersementsSection({ client, netClientMois, moisActuel }: {
  client: Client
  netClientMois: number
  moisActuel: string
}) {
  const [versements, setVersements]   = useState<Versement[]>([])
  const [loadingV, setLoadingV]       = useState(true)
  const [modal, setModal]             = useState<{ mois: string; montantSuggere: number; existant: Versement | null } | null>(null)
  const [deleting, setDeleting]       = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadingV(true)
    const res  = await fetch(`/api/clients/versements?id_client=${client.id}`)
    const data = await res.json()
    if (data.ok) setVersements(data.versements || [])
    setLoadingV(false)
  }, [client.id])

  useEffect(() => { load() }, [load])

  const moisListe = derniersMois(12)

  const getVersement = (m: string) => versements.find(v => v.mois === m) || null

  const annuler = async (mois: string) => {
    if (!confirm(`Annuler le versement de ${moisLabel(mois)} ?`)) return
    setDeleting(mois)
    await fetch(`/api/clients/versements?id_client=${client.id}&mois=${mois}`, { method: "DELETE" })
    await load()
    setDeleting(null)
  }

  // Compteurs (basés sur la fenêtre de paiement 5-10 du mois suivant)
  const today        = new Date()
  const totalVerse   = versements.reduce((s, v) => s + Number(v.montant), 0)
  const nbPaye       = versements.length
  const nbEnAttente  = moisListe.filter(m => {
    const st = getVersementStatus(m, today, getVersement(m))
    return st === "a_verser" || st === "en_retard"
  }).length
  const nbEnRetard   = moisListe.filter(m => getVersementStatus(m, today, getVersement(m)) === "en_retard").length

  return (
    <div className="border-t border-gray-100 dark:border-[#1E2D45]">
      {/* En-tête section */}
      <div className="flex items-center justify-between px-5 py-3 bg-gray-50/50 dark:bg-white/[0.02] flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <CalendarCheck size={14} className="text-indigo-500" />
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Suivi des versements</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {nbPaye} payé{nbPaye > 1 ? "s" : ""}
          </span>
          {nbEnAttente > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="font-semibold text-amber-700 dark:text-amber-400">{nbEnAttente} à verser</span>
            </span>
          )}
          {nbEnRetard > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="font-bold text-red-600 dark:text-red-400">{nbEnRetard} en retard</span>
            </span>
          )}
          <span className="font-semibold text-gray-700 dark:text-gray-300">
            Total versé : {fmt(totalVerse)} F
          </span>
        </div>
      </div>

      {loadingV ? (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <RefreshCw size={16} className="animate-spin mr-2" />
          <span className="text-xs">Chargement…</span>
        </div>
      ) : (
        <div className="px-5 py-4">
          {/* Info règle de paiement */}
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/15">
            <Clock size={12} className="text-indigo-500 flex-shrink-0" />
            <p className="text-[11px] text-indigo-600 dark:text-indigo-400">
              Les versements sont dus <strong>entre le 5 et le 10 du mois suivant</strong> l&apos;exploitation.
            </p>
          </div>

          <div className="space-y-2">
            {moisListe.map(m => {
              const v          = getVersement(m)
              const isDeleting = deleting === m
              const today      = new Date()
              const status     = getVersementStatus(m, today, v)
              const cfg        = STATUS_CONFIG[status]
              const isFutur    = status === "futur"
              const canMark    = status !== "futur" && status !== "en_cours"
              const showAmount = status === "a_verser" || status === "en_retard" || status === "pas_encore_du"

              const btnClass =
                cfg.btnVariant === "danger"  ? "bg-red-500 hover:bg-red-600 text-white shadow-sm shadow-red-500/20" :
                cfg.btnVariant === "warn"    ? "bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/20" :
                cfg.btnVariant === "muted"   ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-500/30" :
                                               "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"

              return (
                <div key={m} className={`flex items-center justify-between px-4 py-3 rounded-xl border transition ${cfg.bg} ${cfg.border} ${isFutur ? "opacity-50" : ""} ${status === "a_verser" ? "ring-2 ring-amber-400/30" : ""}`}>
                  {/* Mois + badge */}
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.iconBg}`}>
                      {status === "deja_verse"    ? <Check size={14} className="text-white" /> :
                       status === "a_verser"      ? <Banknote size={13} className="text-white" /> :
                       status === "en_retard"     ? <AlertCircle size={13} className="text-white" /> :
                       status === "pas_encore_du" ? <Clock size={12} className="text-white" /> :
                       status === "en_cours"      ? <RefreshCw size={12} className="text-white" /> :
                                                    <Clock size={12} className="text-white" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold capitalize text-gray-800 dark:text-gray-200">
                        {moisLabel(m)}
                        <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase ${cfg.text} ${cfg.bg} border ${cfg.border}`}>
                          {cfg.label}
                        </span>
                      </p>
                      {v && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Versé le {new Date(v.date_versement).toLocaleDateString("fr-FR")}
                          {v.notes && ` · ${v.notes}`}
                        </p>
                      )}
                      {status === "a_verser" && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                          🟡 Fenêtre ouverte : {fenetrePaiement(m)}
                        </p>
                      )}
                      {status === "en_retard" && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                          ⚠ Retard — devait être payé avant le {fenetrePaiement(m).split("–")[1]}
                        </p>
                      )}
                      {status === "pas_encore_du" && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                          Fenêtre à partir du {fenetrePaiement(m).split("–")[0]}
                        </p>
                      )}
                      {status === "en_cours" && (
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
                          Exploitation en cours · fenêtre prévue {fenetrePaiement(m)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Montant + actions */}
                  <div className="flex items-center gap-3">
                    {v && (
                      <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        {fmt(v.montant)} F
                      </span>
                    )}
                    {!v && showAmount && (
                      <span className={`text-xs font-medium ${cfg.text}`}>
                        ≈ {fmt(m === moisActuel ? netClientMois : 0)} F
                      </span>
                    )}

                    {canMark && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setModal({ mois: m, montantSuggere: m === moisActuel ? netClientMois : (v?.montant ?? 0), existant: v })}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${btnClass}`}>
                          {v ? <><Check size={11} />Modifier</> : <><Plus size={11} />Marquer payé</>}
                        </button>
                        {v && (
                          <button
                            onClick={() => annuler(m)}
                            disabled={isDeleting}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition">
                            {isDeleting ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal versement */}
      {modal && (
        <VersementModal
          client={client}
          mois={modal.mois}
          montantSuggere={modal.montantSuggere}
          versementExistant={modal.existant}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}

// ── Ligne véhicule ────────────────────────────────────────────────────────────
function VehiculeRow({ v }: { v: VehiculeStat }) {
  const profitColor = v.profit_boyah >= 0
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-500 dark:text-red-400"
  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition text-xs">
      <td className="px-4 py-2.5 font-mono font-semibold text-gray-700 dark:text-gray-300">{v.immatriculation}</td>
      <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{fmt(v.montant_mensuel_client)} F</td>
      <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">{fmt(v.revenu)} F</td>
      <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{fmt(v.total_depenses)} F</td>
      <td className="px-4 py-2.5">
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400">
          {fmt(v.boyah_support)} F
        </span>
      </td>
      <td className="px-4 py-2.5">
        {v.surplus_depense > 0
          ? <span className="text-red-500 dark:text-red-400">−{fmt(v.surplus_depense)} F</span>
          : <span className="text-gray-300 dark:text-gray-600">—</span>}
      </td>
      <td className="px-4 py-2.5 font-bold text-indigo-600 dark:text-indigo-400">{fmt(v.net_client)} F</td>
      <td className={`px-4 py-2.5 font-bold ${profitColor}`}>{sign(v.profit_boyah)} F</td>
    </tr>
  )
}

// ── Carte client expandable ───────────────────────────────────────────────────
function ClientCard({ client, moisActuel }: { client: Client; moisActuel: string }) {
  const [open, setOpen]     = useState(false)
  const [tab, setTab]       = useState<"finances" | "versements">("finances")
  const profitColor = client.totaux.profit_boyah >= 0
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-500 dark:text-red-400"

  return (
    <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] overflow-hidden">
      {/* En-tête client */}
      <button onClick={() => setOpen(p => !p)} className="w-full text-left">
        <div className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center text-white font-black text-base flex-shrink-0">
              {client.nom[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">{client.nom}</p>
              <div className="flex items-center gap-3 mt-0.5">
                {client.telephone && (
                  <span className="flex items-center gap-1 text-xs text-gray-400"><Phone size={10} />{client.telephone}</span>
                )}
                {client.email && (
                  <span className="flex items-center gap-1 text-xs text-gray-400"><Mail size={10} />{client.email}</span>
                )}
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Car size={10} />{client.vehicules.length} véhicule{client.vehicules.length > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-8 mr-4">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Revenu</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">{fmt(client.totaux.revenu)} F</p>
            </div>
            <div className="text-right hidden md:block">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">À verser</p>
              <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{fmt(client.totaux.net_client)} F</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Bénéfice Boyah</p>
              <p className={`text-sm font-bold ${profitColor}`}>{sign(client.totaux.profit_boyah)} F</p>
            </div>
          </div>

          {open ? <ChevronDown size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />}
        </div>
      </button>

      {/* Détail */}
      {open && (
        <div className="border-t border-gray-100 dark:border-[#1E2D45]">
          {/* Onglets */}
          <div className="flex border-b border-gray-100 dark:border-[#1E2D45] px-5">
            <button
              onClick={() => setTab("finances")}
              className={`flex items-center gap-1.5 px-1 py-3 text-xs font-bold border-b-2 transition mr-6 ${tab === "finances" ? "border-indigo-500 text-indigo-600 dark:text-indigo-400" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
              <TrendingUp size={12} />Finances du mois
            </button>
            <button
              onClick={() => setTab("versements")}
              className={`flex items-center gap-1.5 px-1 py-3 text-xs font-bold border-b-2 transition ${tab === "versements" ? "border-emerald-500 text-emerald-600 dark:text-emerald-400" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
              <CalendarCheck size={12} />Versements
            </button>
          </div>

          {/* Onglet finances */}
          {tab === "finances" && (
            <>
              {client.vehicules.length === 0 ? (
                <div className="px-5 py-6 text-sm text-gray-400 text-center">Aucun véhicule sous gestion ce mois-ci.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px]">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-white/[0.02]">
                        {["Véhicule", "Montant mensuel", "Revenu", "Dépenses", "Charge Boyah (50k)", "Déduction client", "Net client", "Bénéfice Boyah"].map(h => (
                          <th key={h} className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-white/[0.03]">
                      {client.vehicules.map(v => <VehiculeRow key={v.id_vehicule} v={v} />)}
                      {client.vehicules.length > 1 && (
                        <tr className="bg-indigo-50/50 dark:bg-indigo-500/5 font-bold text-xs">
                          <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 font-black uppercase tracking-wider">Total</td>
                          <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">—</td>
                          <td className="px-4 py-2.5 text-gray-900 dark:text-white">{fmt(client.totaux.revenu)} F</td>
                          <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{fmt(client.totaux.total_depenses)} F</td>
                          <td className="px-4 py-2.5 text-amber-700 dark:text-amber-400">{fmt(client.totaux.boyah_support)} F</td>
                          <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">—</td>
                          <td className="px-4 py-2.5 text-indigo-600 dark:text-indigo-400">{fmt(client.totaux.net_client)} F</td>
                          <td className={`px-4 py-2.5 ${client.totaux.profit_boyah >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                            {sign(client.totaux.profit_boyah)} F
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {client.notes && (
                <div className="px-5 py-3 bg-amber-50/50 dark:bg-amber-500/5 border-t border-gray-100 dark:border-[#1E2D45]">
                  <p className="text-xs text-gray-500"><span className="font-semibold">Notes :</span> {client.notes}</p>
                </div>
              )}
            </>
          )}

          {/* Onglet versements */}
          {tab === "versements" && (
            <VersementsSection
              client={client}
              netClientMois={client.totaux.net_client}
              moisActuel={moisActuel}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function ClientsPage() {
  const today = new Date()
  const [mois, setMois]       = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`)
  const [clients, setClients] = useState<Client[]>([])
  const [global, setGlobal]   = useState<Global | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const loadData = useCallback(async (m?: string) => {
    setLoading(true)
    try {
      const res  = await fetch(`/api/clients?mois=${m || mois}`)
      const data = await res.json()
      if (data.ok) { setClients(data.clients || []); setGlobal(data.global || null) }
    } finally { setLoading(false) }
  }, [mois])

  useEffect(() => { loadData() }, [loadData])

  const handleMoisChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMois(e.target.value)
    loadData(e.target.value)
  }

  return (
    <div className="space-y-6 animate-in pb-10">

      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md">
              <Building2 size={15} className="text-white" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">Clients</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Véhicules sous gestion · Reversements & bénéfices</p>
        </div>

        <div className="flex items-center gap-3">
          <input type="month" value={mois} onChange={handleMoisChange}
            className="px-3 py-2 text-sm bg-white dark:bg-[#0D1424] border border-gray-200 dark:border-[#1E2D45] rounded-xl text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-md shadow-indigo-500/20 transition">
            <Plus size={15} />Nouveau client
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total clients" value={loading ? "—" : String(clients.length)}
          sub={`${clients.reduce((s, c) => s + c.vehicules.length, 0)} véhicules sous gestion`}
          icon={Users} color="bg-gradient-to-br from-indigo-500 to-violet-600" textColor="text-gray-900 dark:text-white" />
        <KpiCard label="Total à reverser" value={loading || !global ? "—" : `${fmt(global.net_client)} F`}
          sub="Net après déductions dépenses"
          icon={Wallet} color="bg-gradient-to-br from-blue-400 to-indigo-500" textColor="text-indigo-600 dark:text-indigo-300" />
        <KpiCard label="Charges Boyah" value={loading || !global ? "—" : `${fmt(global.boyah_support)} F`}
          sub="Dépenses supportées (50k/veh)"
          icon={TrendingDown} color="bg-gradient-to-br from-amber-400 to-orange-500" textColor="text-amber-600 dark:text-amber-300" />
        <KpiCard label="Bénéfice Boyah" value={loading || !global ? "—" : `${sign(global.profit_boyah)} F`}
          sub="Après reversements & charges"
          icon={TrendingUp} color="bg-gradient-to-br from-emerald-400 to-teal-500"
          textColor={global && global.profit_boyah >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"} />
      </div>

      {/* Légende */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 px-4 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/20">
        <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
          <span className="font-bold">Formule :</span> Bénéfice Boyah = Revenu − Net client − Charge Boyah
        </p>
        <p className="text-xs text-indigo-600 dark:text-indigo-400">· Charge Boyah = min(dépenses, 50 000 F)</p>
        <p className="text-xs text-indigo-600 dark:text-indigo-400">· Net client = Montant mensuel − max(0, dépenses − 50 000 F)</p>
      </div>

      {/* Liste clients */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <RefreshCw size={20} className="animate-spin mr-3" />
          <span className="text-sm">Chargement des données…</span>
        </div>
      ) : clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Building2 size={40} className="opacity-20 mb-3" />
          <p className="text-sm font-semibold">Aucun client enregistré</p>
          <p className="text-xs mt-1 text-gray-500">Créez votre premier client puis associez-lui des véhicules sous gestion.</p>
          <button onClick={() => setShowModal(true)} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition">
            <Plus size={14} />Nouveau client
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map(c => <ClientCard key={c.id} client={c} moisActuel={mois} />)}
        </div>
      )}

      {showModal && (
        <CreateClientModal onClose={() => setShowModal(false)} onCreated={() => { setShowModal(false); loadData() }} />
      )}
    </div>
  )
}
