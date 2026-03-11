"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Car,
  Users,
  Wallet,
  CreditCard,
  TrendingUp,
  Settings
} from "lucide-react"

const menu = [
  {
    name: "Dashboard",
    icon: LayoutDashboard,
    path: "/dashboard",
  },
  {
    name: "Véhicules",
    icon: Car,
    path: "/vehicules",
  },
  {
    name: "Chauffeurs",
    icon: Users,
    path: "/chauffeurs",
  },
  {
    name: "Recettes",
    icon: Wallet,
    path: "/recettes",
  },
  {
    name: "Dépenses",
    icon: CreditCard,
    path: "/depenses",
  },
  {
    name: "Analytics",
    icon: TrendingUp,
    path: "/analytics",
  },
  {
    name: "Paramètres",
    icon: Settings,
    path: "/settings",
  },
]

export default function Sidebar() {

  const pathname = usePathname()

  return (

    <div className="h-screen w-64 bg-zinc-950 text-white flex flex-col">

      {/* Logo */}

      <div className="h-20 flex items-center px-6 text-xl font-bold border-b border-zinc-800">

        VTC Dashboard

      </div>

      {/* Menu */}

      <nav className="flex-1 px-4 py-6 space-y-2">

        {menu.map((item) => {

          const Icon = item.icon
          const active = pathname === item.path

          return (

            <Link
              key={item.name}
              href={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all
              
              ${active
                ? "bg-indigo-600 text-white"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              }`}
            >

              <Icon size={20} />

              {item.name}

            </Link>

          )

        })}

      </nav>

      {/* Footer */}

      <div className="p-4 border-t border-zinc-800 text-sm text-zinc-500">

        VTC SaaS v1.0

      </div>

    </div>

  )
}