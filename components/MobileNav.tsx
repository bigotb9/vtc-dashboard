"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Car, Users, Wallet, MoreHorizontal } from "lucide-react"
import { motion } from "framer-motion"

const ITEMS = [
  { href: "/dashboard",  label: "Dashboard",  icon: LayoutDashboard, exact: true },
  { href: "/vehicules",  label: "Véhicules",  icon: Car              },
  { href: "/chauffeurs", label: "Chauffeurs", icon: Users            },
  { href: "/recettes",   label: "Recettes",   icon: Wallet           },
]

export default function MobileNav() {
  const pathname = usePathname()

  // Masquer sur la page login
  if (pathname === "/") return null

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40
      bg-white/95 dark:bg-[#060B14]/95 backdrop-blur-md
      border-t border-gray-200 dark:border-[#1A2235]
      safe-area-pb">

      <div className="flex items-center justify-around px-2 py-2">
        {ITEMS.map(item => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          const Icon   = item.icon
          const showBadge = false

          return (
            <Link key={item.href} href={item.href}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all relative">
              <div className="relative">
                <motion.div
                  animate={{ scale: active ? 1.15 : 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                >
                  <Icon
                    size={22}
                    className={active
                      ? "text-indigo-600 dark:text-indigo-400"
                      : "text-gray-400 dark:text-gray-600"
                    }
                  />
                </motion.div>
              </div>
              <span className={`text-[10px] font-semibold transition-colors ${
                active
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-gray-400 dark:text-gray-600"
              }`}>
                {item.label}
              </span>
              {active && (
                <motion.div
                  layoutId="mobile-nav-pill"
                  className="absolute inset-0 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl -z-10"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}
            </Link>
          )
        })}

        {/* Bouton "Plus" → ouvre le menu sidebar mobile */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("open-sidebar"))}
          className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all">
          <MoreHorizontal size={22} className="text-gray-400 dark:text-gray-600" />
          <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-600">Plus</span>
        </button>
      </div>
    </nav>
  )
}
