"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { motion } from "framer-motion"

type BreadcrumbItem = { label: string; href?: string }

type AccentColor = "indigo" | "emerald" | "sky" | "violet" | "amber" | "rose" | "teal"

const ACCENT: Record<AccentColor, { grad: string; ring: string; icon: string }> = {
  indigo:  { grad: "from-indigo-500/20 to-violet-500/10",  ring: "ring-indigo-500/25",  icon: "text-indigo-400 dark:text-indigo-400" },
  emerald: { grad: "from-emerald-500/20 to-teal-500/10",  ring: "ring-emerald-500/25", icon: "text-emerald-400" },
  sky:     { grad: "from-sky-500/20 to-cyan-500/10",      ring: "ring-sky-500/25",     icon: "text-sky-400" },
  violet:  { grad: "from-violet-500/20 to-purple-500/10", ring: "ring-violet-500/25",  icon: "text-violet-400" },
  amber:   { grad: "from-amber-500/20 to-orange-500/10",  ring: "ring-amber-500/25",   icon: "text-amber-400" },
  rose:    { grad: "from-rose-500/20 to-red-500/10",      ring: "ring-rose-500/25",    icon: "text-rose-400" },
  teal:    { grad: "from-teal-500/20 to-emerald-500/10",  ring: "ring-teal-500/25",    icon: "text-teal-400" },
}

export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
  breadcrumb,
  accent = "indigo",
}: {
  title: string
  subtitle?: string
  icon?: React.ReactNode          // ReactNode (pas ElementType) pour éviter le passage de fonction depuis Server Components
  actions?: React.ReactNode
  breadcrumb?: BreadcrumbItem[]
  accent?: AccentColor
}) {
  const a = ACCENT[accent]

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="flex flex-wrap items-start justify-between gap-4"
    >
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div className={`flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${a.grad} ring-1 ${a.ring} flex items-center justify-center mt-0.5`}>
            {icon}
          </div>
        )}
        <div className="min-w-0">
          {breadcrumb && breadcrumb.length > 0 && (
            <nav className="flex items-center gap-1 mb-1">
              {breadcrumb.map((b, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight size={10} className="text-gray-600 dark:text-gray-700" />}
                  {b.href
                    ? <Link href={b.href} className="text-[11px] text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition">{b.label}</Link>
                    : <span className="text-[11px] text-gray-400 dark:text-gray-600">{b.label}</span>
                  }
                </span>
              ))}
            </nav>
          )}
          <h1 className="text-[1.4rem] font-black tracking-tight text-gray-900 dark:text-white leading-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[12px] text-gray-500 dark:text-gray-500 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          {actions}
        </div>
      )}
    </motion.div>
  )
}
