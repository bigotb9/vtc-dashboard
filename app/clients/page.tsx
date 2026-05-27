"use client"

/**
 * app/clients/page.tsx
 *
 * Module Clients (asset management Boyah Group).
 *
 * Refonte 23/05/2026 - Enrichissement module Clients :
 *   QW1 : bouton PDF Releve du mois
 *   QW2 : badge "X mois en retard" sur ClientCard + tri automatique
 *   QW3 : soft-delete + filtre Inactifs + bouton Desactiver/Reactiver
 *   E1  : onglet Documents avec upload/download/delete
 *   G1  : 4 KPIs en haut (Clients actifs, Capital gere, A reverser, Benefice)
 *   H1  : justificatif PDF auto a chaque versement (backend, transparent UI)
 *   B1  : benefice cumule par Client (header du card)
 *   D3  : bandeau alertes retards en haut
 *   E3  : workflow sortie Client (modal multi-etapes)
 *   H3  : cascade vers tiers compta (backend, transparent UI)
 *
 * Refacto Lot T (audit 27/05/2026) : fichier monolithique 1349 lignes
 * decoupe en composants reutilisables :
 *   - components/clients/ClientCard.tsx
 *   - components/clients/VersementsSection.tsx
 *   - components/clients/VersementModal.tsx
 *   - components/clients/SortirClientModal.tsx
 *   - components/clients/UploadDocumentModal.tsx
 *   - types/clients.ts (types + helpers fmt/sign/moisLabel + STATUS_CONFIG)
 *
 * Restent ici : ClientsPage + CreateClientModal + KpiCard inline.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle, AlertTriangle, Banknote, Building2, Check,
  Plus, RefreshCw, TrendingUp, Users, Wallet,
} from "lucide-react"
import { authFetch } from "@/lib/authFetch"
import ModalShell from "@/components/ModalShell"
import ClientCard from "@/components/clients/ClientCard"
import type { Client, Global } from "@/types/clients"
import { fmt, sign } from "@/types/clients"

// ─── KpiCard (petit composant inline specifique a la page) ────────────────────
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

// ─── Modal creation client (specifique a la page, reste ici) ──────────────────
function CreateClientModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ nom: "", telephone: "", email: "", notes: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const submit = async () => {
    if (!form.nom.trim()) { setError("Le nom est requis"); return }
    setLoading(true)
    const res  = await authFetch("/api/clients", { method: "POST", body: JSON.stringify(form) })
    const data = await res.json()
    if (data.ok) { onCreated() }
    else { setError(data.error || "Erreur"); setLoading(false) }
  }

  const inp = "w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition"

  return (
    <ModalShell
      open
      onClose={onClose}
      title="Nouveau client"
      size="md"
      noBackdropClose
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition">Annuler</button>
          <button onClick={submit} disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition disabled:opacity-50">
            {loading ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}Créer
          </button>
        </>
      }
    >
      <div className="space-y-4">
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
    </ModalShell>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function ClientsPage() {
  const today = new Date()
  const [mois, setMois]       = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`)
  const [clients, setClients] = useState<Client[]>([])
  const [global, setGlobal]   = useState<Global | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  // Refonte 23/05/2026
  const [showInactifs, setShowInactifs] = useState(false)
  const [filterRetards, setFilterRetards] = useState(false)
  // Lot N (26/05/2026 audit) : bandeau d'erreur sur le fetch principal
  // Auparavant : `if (data.ok)` sans else ni try/catch -> page reste vide silencieusement
  // en cas de 500, RLS refuse, network down, etc.
  const [errorMain, setErrorMain] = useState<string | null>(null)

  // Patch 24/05/2026 (Bugs A + 1 v2) :
  //   - useEffect declenche seul le refetch via les deps mois/showInactifs
  //   - utilise le nouveau param `?statut=actifs|inactifs` (semantique exclusive)
  //     case decochee = actifs uniquement, case cochee = inactifs uniquement
  const loadData = useCallback(async () => {
    setLoading(true)
    setErrorMain(null)
    try {
      const params = new URLSearchParams({
        mois,
        statut: showInactifs ? "inactifs" : "actifs",
      })
      const res  = await authFetch(`/api/clients?${params}`)
      const data = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status} — réponse JSON invalide` }))
      if (data.ok) {
        setClients(data.clients || [])
        setGlobal(data.global || null)
      } else {
        // Lot N : branche else manquante. On informe l'utilisateur au lieu
        // de garder la page sur l'ancienne donnée (ou vide au premier load).
        const msg = (data as { error?: string }).error || `Erreur serveur (HTTP ${res.status})`
        setErrorMain(msg)
      }
    } catch (e) {
      // Network down, fetch rejette, JSON.parse plante hors du catch interne, etc.
      setErrorMain((e as Error).message || "Erreur réseau inconnue")
    } finally {
      setLoading(false)
    }
  }, [mois, showInactifs])

  useEffect(() => { loadData() }, [loadData])

  const handleMoisChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMois(e.target.value)
    // useEffect re-fire automatiquement via la dep mois
  }

  const toggleInactifs = () => {
    setShowInactifs(s => !s)
    // useEffect re-fire automatiquement via la dep showInactifs
  }

  // Liste filtree pour affichage (apres tri serveur)
  const clientsAffiches = useMemo(() => {
    if (filterRetards) return clients.filter(c => (c.retards_count ?? 0) > 0)
    return clients
  }, [clients, filterRetards])

  const clientsEnRetard = useMemo(() => clients.filter(c => (c.retards_count ?? 0) > 0), [clients])

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
          <p className="text-sm text-gray-500 dark:text-gray-400">Asset management — gestion des véhicules confiés à Boyah Group</p>
        </div>

        <div className="flex items-center gap-3">
          <input type="month" value={mois} onChange={handleMoisChange}
            className="px-3 py-2 text-sm bg-white dark:bg-[#0D1424] border border-gray-200 dark:border-[#1E2D45] rounded-xl text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
          <label className="flex items-center gap-2 px-3 py-2 text-sm bg-white dark:bg-[#0D1424] border border-gray-200 dark:border-[#1E2D45] rounded-xl text-gray-700 dark:text-gray-300 cursor-pointer hover:border-indigo-400 transition" title="Coche pour voir uniquement les Clients archivés">
            <input type="checkbox" checked={showInactifs} onChange={toggleInactifs}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            {showInactifs ? "Voir les inactifs" : "Voir les actifs"}
          </label>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-md shadow-indigo-500/20 transition">
            <Plus size={15} />Nouveau client
          </button>
        </div>
      </div>

      {/* BANDEAU ERREUR (Lot N 26/05/2026 audit) */}
      {errorMain && (
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30" role="alert" aria-live="assertive">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} className="text-red-600 dark:text-red-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-red-700 dark:text-red-300">
                Impossible de charger les clients
              </p>
              <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5 break-words">
                {errorMain}
              </p>
            </div>
          </div>
          <button
            onClick={() => loadData()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white text-xs font-semibold transition shadow-sm shrink-0"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Réessayer
          </button>
        </div>
      )}

      {/* BANDEAU ALERTES RETARDS (D3) */}
      {clientsEnRetard.length > 0 && (
        <div className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-500/10 dark:to-orange-500/10 border border-red-200 dark:border-red-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-md shadow-red-500/30 flex-shrink-0">
              <AlertTriangle size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-red-700 dark:text-red-400">
                {clientsEnRetard.length} Client{clientsEnRetard.length > 1 ? "s" : ""} en attente de versement
              </p>
              <p className="text-xs text-red-600/80 dark:text-red-500/80">
                {clientsEnRetard.slice(0, 3).map(c => c.nom).join(" · ")}
                {clientsEnRetard.length > 3 ? ` · +${clientsEnRetard.length - 3} autres` : ""}
                {" — Fenêtre de paiement passée"}
              </p>
            </div>
          </div>
          <button onClick={() => setFilterRetards(f => !f)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition shadow-sm ${
              filterRetards
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-white dark:bg-[#0D1424] text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 hover:bg-red-50 dark:hover:bg-red-500/10"
            }`}>
            {filterRetards ? "Voir tous" : "Voir les retards"}
          </button>
        </div>
      )}

      {/* KPI (G1 - 4 cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Clients actifs" value={loading ? "—" : String(global?.clients_actifs ?? clients.filter(c => c.actif !== false).length)}
          sub={`${clients.reduce((s, c) => s + c.vehicules.length, 0)} véhicules sous gestion`}
          icon={Users} color="bg-gradient-to-br from-indigo-500 to-violet-600" textColor="text-gray-900 dark:text-white" />
        <KpiCard label="Capital géré" value={loading || !global ? "—" : (global.capital_gere && global.capital_gere > 0 ? `${fmt(global.capital_gere)} F` : "— F")}
          sub="Valeur d'acquisition des véhicules"
          icon={Banknote} color="bg-gradient-to-br from-purple-500 to-pink-500" textColor="text-purple-600 dark:text-purple-300" />
        <KpiCard label="À reverser ce mois" value={loading || !global ? "—" : `${fmt(global.net_client)} F`}
          sub="Net après déductions dépenses"
          icon={Wallet} color="bg-gradient-to-br from-blue-400 to-indigo-500" textColor="text-indigo-600 dark:text-indigo-300" />
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
      ) : clientsAffiches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Building2 size={40} className="opacity-20 mb-3" />
          <p className="text-sm font-semibold">
            {filterRetards ? "Aucun Client en retard" : "Aucun client enregistré"}
          </p>
          <p className="text-xs mt-1 text-gray-500">
            {filterRetards ? "Tous les versements sont à jour." : "Créez votre premier client puis associez-lui des véhicules sous gestion."}
          </p>
          {!filterRetards && (
            <button onClick={() => setShowModal(true)} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition">
              <Plus size={14} />Nouveau client
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1">
            Liste des Clients ({clientsAffiches.length})
          </p>
          {clientsAffiches.map(c => <ClientCard key={c.id} client={c} moisActuel={mois} onChange={loadData} />)}
        </div>
      )}

      {showModal && (
        <CreateClientModal onClose={() => setShowModal(false)} onCreated={() => { setShowModal(false); loadData() }} />
      )}
    </div>
  )
}
