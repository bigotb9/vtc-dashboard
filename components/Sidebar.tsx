"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  LayoutDashboard, Car, Users, Wallet, TrendingDown,
  Brain, Settings, Truck, ChevronDown, ChevronRight,
  LogOut, Building2
} from "lucide-react"

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="px-3 pt-5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-600 select-none">
      {label}
    </p>
  )
}

function NavLink({ href, label, icon: Icon, exact }: {
  href: string; label: string; icon: React.ElementType; exact?: boolean
}) {
  const pathname = usePathname()
  const active = exact ? pathname === href : pathname.startsWith(href)
  return (
    <Link href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
        ${active
          ? "nav-active"
          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200"
        }`}>
      <Icon size={17} className={active ? "text-indigo-500 dark:text-indigo-400" : "opacity-70"} />
      {label}
    </Link>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()

  type AuthUser = { email?: string; user_metadata?: { name?: string; display_name?: string } }
  const [user, setUser] = useState<AuthUser | null>(null)
  const [openBoyah, setOpenBoyah] = useState(pathname.startsWith("/boyah-transport"))
  const [openPrest, setOpenPrest] = useState(false)
  const [openVeh,   setOpenVeh]   = useState(false)
  const [openCom,   setOpenCom]   = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  if (pathname === "/") return null

  const logout = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  const SubLink = ({ href, label }: { href: string; label: string }) => {
    const active = pathname === href || pathname.startsWith(href + "/")
    return (
      <Link href={href}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
          ${active
            ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10"
            : "text-gray-500 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
          }`}>
        <span className="w-1 h-1 rounded-full bg-current opacity-60" />
        {label}
      </Link>
    )
  }

  const ToggleBtn = ({ label, icon: Icon, open, onToggle, miniIcon }: {
    label: string; icon: React.ElementType; open: boolean; onToggle: () => void; miniIcon?: React.ElementType
  }) => (
    <button onClick={onToggle}
      className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition">
      <span className="flex items-center gap-2">
        {miniIcon && <Icon size={11} />}
        {label}
      </span>
      {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
    </button>
  )

  const isBoyahActive = pathname.startsWith("/boyah-transport")
  const userInitial   = (user?.user_metadata?.name || user?.user_metadata?.display_name || user?.email || "U")[0].toUpperCase()
  const userName      = user?.user_metadata?.name || user?.user_metadata?.display_name || "Utilisateur"

  return (
    <div className="fixed top-0 left-0 w-64 h-screen flex flex-col
      bg-white dark:bg-[#060B14]
      border-r border-gray-200 dark:border-[#1A2235] z-50 overflow-hidden">

      {/* LOGO */}
      <div className="flex items-center gap-3 px-5 py-[18px] border-b border-gray-100 dark:border-[#1A2235] flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/25 flex-shrink-0 overflow-hidden">
          <Image src="/logo.png" alt="Logo" width={22} height={22} />
        </div>
        <div>
          <p className="text-[13px] font-bold text-gray-900 dark:text-white leading-tight tracking-tight">VTC Dashboard</p>
          <p className="text-[10px] text-gray-400 dark:text-gray-600 font-medium tracking-wider uppercase">Boyah Group</p>
        </div>
      </div>

      {/* NAV */}
      <div className="flex-1 overflow-y-auto px-3 py-2">

        <SectionLabel label="Navigation" />
        <div className="space-y-0.5">
          <NavLink href="/dashboard"  label="Dashboard"  icon={LayoutDashboard} exact />
          <NavLink href="/vehicules"  label="Véhicules"  icon={Car} />
          <NavLink href="/chauffeurs" label="Chauffeurs" icon={Users} />
        </div>

        <SectionLabel label="Finances" />
        <div className="space-y-0.5">
          <NavLink href="/recettes" label="Recettes" icon={Wallet} />
          <NavLink href="/depenses" label="Dépenses" icon={TrendingDown} />
        </div>

        <SectionLabel label="Services" />
        <div className="space-y-0.5">
          <button onClick={() => setOpenBoyah(p => !p)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
              ${isBoyahActive
                ? "nav-active"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200"
              }`}>
            <Truck size={17} className={isBoyahActive ? "text-indigo-500 dark:text-indigo-400" : "opacity-70"} />
            <span className="flex-1 text-left">Boyah Transport</span>
            {openBoyah ? <ChevronDown size={13} className="opacity-40" /> : <ChevronRight size={13} className="opacity-40" />}
          </button>

          {openBoyah && (
            <div className="ml-3 pl-3 border-l border-gray-200 dark:border-[#1A2235] space-y-0.5 py-1">
              <SubLink href="/boyah-transport/dashboard" label="Dashboard" />

              <ToggleBtn label="Prestataires" icon={Building2} open={openPrest} onToggle={() => setOpenPrest(p => !p)} miniIcon={Building2} />
              {openPrest && (
                <div className="ml-4 space-y-0.5">
                  <SubLink href="/boyah-transport/prestataires/create" label="Créer" />
                  <SubLink href="/boyah-transport/prestataires/list"   label="Liste" />
                </div>
              )}

              <ToggleBtn label="Véhicules" icon={Car} open={openVeh} onToggle={() => setOpenVeh(p => !p)} miniIcon={Car} />
              {openVeh && (
                <div className="ml-4 space-y-0.5">
                  <SubLink href="/boyah-transport/vehicules/create" label="Créer" />
                  <SubLink href="/boyah-transport/vehicules/list"   label="Liste" />
                </div>
              )}

              <ToggleBtn label="Commandes" icon={Wallet} open={openCom} onToggle={() => setOpenCom(p => !p)} miniIcon={Wallet} />
              {openCom && (
                <div className="ml-4 space-y-0.5">
                  <SubLink href="/boyah-transport/commandes/list" label="Liste" />
                </div>
              )}
            </div>
          )}
        </div>

        <SectionLabel label="Système" />
        <div className="space-y-0.5">
          <NavLink href="/ai-insights-boyah-group" label="AI Insights Boyah Group" icon={Brain} />
          <NavLink href="/parametres"  label="Paramètres"   icon={Settings} />
        </div>

      </div>

      {/* BOTTOM */}
      <div className="border-t border-gray-100 dark:border-[#1A2235] px-4 py-4 space-y-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-600 font-medium">Apparence</span>
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-100 dark:border-[#1A2235]">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {userInitial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{userName}</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-600 truncate">{user?.email}</p>
          </div>
          <button onClick={logout}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition flex-shrink-0"
            title="Déconnexion">
            <LogOut size={14} />
          </button>
        </div>
      </div>

    </div>
  )
}
