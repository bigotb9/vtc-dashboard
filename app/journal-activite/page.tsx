"use client"

import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useProfile } from "@/hooks/useProfile"
import {
  Activity, ChevronLeft, ChevronRight, RefreshCw, User,
  Shield, Filter, Download, X, ChevronDown, ChevronUp,
} from "lucide-react"

type LogRow = {
  id:         number
  user_id:    string
  user_name:  string
  user_role:  string
  action:     string
  entity:     string | null
  details:    Record<string, unknown> | null
  created_at: string
}

// J2 — clé corrigée manage_depenses
const ACTION_LABELS: Record<string, string> = {
  create_user:        "Création d'utilisateur",
  update_user:        "Modification d'utilisateur",
  disable_user:       "Désactivation d'utilisateur",
  update_permission:  "Modification de permission",
  create_driver:      "Création de prestataire Yango",
  create_vehicle:     "Création de véhicule Yango",
  create_vehicule:    "Création de véhicule",
  create_chauffeur:   "Création de chauffeur",
  create_depense:     "Création de dépense",
  create_recette:     "Saisie de recette",
  create_entretien:   "Vidange enregistrée",
  sync_orders:        "Synchronisation commandes",
  export_pdf:         "Export PDF",
  manage_depenses:    "Gestion dépenses",
  manage_expenses:    "Gestion dépenses",
  manage_recettes:    "Gestion recettes",
  attribution_recalcul: "Recalcul attributions",
}

const ACTION_CATEGORIES = [
  { label: "Toutes les actions",   value: "" },
  { label: "Utilisateurs",         value: "user" },
  { label: "Permissions",          value: "permission" },
  { label: "Exports",              value: "export" },
  { label: "Sync / Commandes",     value: "sync" },
  { label: "Finances",             value: "manage" },
  { label: "Flotte",               value: "create_" },
]

const ROLE_COLORS: Record<string, string> = {
  directeur:  "bg-violet-500/10 text-violet-400",
  admin:      "bg-blue-500/10 text-blue-400",
  dispatcher: "bg-gray-100 dark:bg-gray-700/30 text-gray-500",
}

const ACTION_COLORS: Record<string, string> = {
  create_user:       "bg-emerald-500/10 text-emerald-400",
  update_user:       "bg-blue-500/10 text-blue-400",
  disable_user:      "bg-red-500/10 text-red-400",
  update_permission: "bg-violet-500/10 text-violet-400",
  export_pdf:        "bg-amber-500/10 text-amber-400",
  sync_orders:       "bg-sky-500/10 text-sky-400",
}

// J3 — Modal détails JSON
function JsonModal({ data, onClose }: { data: Record<string, unknown>; onClose: () => void }) {
  const json = JSON.stringify(data, null, 2)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-[#1E2D45]">
          <span className="text-sm font-bold text-gray-900 dark:text-white">Détails de l'action</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(json)}
              className="text-xs text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition">
              Copier
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
              <X size={16} />
            </button>
          </div>
        </div>
        <pre className="p-5 text-[11px] text-gray-700 dark:text-gray-300 overflow-auto max-h-80 font-mono leading-relaxed">
          {json}
        </pre>
      </div>
    </div>
  )
}

export default function JournalActivitePage() {
  const { profile, loading: profileLoading, isDirecteur } = useProfile()

  const [token,        setToken]        = useState("")
  const [logs,         setLogs]         = useState<LogRow[]>([])
  const [total,        setTotal]        = useState(0)
  const [pages,        setPages]        = useState(1)
  const [page,         setPage]         = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [filterUser,   setFilterUser]   = useState("")
  const [filterAction, setFilterAction] = useState("")  // J4
  const [dateFrom,     setDateFrom]     = useState("")  // J5
  const [dateTo,       setDateTo]       = useState("")  // J5
  const [showDateFilter, setShowDateFilter] = useState(false)
  const [jsonModal,    setJsonModal]    = useState<Record<string, unknown> | null>(null)  // J3
  const [onlineUsers,  setOnlineUsers]  = useState<{ id: string; email: string }[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) setToken(data.session.access_token)
    })
  }, [])

  const loadLogs = useCallback(async (tok: string, p = 0, uid = "", action = "", df = "", dt = "") => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(p), limit: "50",
      ...(uid    && { user_id:   uid }),
      ...(action && { action:    action }),
      ...(df     && { date_from: df }),
      ...(dt     && { date_to:   dt }),
    })
    const res  = await fetch(`/api/admin/activity?${params}`, { headers: { Authorization: `Bearer ${tok}` } })
    const data = await res.json()
    if (data.logs) { setLogs(data.logs); setTotal(data.total || 0); setPages(data.pages || 1) }
    setLoading(false)
  }, [])

  const loadOnlineUsers = useCallback(async (tok: string) => {
    const res  = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${tok}` } })
    const data = await res.json()
    if (data.users) {
      setOnlineUsers(
        (data.users as { id: string; email: string; is_active: boolean }[])
          .filter(u => u.is_active)
          .map(u => ({ id: u.id, email: u.email }))
      )
    }
  }, [])

  useEffect(() => {
    if (token && isDirecteur) { loadLogs(token); loadOnlineUsers(token) }
  }, [token, isDirecteur, loadLogs, loadOnlineUsers])

  const handlePage     = (p: number)  => { setPage(p); loadLogs(token, p, filterUser, filterAction, dateFrom, dateTo) }
  const handleFilter   = (uid: string) => { setFilterUser(uid);   setPage(0); loadLogs(token, 0, uid, filterAction, dateFrom, dateTo) }
  const handleAction   = (act: string) => { setFilterAction(act); setPage(0); loadLogs(token, 0, filterUser, act, dateFrom, dateTo) }
  const applyDateFilter = () => { setPage(0); loadLogs(token, 0, filterUser, filterAction, dateFrom, dateTo); setShowDateFilter(false) }
  const clearDate      = () => { setDateFrom(""); setDateTo(""); setPage(0); loadLogs(token, 0, filterUser, filterAction, "", ""); setShowDateFilter(false) }

  // J6 — Export CSV
  const exportCSV = () => {
    const rows = [["Date","Utilisateur","Rôle","Action","Entité"]]
    logs.forEach(l => rows.push([
      new Date(l.created_at).toLocaleString("fr-FR"),
      l.user_name || "",
      l.user_role,
      ACTION_LABELS[l.action] || l.action,
      l.entity || "",
    ]))
    const csv = rows.map(r => r.join(";")).join("\n")
    const a = Object.assign(document.createElement("a"), {
      href:     URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })),
      download: `journal_${new Date().toISOString().split("T")[0]}.csv`,
    })
    a.click()
  }

  const hasDateFilter = !!(dateFrom || dateTo)

  if (profileLoading) return (
    <div className="flex items-center justify-center h-64">
      <span className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!isDirecteur) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
      <Shield size={40} className="opacity-20" />
      <p className="text-sm font-medium">Accès réservé au Directeur</p>
    </div>
  )

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Activity size={15} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Journal d&apos;activité</h1>
          </div>
          <p className="text-sm text-gray-500">{total.toLocaleString("fr-FR")} actions enregistrées</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-[#1E2D45] text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition">
            <Download size={13} /> CSV
          </button>
          <button onClick={() => loadLogs(token, page, filterUser, filterAction, dateFrom, dateTo)} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-sm font-medium transition hover:bg-indigo-100 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Actualiser
          </button>
        </div>
      </div>

      {/* UTILISATEURS ACTIFS */}
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <User size={15} className="text-emerald-500" />
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Comptes actifs</h2>
          <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">{onlineUsers.length}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {onlineUsers.map(u => (
            <div key={u.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#080F1E] border border-gray-100 dark:border-[#1E2D45]">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{u.email}</span>
            </div>
          ))}
          {onlineUsers.length === 0 && <p className="text-xs text-gray-400">Aucun utilisateur actif</p>}
        </div>
      </div>

      {/* JOURNAL */}
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-[#1E2D45] flex flex-wrap items-center gap-3 justify-between">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Historique des actions</h2>
          <div className="flex flex-wrap items-center gap-2">

            {/* J4 — Filtre par utilisateur (depuis la liste complète des utilisateurs actifs) */}
            <div className="flex items-center gap-1.5">
              <Filter size={12} className="text-gray-400" />
              <select value={filterUser} onChange={e => handleFilter(e.target.value)}
                className="text-xs bg-gray-100 dark:bg-[#080F1E] border border-gray-200 dark:border-[#1E2D45] rounded-xl px-3 py-2 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                <option value="">Tous les utilisateurs</option>
                {onlineUsers.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
              </select>
            </div>

            {/* J4 — Filtre par type d'action */}
            <select value={filterAction} onChange={e => handleAction(e.target.value)}
              className="text-xs bg-gray-100 dark:bg-[#080F1E] border border-gray-200 dark:border-[#1E2D45] rounded-xl px-3 py-2 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500">
              {ACTION_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>

            {/* J5 — Filtre date range */}
            <div className="relative">
              <button onClick={() => setShowDateFilter(p => !p)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                  hasDateFilter
                    ? "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400"
                    : "bg-gray-100 dark:bg-[#080F1E] border-gray-200 dark:border-[#1E2D45] text-gray-500"
                }`}>
                Dates{hasDateFilter ? " ●" : ""} {showDateFilter ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
              {showDateFilter && (
                <div className="absolute top-full mt-1 right-0 z-20 bg-white dark:bg-[#0D1424] border border-gray-200 dark:border-[#1E2D45] rounded-xl p-4 shadow-xl w-60 space-y-3">
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Du</label>
                    <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                      className="w-full text-xs bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-[#1E2D45] rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Au</label>
                    <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                      className="w-full text-xs bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-[#1E2D45] rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={clearDate} className="flex-1 py-1.5 rounded-lg border border-gray-200 dark:border-[#1E2D45] text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5 transition">Effacer</button>
                    <button onClick={applyDateFilter} className="flex-1 py-1.5 rounded-lg bg-indigo-600 text-xs text-white font-semibold transition hover:bg-indigo-700">Appliquer</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <RefreshCw size={16} className="animate-spin mr-2" /> Chargement…
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Activity size={32} className="opacity-20 mb-2" />
            <p className="text-sm">Aucune activité enregistrée</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-gray-50 dark:bg-[#080F1E]">
                <tr>
                  {["Date & Heure","Utilisateur","Rôle","Action","Détails"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-[#1E2D45]">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-[#080F1E] transition">
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      <p className="font-medium">{new Date(log.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}</p>
                      <p className="text-gray-400">{new Date(log.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{log.user_name || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[log.user_role] || ROLE_COLORS.dispatcher}`}>
                        {log.user_role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-1 rounded-lg ${ACTION_COLORS[log.action] || "bg-gray-100 dark:bg-gray-700/30 text-gray-500"}`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    {/* J3 — Détails cliquables */}
                    <td className="px-4 py-3 text-xs text-gray-400 max-w-[200px]">
                      {log.details ? (
                        <button onClick={() => setJsonModal(log.details)}
                          className="font-mono text-[10px] bg-gray-50 dark:bg-[#080F1E] hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:text-indigo-500 px-2 py-1 rounded-lg block truncate w-full text-left transition border border-transparent hover:border-indigo-200 dark:hover:border-indigo-500/30">
                          {JSON.stringify(log.details).slice(0, 40)}{JSON.stringify(log.details).length > 40 ? "…" : ""}
                        </button>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="px-5 py-4 border-t border-gray-100 dark:border-[#1E2D45] flex items-center justify-between">
            <p className="text-xs text-gray-500">Page {page + 1} / {pages} · {total.toLocaleString("fr-FR")} entrées</p>
            <div className="flex gap-2">
              <button onClick={() => handlePage(page - 1)} disabled={page === 0}
                className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 dark:border-[#1E2D45] rounded-xl text-gray-500 hover:bg-gray-50 dark:hover:bg-[#080F1E] disabled:opacity-40 transition">
                <ChevronLeft size={13} /> Préc.
              </button>
              <button onClick={() => handlePage(page + 1)} disabled={page >= pages - 1}
                className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 dark:border-[#1E2D45] rounded-xl text-gray-500 hover:bg-gray-50 dark:hover:bg-[#080F1E] disabled:opacity-40 transition">
                Suiv. <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {jsonModal && <JsonModal data={jsonModal} onClose={() => setJsonModal(null)} />}
    </div>
  )
}
