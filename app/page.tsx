"use client"

export const dynamic = "force-dynamic"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Mail, Lock, ArrowRight, Car, TrendingUp, Users, Zap } from "lucide-react"
import dynamicImport from "next/dynamic"

const IsometricScene = dynamicImport(() => import("@/components/IsometricScene"), { ssr: false })

type LiveStats = {
  vehicules:  string
  chauffeurs: string
  courses:    string
  commission: string
}

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [showPwd,  setShowPwd]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState("")
  const [stats, setStats] = useState<LiveStats>({
    vehicules:  "…",
    chauffeurs: "…",
    courses:    "…",
    commission: "2,5%",
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.push("/dashboard")
    })

    // Charger les vraies stats
    const fetchStats = async () => {
      const now   = new Date()
      const debut = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const [{ count: vCount }, { count: cCount }, { count: oCount }] = await Promise.all([
        supabase.from("vehicules").select("*", { count: "exact", head: true }).eq("statut", "ACTIF"),
        supabase.from("chauffeurs").select("*", { count: "exact", head: true }).eq("actif", true),
        supabase.from("recettes_wave").select("*", { count: "exact", head: true }).gte("Horodatage", debut),
      ])

      setStats({
        vehicules:  String(vCount ?? "—"),
        chauffeurs: String(cCount ?? "—"),
        courses:    (oCount ?? 0) > 0 ? (oCount as number).toLocaleString("fr-FR") : "—",
        commission: "2,5%",
      })
    }
    fetchStats()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = async () => {
    setLoading(true)
    setError("")
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push("/dashboard")
  }

  return (
    <div className="min-h-screen flex bg-[#060B14]">

      {/* ── LEFT — Isometric visual ── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">

        {/* Canvas animation */}
        <div className="absolute inset-0">
          <IsometricScene />
        </div>

        {/* Vignette edges */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, transparent 40%, #060B14 100%)" }} />
        <div className="absolute right-0 top-0 bottom-0 w-24 pointer-events-none"
          style={{ background: "linear-gradient(to right, transparent, #060B14)" }} />

        {/* Grid dot pattern overlay */}
        <div className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

        {/* Content overlay */}
        <div className="relative z-10 flex flex-col justify-between p-10 w-full">

          {/* Top — Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <span className="text-white font-black text-base">B</span>
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-none">BOYAH GROUP</p>
              <p className="text-gray-500 text-[10px] tracking-widest uppercase mt-0.5">VTC Platform</p>
            </div>
          </div>

          {/* Middle — Tagline */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-indigo-300 text-xs font-semibold tracking-wide">Plateforme live · Afrique de l&apos;Ouest</span>
            </div>
            <h2 className="text-3xl font-black text-white leading-tight">
              Gérez votre flotte<br />
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                en temps réel.
              </span>
            </h2>
            <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
              Suivi des courses, gestion des chauffeurs et analyse intelligente de vos revenus — tout en un.
            </p>
          </div>

          {/* Bottom — Stats cards dynamiques */}
          <div className="grid grid-cols-2 gap-3">
            {([
              { icon: Car,        value: stats.vehicules,  label: "Véhicules actifs" },
              { icon: Users,      value: stats.chauffeurs, label: "Chauffeurs actifs" },
              { icon: TrendingUp, value: stats.courses,    label: "Transactions ce mois" },
              { icon: Zap,        value: stats.commission, label: "Commission Yango" },
            ] as { icon: React.ElementType; value: string; label: string }[]).map(({ icon: Icon, value, label }) => (
              <div key={label}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.07] backdrop-blur-sm hover:bg-white/[0.06] transition">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
                  <Icon size={14} className="text-indigo-400" />
                </div>
                <div>
                  <p className="text-white font-bold font-numeric text-sm leading-none">{value}</p>
                  <p className="text-gray-500 text-[10px] mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT — Login form ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center relative px-6">

        {/* Background orbs (visible on mobile too) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-indigo-600/10 blur-3xl" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-violet-600/10 blur-3xl" />
        </div>

        <div className="relative w-full max-w-sm">

          {/* Mobile logo (hidden on lg) */}
          <div className="text-center mb-8 lg:hidden">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-xl shadow-indigo-500/30 mb-3">
              <span className="text-white font-black text-lg">B</span>
            </div>
            <h1 className="text-xl font-bold text-white">BOYAH GROUP</h1>
            <p className="text-xs text-gray-500 mt-1 tracking-widest uppercase">VTC Platform</p>
          </div>

          {/* Desktop heading */}
          <div className="hidden lg:block mb-8">
            <h1 className="text-2xl font-black text-white">Connexion</h1>
            <p className="text-sm text-gray-500 mt-1">Accédez à votre espace de gestion</p>
          </div>

          {/* Form card */}
          <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-7 shadow-2xl">
            <div className="space-y-4">

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Email</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input type="email" placeholder="votre@email.com"
                    value={email} onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && login()}
                    className="w-full bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition" />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Mot de passe</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input type={showPwd ? "text" : "password"} placeholder="••••••••"
                    value={password} onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && login()}
                    className="w-full bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-gray-700 rounded-xl pl-10 pr-11 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition" />
                  <button type="button" onClick={() => setShowPwd(p => !p)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300 transition">
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button onClick={login} disabled={loading || !email || !password}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-500/20 transition-all mt-1 group">
                {loading
                  ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <>
                      <span>Se connecter</span>
                      <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                    </>
                }
              </button>

            </div>
          </div>

          <p className="text-center text-xs text-gray-700 mt-6">
            © {new Date().getFullYear()} BOYAH GROUP · Plateforme VTC
          </p>

        </div>
      </div>
    </div>
  )
}
