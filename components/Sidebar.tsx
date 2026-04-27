"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState, useRef, useLayoutEffect } from "react"
import { supabase } from "@/lib/supabaseClient"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  LayoutDashboard, Car, Users, Wallet, TrendingDown,
  Brain, Settings, Truck, ChevronDown, ChevronRight,
  LogOut, Building2, UserCheck, Activity, PanelLeftClose, PanelLeftOpen, MapPin
} from "lucide-react"
import { useProfile } from "@/hooks/useProfile"
import { motion, AnimatePresence } from "framer-motion"
import { useSidebar } from "@/lib/SidebarContext"

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="my-2 h-px bg-gray-100 dark:bg-[#1A2235] mx-2" />
  return (
    <p className="px-3 pt-5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-600 select-none">
      {label}
    </p>
  )
}

// ── Sliding pill indicator ────────────────────────────────────────────────────
function SlidingPill({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const pathname = usePathname()
  const [rect, setRect] = useState<{ top: number; height: number } | null>(null)

  useLayoutEffect(() => {
    if (!containerRef.current) return
    const active = containerRef.current.querySelector("[data-nav-active='true']") as HTMLElement | null
    if (active) {
      const containerRect = containerRef.current.getBoundingClientRect()
      const elRect = active.getBoundingClientRect()
      setRect({ top: elRect.top - containerRect.top + containerRef.current.scrollTop, height: elRect.height })
    } else {
      setRect(null)
    }
  }, [pathname, containerRef])

  if (!rect) return null
  return (
    <motion.div
      layoutId="nav-pill"
      className="absolute left-1.5 right-1.5 rounded-xl bg-indigo-500/8 dark:bg-indigo-500/10 border border-indigo-200/50 dark:border-indigo-500/15 pointer-events-none z-0"
      style={{ top: rect.top, height: rect.height }}
      transition={{ type: "spring", stiffness: 350, damping: 30 }}
    />
  )
}

// ── Nav link ──────────────────────────────────────────────────────────────────
function NavLink({ href, label, icon: Icon, exact, collapsed, badge }: {
  href: string; label: string; icon: React.ElementType; exact?: boolean; collapsed: boolean; badge?: number
}) {
  const pathname = usePathname()
  const active = exact ? pathname === href : pathname.startsWith(href)
  return (
    <Link href={href} data-nav-active={active} title={collapsed ? label : undefined}
      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 z-10
        ${collapsed ? "justify-center px-0" : ""}
        ${active
          ? "text-indigo-700 dark:text-indigo-300"
          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200"
        }`}>
      <div className="relative flex-shrink-0">
        <motion.div
          whileHover={{ scale: 1.15, rotate: active ? 0 : -8 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
        >
          <Icon size={17} className={active ? "text-indigo-500 dark:text-indigo-400" : "opacity-70"} />
        </motion.div>
        {badge && badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </div>
      {!collapsed && label}
      {!collapsed && badge && badge > 0 ? (
        <span className="ml-auto w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </Link>
  )
}

// ── Sub link (Boyah children) ─────────────────────────────────────────────────
function SubLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(href + "/")
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Link href={href}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
          ${active
            ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10"
            : "text-gray-500 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
          }`}>
        <span className="w-1 h-1 rounded-full bg-current opacity-60" />
        {label}
      </Link>
    </motion.div>
  )
}

// ── Toggle button (expand/collapse sub-sections) ──────────────────────────────
function ToggleBtn({ label, icon: Icon, open, onToggle }: {
  label: string; icon: React.ElementType; open: boolean; onToggle: () => void
}) {
  return (
    <button onClick={onToggle}
      className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition">
      <span className="flex items-center gap-2">
        <Icon size={11} />
        {label}
      </span>
      <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </motion.span>
    </button>
  )
}

// ── Main Sidebar ──────────────────────────────────────────────────────────────
export default function Sidebar({ forceShow = false }: { forceShow?: boolean }) {
  const pathname = usePathname()
  const router   = useRouter()
  const navRef   = useRef<HTMLDivElement>(null)
  const { collapsed, toggle } = useSidebar()
  const { isDirecteur, can } = useProfile()

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

  const isBoyahActive = pathname.startsWith("/boyah-transport")
  const userInitial   = (user?.user_metadata?.name || user?.user_metadata?.display_name || user?.email || "U")[0].toUpperCase()
  const userName      = user?.user_metadata?.name || user?.user_metadata?.display_name || "Utilisateur"

  return (
    <motion.div
      animate={{ width: collapsed ? 64 : 256 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`fixed top-0 left-0 h-screen flex-col
        bg-white dark:bg-[#060B14]
        border-r border-gray-200 dark:border-[#1A2235] z-50 overflow-hidden
        ${forceShow ? "flex" : "hidden md:flex"}`}
    >

      {/* LOGO + COLLAPSE TOGGLE */}
      <div className={`flex items-center border-b border-gray-100 dark:border-[#1A2235] flex-shrink-0 ${collapsed ? "justify-center px-2 py-[18px]" : "gap-3 px-5 py-[18px]"}`}>
        <motion.div
          className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/25 flex-shrink-0 overflow-hidden cursor-pointer"
          whileHover={{ scale: 1.08, rotate: 3 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
          onClick={toggle}
          title={collapsed ? "Développer" : "Réduire"}
        >
          <Image src="/logo.png" alt="Logo" width={22} height={22} />
        </motion.div>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex items-center justify-between min-w-0"
          >
            <div>
              <p className="text-[13px] font-bold text-gray-900 dark:text-white leading-tight tracking-tight">VTC Dashboard</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-600 font-medium tracking-wider uppercase">Boyah Group</p>
            </div>
            <button onClick={toggle} title="Réduire"
              className="p-1 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition flex-shrink-0">
              <PanelLeftClose size={14} />
            </button>
          </motion.div>
        )}
        {collapsed && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={toggle}
            title="Développer"
            className="absolute top-4 right-1 p-1 rounded-lg text-gray-400 hover:text-indigo-500 transition"
          >
            <PanelLeftOpen size={12} />
          </motion.button>
        )}
      </div>

      {/* NAV */}
      <div ref={navRef} className={`flex-1 overflow-y-auto py-2 relative ${collapsed ? "px-1.5" : "px-3"}`}>
        {!collapsed && <SlidingPill containerRef={navRef} />}

        <SectionLabel label="Navigation" collapsed={collapsed} />
        <div className="space-y-0.5">
          {can("view_dashboard")  && <NavLink href="/dashboard"       label="Dashboard"  icon={LayoutDashboard} exact collapsed={collapsed} />}
          {can("view_vehicules")  && <NavLink href="/vehicules"       label="Véhicules"  icon={Car}             collapsed={collapsed} />}
          {can("view_vehicules")  && <NavLink href="/vehicules/carte" label="GPS Live"   icon={MapPin}          collapsed={collapsed} />}
          {can("view_chauffeurs") && <NavLink href="/chauffeurs"      label="Chauffeurs" icon={Users}           collapsed={collapsed} />}
          {can("manage_clients")  && <NavLink href="/clients"         label="Clients"    icon={UserCheck}       collapsed={collapsed} />}
        </div>

        <SectionLabel label="Finances" collapsed={collapsed} />
        <div className="space-y-0.5">
          {can("view_recettes") && <NavLink href="/recettes" label="Recettes" icon={Wallet}      collapsed={collapsed} />}
          {can("view_depenses") && <NavLink href="/depenses" label="Dépenses" icon={TrendingDown} collapsed={collapsed} />}
        </div>

        <SectionLabel label="Services" collapsed={collapsed} />
        <div className="space-y-0.5">
          {collapsed ? (
            <NavLink href="/boyah-transport/dashboard" label="Boyah Transport" icon={Truck} collapsed={collapsed} />
          ) : (
            <>
              <button onClick={() => setOpenBoyah(p => !p)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all z-10 relative
                  ${isBoyahActive
                    ? "text-indigo-700 dark:text-indigo-300"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200"
                  }`}
                data-nav-active={isBoyahActive}>
                <motion.div whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
                  <Truck size={17} className={isBoyahActive ? "text-indigo-500 dark:text-indigo-400" : "opacity-70"} />
                </motion.div>
                <span className="flex-1 text-left">Boyah Transport</span>
                <motion.span animate={{ rotate: openBoyah ? 90 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronRight size={13} className="opacity-40" />
                </motion.span>
              </button>

              <AnimatePresence>
                {openBoyah && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="ml-3 pl-3 border-l border-gray-200 dark:border-[#1A2235] space-y-0.5 py-1">
                      <SubLink href="/boyah-transport/dashboard"    label="Dashboard" />
                      <SubLink href="/boyah-transport/ai-insights" label="AI Insights" />

                      <ToggleBtn label="Prestataires" icon={Building2} open={openPrest} onToggle={() => setOpenPrest(p => !p)} />
                      <AnimatePresence>
                        {openPrest && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                            <div className="ml-4 space-y-0.5">
                              <SubLink href="/boyah-transport/prestataires/create" label="Créer" />
                              <SubLink href="/boyah-transport/prestataires/list"   label="Liste" />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <ToggleBtn label="Véhicules" icon={Car} open={openVeh} onToggle={() => setOpenVeh(p => !p)} />
                      <AnimatePresence>
                        {openVeh && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                            <div className="ml-4 space-y-0.5">
                              <SubLink href="/boyah-transport/vehicules/create" label="Créer" />
                              <SubLink href="/boyah-transport/vehicules/list"   label="Liste" />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <ToggleBtn label="Commandes" icon={Wallet} open={openCom} onToggle={() => setOpenCom(p => !p)} />
                      <AnimatePresence>
                        {openCom && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                            <div className="ml-4 space-y-0.5">
                              <SubLink href="/boyah-transport/commandes/list" label="Liste" />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        <SectionLabel label="Système" collapsed={collapsed} />
        <div className="space-y-0.5">
          {can("view_ai_insights") && <NavLink href="/ai-insights-boyah-group" label="AI Insights" icon={Brain}    collapsed={collapsed} />}
          {isDirecteur            && <NavLink href="/journal-activite"        label="Journal"     icon={Activity} collapsed={collapsed} />}
          <NavLink href="/parametres" label="Paramètres" icon={Settings} collapsed={collapsed} />
        </div>
      </div>

      {/* BOTTOM */}
      <div className={`border-t border-gray-100 dark:border-[#1A2235] py-4 space-y-3 flex-shrink-0 ${collapsed ? "px-1.5" : "px-4"}`}>
        {!collapsed && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-600 font-medium">Apparence</span>
            <ThemeToggle />
          </div>
        )}
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <ThemeToggle />
            <motion.div
              className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold cursor-pointer"
              whileHover={{ scale: 1.1 }}
              title={userName}
            >
              {userInitial}
            </motion.div>
            <motion.button onClick={logout} title="Déconnexion"
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
              whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}>
              <LogOut size={14} />
            </motion.button>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-100 dark:border-[#1A2235]">
            <motion.div
              className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              whileHover={{ scale: 1.1 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
            >
              {userInitial}
            </motion.div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{userName}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-600 truncate">{user?.email}</p>
            </div>
            <motion.button
              onClick={logout}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition flex-shrink-0"
              title="Déconnexion"
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
            >
              <LogOut size={14} />
            </motion.button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
