"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { ThemeToggle } from "@/components/theme-toggle"

import {
  LayoutDashboard,
  Car,
  Users,
  Wallet,
  TrendingDown,
  Brain,
  Settings,
  Route
} from "lucide-react"

export default function Sidebar(){

  const pathname = usePathname()
  const router = useRouter()
  const [user,setUser] = useState<any>(null)

  const [openBoyah, setOpenBoyah] = useState(true)
  const [openPrestataires, setOpenPrestataires] = useState(true)
  const [openVehicules, setOpenVehicules] = useState(false)
  const [openCommandes, setOpenCommandes] = useState(false)

  useEffect(()=>{
    const getUser = async()=>{
      const { data } = await supabase.auth.getUser()
      setUser(data.user)
    }
    getUser()
  },[])

  if(pathname === "/") return null

  const logout = async ()=>{
    await supabase.auth.signOut()
    router.push("/")
  }

  const isActive = (path:string) => pathname.startsWith(path)

  return(

    <div className="fixed top-0 left-0 w-64 h-screen flex flex-col justify-between
    bg-white dark:bg-[#0F1117]
    border-r border-gray-200 dark:border-gray-800 z-50 overflow-y-auto">

      {/* TOP */}
      <div>

        {/* LOGO */}
        <div className="flex items-center gap-3 px-5 py-6">
          <Image src="/logo.png" alt="BOYAH" width={36} height={36} className="rounded-lg"/>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            VTC Dashboard
          </h1>
        </div>

        {/* MENU */}
        <div className="px-3 space-y-2">

          <Link href="/dashboard" className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
            ${pathname === "/dashboard" ? "bg-indigo-600 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}>
            <LayoutDashboard size={18}/>
            Dashboard
          </Link>

          <Link href="/vehicules" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <Car size={18}/>
            Véhicules
          </Link>

          <Link href="/chauffeurs" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <Users size={18}/>
            Chauffeurs
          </Link>

          <div className="h-px bg-gray-200 dark:bg-gray-800 my-2" />

          <Link href="/recettes" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <Wallet size={18}/>
            Recettes
          </Link>

          <Link href="/depenses" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <TrendingDown size={18}/>
            Dépenses
          </Link>

          <button
            onClick={()=>setOpenBoyah(!openBoyah)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
            ${isActive("/boyah-transport") ? "bg-indigo-600 text-white" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}>
            <Route size={18}/>
            <span className="flex-1 text-left">Boyah Transport</span>
            ▼
          </button>

          {openBoyah && (
            <div className="ml-4 space-y-1">

              <Link href="/boyah-transport/dashboard" className={`block px-3 py-2 text-xs rounded
                ${isActive("/boyah-transport/dashboard") ? "bg-indigo-500 text-white" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"}`}>
                Dashboard
              </Link>

              <button onClick={()=>setOpenPrestataires(!openPrestataires)} className="w-full text-left px-3 py-2 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                Prestataires ▼
              </button>

              {openPrestataires && (
                <div className="ml-4">
                  <Link href="/boyah-transport/prestataires/create" className="block px-3 py-1 text-xs hover:text-indigo-500">
                    Create
                  </Link>
                  <Link href="/boyah-transport/prestataires/list" className="block px-3 py-1 text-xs hover:text-indigo-500">
                    List
                  </Link>
                </div>
              )}

              <button onClick={()=>setOpenVehicules(!openVehicules)} className="w-full text-left px-3 py-2 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                Véhicules ▼
              </button>

              {openVehicules && (
                <div className="ml-4">
                  <Link href="/boyah-transport/vehicules/create" className="block px-3 py-1 text-xs hover:text-indigo-500">
                    Create
                  </Link>
                  <Link href="/boyah-transport/vehicules/list" className="block px-3 py-1 text-xs hover:text-indigo-500">
                    List
                  </Link>
                </div>
              )}

              <button onClick={()=>setOpenCommandes(!openCommandes)} className="w-full text-left px-3 py-2 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                Commandes ▼
              </button>

              {openCommandes && (
                <div className="ml-4">
                  <Link href="/boyah-transport/commandes/list" className="block px-3 py-1 text-xs hover:text-indigo-500">
                    List
                  </Link>
                </div>
              )}

            </div>
          )}

          <div className="h-px bg-gray-200 dark:bg-gray-800 my-2" />

          <Link href="/ai-insights" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <Brain size={18}/>
            AI Insights
          </Link>

          <div className="h-px bg-gray-200 dark:bg-gray-800 my-2" />

          <Link href="/parametres" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <Settings size={18}/>
            Settings
          </Link>

        </div>

      </div>

      {/* BOTTOM */}
      <div className="p-4 space-y-4">

        <div className="flex items-center justify-between px-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">Mode</span>
          <ThemeToggle />
        </div>

        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
            👤
          </div>

          <div className="text-xs">
            <p className="font-medium text-gray-900 dark:text-white">
              {user?.user_metadata?.name || "Utilisateur"}
            </p>
            <p className="text-gray-500 dark:text-gray-400 truncate max-w-[140px]">
              {user?.email}
            </p>
          </div>
        </div>

        <button onClick={logout} className="w-full text-xs bg-red-500 hover:bg-red-600 p-2.5 rounded-lg text-white">
          Se déconnecter
        </button>

      </div>

    </div>
  )
}