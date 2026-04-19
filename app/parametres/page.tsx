"use client"

import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useProfile } from "@/hooks/useProfile"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  User, Lock, Upload, CheckCircle, AlertCircle, Users, Shield,
  Plus, Pencil, Power, X, Eye, EyeOff, RefreshCw, Check,
  Settings, Building2, Bell, Info, PartyPopper,
} from "lucide-react"
import JoursFeriesManager from "@/components/JoursFeriesManager"

const inp = "w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-[#1E2D45] text-gray-900 dark:text-white placeholder:text-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"

// ── Permissions disponibles ────────────────────────────────────────────────────
const ALL_ACTIONS: { key: string; label: string; category: string }[] = [
  // Dashboard
  { key: "view_dashboard",       label: "Voir le dashboard",                  category: "Dashboard" },
  // Finances
  { key: "view_recettes",        label: "Voir les recettes",                  category: "Finances" },
  { key: "manage_recettes",      label: "Saisir / modifier les recettes",     category: "Finances" },
  { key: "view_depenses",        label: "Voir les dépenses",                  category: "Finances" },
  { key: "manage_depenses",      label: "Saisir / modifier les dépenses",     category: "Finances" },
  { key: "export_pdf",           label: "Exporter des rapports PDF",          category: "Finances" },
  // Flotte
  { key: "view_chauffeurs",      label: "Voir les chauffeurs",                category: "Flotte" },
  { key: "create_chauffeur",     label: "Créer un chauffeur",                 category: "Flotte" },
  { key: "edit_chauffeur",       label: "Modifier un chauffeur",              category: "Flotte" },
  { key: "delete_chauffeur",     label: "Supprimer un chauffeur",             category: "Flotte" },
  { key: "view_vehicules",       label: "Voir les véhicules",                 category: "Flotte" },
  { key: "create_vehicle",       label: "Créer un véhicule",                  category: "Flotte" },
  { key: "edit_vehicle",         label: "Modifier un véhicule",               category: "Flotte" },
  { key: "delete_vehicle",       label: "Supprimer un véhicule",              category: "Flotte" },
  { key: "manage_clients",       label: "Gérer les clients",                  category: "Flotte" },
  // Boyah Transport
  { key: "view_boyah_dashboard", label: "Voir le dashboard Boyah Transport",  category: "Boyah Transport" },
  { key: "view_orders",          label: "Voir les commandes Yango",           category: "Boyah Transport" },
  { key: "sync_orders",          label: "Synchroniser les commandes",         category: "Boyah Transport" },
  { key: "create_driver",        label: "Créer un prestataire Yango",         category: "Boyah Transport" },
  // Système
  { key: "view_ai_insights",     label: "Accéder aux AI Insights",            category: "Système" },
  { key: "generate_ai_insights", label: "Déclencher une analyse IA",          category: "Système" },
  { key: "view_journal",         label: "Voir le journal d'activité",         category: "Système" },
  { key: "manage_users",         label: "Gérer les utilisateurs",             category: "Système" },
]

const ROLE_META: Record<string, { label: string; color: string; description: string }> = {
  directeur:  {
    label: "Directeur",
    color: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
    description: "Accès complet. Peut créer des utilisateurs, modifier les permissions et voir toutes les données.",
  },
  admin: {
    label: "Administrateur",
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    description: "Accès étendu configurable par le directeur. Idéal pour les managers.",
  },
  dispatcher: {
    label: "Dispatcher",
    color: "bg-gray-100 dark:bg-gray-700/30 text-gray-600 dark:text-gray-400 border-transparent",
    description: "Accès restreint configurable. Idéal pour les opérateurs quotidiens.",
  },
}

type ProfileRow = { id: string; email: string; full_name: string | null; role: string; is_active: boolean; created_at: string }
type PermRow    = { role: string; action: string; allowed: boolean }

// ── Modal création utilisateur ─────────────────────────────────────────────────
function CreateUserModal({ onClose, onCreated, token }: { onClose: () => void; onCreated: () => void; token: string }) {
  const [form, setForm] = useState({ email: "", password: "", full_name: "", role: "dispatcher" })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [showPwd, setShowPwd] = useState(false)

  const submit = async () => {
    setLoading(true); setError(null)
    const res  = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setLoading(false); return }
    onCreated(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Nouvel utilisateur</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <input placeholder="Nom complet" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} className={inp} />
          <input placeholder="Adresse email" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className={inp} />
          <div className="relative">
            <input placeholder="Mot de passe" type={showPwd ? "text" : "password"} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} className={inp} />
            <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
              {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className={inp}>
            <option value="dispatcher">Dispatcher</option>
            <option value="admin">Administrateur</option>
          </select>
          {form.role && ROLE_META[form.role] && (
            <div className="flex items-start gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-200 dark:border-blue-500/20">
              <Info size={13} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 dark:text-blue-400">{ROLE_META[form.role].description}</p>
            </div>
          )}
        </div>
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs">
            <AlertCircle size={14} /> {error}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-[#1E2D45] text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition">Annuler</button>
          <button onClick={submit} disabled={loading || !form.email || !form.password}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold transition flex items-center justify-center gap-2">
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}Créer
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal confirmation désactivation ──────────────────────────────────────────
function ConfirmModal({ user, action, onConfirm, onCancel }: {
  user: ProfileRow; action: "activate" | "deactivate"; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">
          {action === "deactivate" ? "Désactiver" : "Réactiver"} l&apos;utilisateur ?
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {action === "deactivate"
            ? `${user.full_name || user.email} ne pourra plus se connecter.`
            : `${user.full_name || user.email} pourra à nouveau accéder à la plateforme.`
          }
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-[#1E2D45] text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition">Annuler</button>
          <button onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition ${action === "deactivate" ? "bg-red-500 hover:bg-red-600" : "bg-emerald-500 hover:bg-emerald-600"}`}>
            Confirmer
          </button>
        </div>
      </div>
    </div>
  )
}

// ── SectionHeader helper ───────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, label, gradient }: { icon: React.ElementType; label: string; gradient: string }) {
  return (
    <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100 dark:border-[#1E2D45]">
      <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center`}>
        <Icon size={13} className="text-white" />
      </div>
      <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">{label}</span>
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { profile, loading: profileLoading, isDirecteur } = useProfile()

  // Onglet actif
  type Tab = "profil" | "securite" | "preferences" | "users" | "permissions" | "feries"
  const [activeTab, setActiveTab] = useState<Tab>("profil")

  // Profil
  const [avatar,      setAvatar]      = useState("/avatar.png")
  const [displayName, setDisplayName] = useState("")
  const [email,       setEmail]       = useState("")
  const [savingName,  setSavingName]  = useState(false)
  const [nameSaved,   setNameSaved]   = useState(false)

  // Sécurité
  const [newPassword,    setNewPassword]    = useState("")
  const [repeatPassword, setRepeatPassword] = useState("")
  const [showPwd1,       setShowPwd1]       = useState(false)
  const [showPwd2,       setShowPwd2]       = useState(false)
  const [pwdStatus,      setPwdStatus]      = useState<"idle"|"success"|"error">("idle")
  const [pwdMsg,         setPwdMsg]         = useState("")

  // Préférences (localStorage)
  const [alertThreshold, setAlertThreshold] = useState(14)
  const [companyName,    setCompanyName]    = useState("Boyah Group")
  const [prefSaved,      setPrefSaved]      = useState(false)

  // Directeur
  const [token,        setToken]        = useState("")
  const [users,        setUsers]        = useState<ProfileRow[]>([])
  const [perms,        setPerms]        = useState<PermRow[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [showCreate,   setShowCreate]   = useState(false)
  const [editUser,     setEditUser]     = useState<ProfileRow | null>(null)
  const [confirmUser,  setConfirmUser]  = useState<ProfileRow | null>(null)
  const [savingPerm,   setSavingPerm]   = useState<string | null>(null)

  // Charger token + données perso
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) setToken(data.session.access_token)
    })
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      setEmail(data.user.email || "")
      const name = data.user.user_metadata?.display_name || data.user.user_metadata?.name || ""
      setDisplayName(name)
      supabase.from("profiles").select("avatar_url, full_name").eq("id", data.user.id).single()
        .then(({ data: p }) => {
          if (p?.avatar_url) setAvatar(p.avatar_url as string)
          if (p?.full_name)  setDisplayName(p.full_name as string)
        })
    })
    // Charger préférences
    const t = parseInt(localStorage.getItem("app_alert_threshold") || "14")
    const c = localStorage.getItem("app_company_name") || "Boyah Group"
    setAlertThreshold(t)
    setCompanyName(c)
  }, [])

  const loadUsers = useCallback(async (tok: string) => {
    setLoadingUsers(true)
    const res  = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${tok}` } })
    const data = await res.json()
    if (data.users) setUsers(data.users)
    setLoadingUsers(false)
  }, [])

  const loadPerms = useCallback(async (tok: string) => {
    const res  = await fetch("/api/admin/permissions", { headers: { Authorization: `Bearer ${tok}` } })
    const data = await res.json()
    if (data.permissions) setPerms(data.permissions)
  }, [])

  useEffect(() => {
    if (isDirecteur && token) { loadUsers(token); loadPerms(token) }
  }, [isDirecteur, token, loadUsers, loadPerms])

  // ── Actions ──────────────────────────────────────────────────────────────────
  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return
    const filePath = `${user.id}.png`
    await supabase.storage.from("avatars").upload(filePath, file, { upsert: true })
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${filePath}`
    await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id)
    setAvatar(url + "?t=" + Date.now())
  }

  async function saveName() {
    setSavingName(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.auth.updateUser({ data: { display_name: displayName } })
      await supabase.from("profiles").upsert({ id: user.id, full_name: displayName }, { onConflict: "id" })
    }
    setSavingName(false)
    setNameSaved(true)
    setTimeout(() => setNameSaved(false), 2500)
  }

  async function changePassword() {
    if (newPassword !== repeatPassword) { setPwdStatus("error"); setPwdMsg("Les mots de passe ne correspondent pas"); return }
    if (newPassword.length < 6)         { setPwdStatus("error"); setPwdMsg("Minimum 6 caractères"); return }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { setPwdStatus("error"); setPwdMsg(error.message) }
    else       { setPwdStatus("success"); setPwdMsg("Mot de passe mis à jour"); setNewPassword(""); setRepeatPassword("") }
    setTimeout(() => setPwdStatus("idle"), 4000)
  }

  async function toggleUser(user: ProfileRow) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ user_id: user.id, is_active: !user.is_active }),
    })
    setConfirmUser(null)
    loadUsers(token)
  }

  async function changeRole(userId: string, role: string) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ user_id: userId, role }),
    })
    loadUsers(token)
    setEditUser(null)
  }

  async function togglePerm(role: string, action: string, current: boolean) {
    setSavingPerm(`${role}-${action}`)
    await fetch("/api/admin/permissions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role, action, allowed: !current }),
    })
    await loadPerms(token)
    setSavingPerm(null)
  }

  function savePreferences() {
    localStorage.setItem("app_alert_threshold", String(alertThreshold))
    localStorage.setItem("app_company_name",    companyName)
    setPrefSaved(true)
    setTimeout(() => setPrefSaved(false), 2500)
  }

  const getPerm = (role: string, action: string) =>
    perms.find(p => p.role === role && p.action === action)?.allowed ?? false

  // ── Tabs config ───────────────────────────────────────────────────────────────
  type TabDef = { key: Tab; label: string; icon: React.ElementType; directorOnly?: boolean }
  const TABS: TabDef[] = [
    { key: "profil",       label: "Profil",         icon: User },
    { key: "securite",     label: "Sécurité",        icon: Lock },
    { key: "preferences",  label: "Préférences",     icon: Settings },
    { key: "users",        label: "Utilisateurs",    icon: Users,       directorOnly: true },
    { key: "permissions",  label: "Permissions",     icon: Shield,      directorOnly: true },
    { key: "feries",       label: "Jours fériés",    icon: PartyPopper, directorOnly: true },
  ]
  const visibleTabs = TABS.filter(t => !t.directorOnly || isDirecteur)

  if (profileLoading) return (
    <div className="flex items-center justify-center h-64">
      <span className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Paramètres</h1>
          {profile && (
            <div className="mt-1 flex items-center gap-2">
              <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full border ${ROLE_META[profile.role]?.color}`}>
                {ROLE_META[profile.role]?.label || profile.role}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-600">{ROLE_META[profile.role]?.description}</span>
            </div>
          )}
        </div>
      </div>

      {/* TABS */}
      <div className="flex flex-wrap gap-1 bg-gray-100 dark:bg-[#080F1E] rounded-xl p-1 w-fit">
        {visibleTabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === t.key
                ? "bg-white dark:bg-[#0D1424] text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}>
            <t.icon size={13} />{t.label}
          </button>
        ))}
      </div>

      {/* ── ONGLET PROFIL ── */}
      {activeTab === "profil" && (
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-6 shadow-sm space-y-5">
          <SectionHeader icon={User} label="Mon profil" gradient="from-indigo-500 to-violet-600" />

          {/* Avatar */}
          <div className="flex items-center gap-5">
            <div className="relative group flex-shrink-0">
              <img src={avatar} alt="avatar" className="w-20 h-20 rounded-2xl object-cover border-2 border-gray-100 dark:border-[#1E2D45] shadow-md" />
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition cursor-pointer">
                <Upload size={16} className="text-white" />
                <input type="file" accept="image/*" onChange={uploadAvatar} className="hidden" />
              </label>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <p className="font-medium text-gray-900 dark:text-white mb-0.5">{displayName || "—"}</p>
              <p>{email}</p>
              <p className="text-xs text-gray-400 mt-1">Cliquez sur la photo pour changer l&apos;avatar</p>
            </div>
          </div>

          {/* Nom complet */}
          <div className="space-y-1.5 max-w-sm">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nom affiché</label>
            <div className="flex gap-2">
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Votre nom complet"
                className={`${inp} flex-1`}
              />
              <button onClick={saveName} disabled={savingName}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold transition flex-shrink-0">
                {savingName
                  ? <RefreshCw size={13} className="animate-spin" />
                  : nameSaved ? <Check size={13} /> : "Sauvegarder"
                }
              </button>
            </div>
          </div>

          {/* Email (lecture seule) */}
          <div className="space-y-1.5 max-w-sm">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Adresse email</label>
            <input value={email} disabled className={`${inp} opacity-60 cursor-not-allowed`} />
            <p className="text-xs text-gray-400">Pour changer l&apos;email, contactez l&apos;administrateur.</p>
          </div>
        </div>
      )}

      {/* ── ONGLET SÉCURITÉ ── */}
      {activeTab === "securite" && (
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-6 shadow-sm space-y-5">
          <SectionHeader icon={Lock} label="Sécurité" gradient="from-rose-500 to-red-600" />
          <div className="space-y-3 max-w-sm">
            <div className="relative">
              <input type={showPwd1 ? "text" : "password"} placeholder="Nouveau mot de passe"
                value={newPassword} onChange={e => setNewPassword(e.target.value)} className={`${inp} pr-11`} />
              <button type="button" onClick={() => setShowPwd1(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
                {showPwd1 ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <div className="relative">
              <input type={showPwd2 ? "text" : "password"} placeholder="Confirmer le mot de passe"
                value={repeatPassword} onChange={e => setRepeatPassword(e.target.value)} className={`${inp} pr-11`} />
              <button type="button" onClick={() => setShowPwd2(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
                {showPwd2 ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {/* Indicateur force */}
            {newPassword && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1,2,3,4].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-all ${
                      newPassword.length >= i * 3
                        ? i <= 1 ? "bg-red-400" : i <= 2 ? "bg-amber-400" : i <= 3 ? "bg-yellow-400" : "bg-emerald-500"
                        : "bg-gray-200 dark:bg-gray-700"
                    }`} />
                  ))}
                </div>
                <p className="text-[10px] text-gray-400">
                  {newPassword.length < 6 ? "Trop court" : newPassword.length < 9 ? "Moyen" : newPassword.length < 12 ? "Fort" : "Très fort"}
                </p>
              </div>
            )}
            {pwdStatus !== "idle" && (
              <div className={`flex items-center gap-2 p-3 rounded-xl text-xs border ${
                pwdStatus === "success"
                  ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                  : "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400"
              }`}>
                {pwdStatus === "success" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                {pwdMsg}
              </div>
            )}
            <button onClick={changePassword}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white text-sm font-semibold shadow-md transition">
              <Lock size={14} />Mettre à jour
            </button>
          </div>
        </div>
      )}

      {/* ── ONGLET PRÉFÉRENCES ── */}
      {activeTab === "preferences" && (
        <div className="space-y-4">

          {/* Apparence */}
          <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-6 shadow-sm space-y-4">
            <SectionHeader icon={Settings} label="Apparence" gradient="from-sky-500 to-cyan-600" />
            <div className="flex items-center justify-between max-w-sm">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Thème</p>
                <p className="text-xs text-gray-400 mt-0.5">Clair, sombre ou selon le système</p>
              </div>
              <ThemeToggle />
            </div>
          </div>

          {/* Alertes */}
          <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-6 shadow-sm space-y-4">
            <SectionHeader icon={Bell} label="Alertes documents" gradient="from-amber-500 to-orange-600" />
            <div className="space-y-2 max-w-sm">
              <p className="text-sm text-gray-600 dark:text-gray-400">Alerter quand un document expire dans moins de :</p>
              <div className="flex gap-2">
                {[7, 14, 30, 60].map(v => (
                  <button key={v} onClick={() => setAlertThreshold(v)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition border ${
                      alertThreshold === v
                        ? "bg-amber-500 text-white border-amber-500"
                        : "border-gray-200 dark:border-[#1E2D45] text-gray-500 dark:text-gray-400 hover:border-amber-300"
                    }`}>
                    {v}j
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Infos entreprise (pour PDF) */}
          <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-6 shadow-sm space-y-4">
            <SectionHeader icon={Building2} label="Entreprise (pour les exports PDF)" gradient="from-indigo-500 to-violet-600" />
            <div className="space-y-2 max-w-sm">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nom de l&apos;entreprise</label>
              <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Boyah Group" className={inp} />
            </div>
            <button onClick={savePreferences}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition">
              {prefSaved ? <><Check size={14} />Sauvegardé</> : "Sauvegarder les préférences"}
            </button>
          </div>
        </div>
      )}

      {/* ── ONGLET UTILISATEURS (directeur) ── */}
      {isDirecteur && activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{users.length} utilisateur{users.length > 1 ? "s" : ""}</p>
              {/* Légende rôles */}
              <div className="flex flex-wrap gap-3 mt-2">
                {Object.entries(ROLE_META).map(([key, meta]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${meta.color}`}>{meta.label}</span>
                    <span className="text-[10px] text-gray-400 hidden sm:inline">{meta.description}</span>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-md">
              <Plus size={13} /> Nouvel utilisateur
            </button>
          </div>

          <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] overflow-hidden shadow-sm">
            {loadingUsers ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <RefreshCw size={16} className="animate-spin mr-2" /> Chargement…
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#080F1E]">
                  <tr>
                    {["Utilisateur","Rôle","Statut","Créé le","Actions"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-[#1E2D45]">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-[#080F1E] transition">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900 dark:text-white text-sm">{u.full_name || "—"}</p>
                        <p className="text-xs text-gray-400">{u.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        {editUser?.id === u.id ? (
                          <select defaultValue={u.role} onChange={e => changeRole(u.id, e.target.value)}
                            className="text-xs bg-white dark:bg-[#0D1424] border border-gray-200 dark:border-[#1E2D45] rounded-lg px-2 py-1 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                            <option value="admin">Administrateur</option>
                            <option value="dispatcher">Dispatcher</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ROLE_META[u.role]?.color || ""}`}>
                            {ROLE_META[u.role]?.label || u.role}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          u.is_active
                            ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "bg-red-50 dark:bg-red-500/10 text-red-500"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? "bg-emerald-500" : "bg-red-400"}`} />
                          {u.is_active ? "Actif" : "Désactivé"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{new Date(u.created_at).toLocaleDateString("fr-FR")}</td>
                      <td className="px-4 py-3">
                        {u.role !== "directeur" && (
                          <div className="flex items-center gap-2">
                            <button onClick={() => setEditUser(editUser?.id === u.id ? null : u)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1E2D45] text-gray-400 hover:text-indigo-500 transition" title="Modifier le rôle">
                              <Pencil size={13} />
                            </button>
                            <button onClick={() => setConfirmUser(u)}
                              className={`p-1.5 rounded-lg transition ${
                                u.is_active
                                  ? "hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 hover:text-red-500"
                                  : "hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-gray-400 hover:text-emerald-500"
                              }`}
                              title={u.is_active ? "Désactiver" : "Activer"}>
                              <Power size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── ONGLET PERMISSIONS (directeur) ── */}
      {isDirecteur && activeTab === "permissions" && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20">
            <Shield size={15} className="text-indigo-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">Matrice des permissions</p>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
                Gérez les accès pour <strong>Administrateur</strong> et <strong>Dispatcher</strong>. Les changements sont instantanés.
                Le <strong>Directeur</strong> a accès à tout par défaut et ne peut pas être restreint.
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[#080F1E]">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-[50%]">Permission</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-blue-500 uppercase tracking-wider">
                    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ROLE_META.admin.color}`}>Admin</span>
                  </th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ROLE_META.dispatcher.color}`}>Dispatcher</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-[#1E2D45]">
                {(() => {
                  const categories = Array.from(new Set(ALL_ACTIONS.map(a => a.category)))
                  return categories.flatMap(cat => [
                    <tr key={`cat-${cat}`}>
                      <td colSpan={3} className="px-5 py-2 bg-gray-50 dark:bg-[#080F1E]">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">{cat}</span>
                      </td>
                    </tr>,
                    ...ALL_ACTIONS.filter(a => a.category === cat).map(action => (
                      <tr key={action.key} className="hover:bg-gray-50 dark:hover:bg-[#080F1E] transition">
                        <td className="px-5 py-3 text-sm text-gray-700 dark:text-gray-300 font-medium">{action.label}</td>
                        {(["admin", "dispatcher"] as const).map(role => {
                          const allowed  = getPerm(role, action.key)
                          const isSaving = savingPerm === `${role}-${action.key}`
                          return (
                            <td key={role} className="px-5 py-3 text-center">
                              <button onClick={() => togglePerm(role, action.key, allowed)} disabled={isSaving}
                                className={`w-10 h-6 rounded-full transition-all relative flex-shrink-0 mx-auto flex items-center ${allowed ? "bg-indigo-500" : "bg-gray-200 dark:bg-gray-700"}`}>
                                <span className={`absolute w-4 h-4 bg-white rounded-full shadow transition-all ${allowed ? "left-5" : "left-1"}`} />
                                {isSaving && <RefreshCw size={10} className="absolute inset-0 m-auto text-white/70 animate-spin" />}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    )),
                  ])
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ONGLET JOURS FÉRIÉS (directeur) ── */}
      {isDirecteur && activeTab === "feries" && <JoursFeriesManager />}

      {showCreate && <CreateUserModal token={token} onClose={() => setShowCreate(false)} onCreated={() => loadUsers(token)} />}
      {confirmUser && (
        <ConfirmModal
          user={confirmUser}
          action={confirmUser.is_active ? "deactivate" : "activate"}
          onConfirm={() => toggleUser(confirmUser)}
          onCancel={() => setConfirmUser(null)}
        />
      )}
    </div>
  )
}
