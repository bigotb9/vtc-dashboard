"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { User, Lock, Upload, CheckCircle, AlertCircle } from "lucide-react"

export default function SettingsPage() {
  const [avatar,         setAvatar]         = useState("/avatar.png")
  const [displayName,    setDisplayName]    = useState("")
  const [email,          setEmail]          = useState("")
  const [newPassword,    setNewPassword]    = useState("")
  const [repeatPassword, setRepeatPassword] = useState("")
  const [pwdStatus,      setPwdStatus]      = useState<"idle"|"success"|"error">("idle")
  const [pwdMsg,         setPwdMsg]         = useState("")

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      setEmail(data.user.email || "")
      setDisplayName(data.user.user_metadata?.display_name || data.user.user_metadata?.name || "")
      supabase.from("profiles").select("avatar_url").eq("id", data.user.id).single()
        .then(({ data: p }) => { if (p?.avatar_url) setAvatar(p.avatar_url) })
    })
  }, [])

  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const filePath = `${user.id}.png`
    await supabase.storage.from("avatars").upload(filePath, file, { upsert: true })
    const avatarUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${filePath}`
    await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", user.id)
    setAvatar(avatarUrl + "?t=" + Date.now())
  }

  async function changePassword() {
    if (newPassword !== repeatPassword) { setPwdStatus("error"); setPwdMsg("Les mots de passe ne correspondent pas"); return }
    if (newPassword.length < 6)         { setPwdStatus("error"); setPwdMsg("Minimum 6 caractères"); return }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { setPwdStatus("error"); setPwdMsg(error.message) }
    else       { setPwdStatus("success"); setPwdMsg("Mot de passe mis à jour"); setNewPassword(""); setRepeatPassword("") }
    setTimeout(() => setPwdStatus("idle"), 4000)
  }

  const inp = "w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-[#1E2D45] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in">

      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Paramètres</h1>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">Gérez votre profil et vos préférences</p>
      </div>

      {/* PROFIL */}
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100 dark:border-[#1E2D45]">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
            <User size={13} className="text-white" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-500">Profil</span>
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-5">
          <div className="relative group">
            <img src={avatar} alt="avatar"
              className="w-20 h-20 rounded-2xl object-cover border-2 border-gray-100 dark:border-[#1E2D45] shadow-md" />
            <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition cursor-pointer">
              <Upload size={16} className="text-white" />
              <input type="file" accept="image/*" onChange={uploadAvatar} className="hidden" />
            </label>
          </div>
          <div>
            <p className="font-bold text-gray-900 dark:text-white">{displayName || "—"}</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">{email}</p>
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">BOYAH GROUP</p>
            <label className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 cursor-pointer hover:text-indigo-700 transition">
              <Upload size={11} />Changer la photo
              <input type="file" accept="image/*" onChange={uploadAvatar} className="hidden" />
            </label>
          </div>
        </div>
      </div>

      {/* MOT DE PASSE */}
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100 dark:border-[#1E2D45]">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center">
            <Lock size={13} className="text-white" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-500">Sécurité</span>
        </div>

        <div className="space-y-3 max-w-sm">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Nouveau mot de passe</label>
            <input type="password" placeholder="••••••••" value={newPassword}
              onChange={e => setNewPassword(e.target.value)} className={inp} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Confirmer le mot de passe</label>
            <input type="password" placeholder="••••••••" value={repeatPassword}
              onChange={e => setRepeatPassword(e.target.value)} className={inp} />
          </div>

          {pwdStatus !== "idle" && (
            <div className={`flex items-center gap-2 p-3 rounded-xl text-sm border
              ${pwdStatus === "success"
                ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                : "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400"
              }`}>
              {pwdStatus === "success" ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
              <span className="text-xs font-medium">{pwdMsg}</span>
            </div>
          )}

          <button onClick={changePassword}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white text-sm font-semibold shadow-md shadow-indigo-500/20 transition">
            <Lock size={14} />Mettre à jour
          </button>
        </div>
      </div>

    </div>
  )
}
