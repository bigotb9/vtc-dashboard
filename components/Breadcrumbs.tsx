"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Home } from "lucide-react"

const LABELS: Record<string, string> = {
  dashboard:          "Dashboard",
  chauffeurs:         "Chauffeurs",
  vehicules:          "Véhicules",
  recettes:           "Recettes",
  depenses:           "Dépenses",
  clients:            "Clients",
  parametres:         "Paramètres",
  settings:           "Paramètres",
  create:             "Nouveau",
  edit:               "Modifier",
  "ai-insights":      "AI Insights",
  "ai-insights-boyah-group": "AI Insights Boyah Group",
  "boyah-transport":  "Boyah Transport",
  prestataires:       "Prestataires",
  commandes:          "Commandes",
  list:               "Liste",
  "journal-activite": "Journal d'activité",
}

function isId(segment: string) {
  return /^\d+$/.test(segment)
}

export default function Breadcrumbs({ entityName }: { entityName?: string }) {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length <= 1) return null

  const crumbs = segments.map((seg, i) => {
    const href  = "/" + segments.slice(0, i + 1).join("/")
    const label = isId(seg) ? (entityName ?? `#${seg}`) : (LABELS[seg] ?? seg)
    return { href, label, isLast: i === segments.length - 1 }
  })

  return (
    <nav className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-600 mb-4 flex-wrap">
      <Link href="/dashboard"
        className="flex items-center gap-1 hover:text-indigo-500 dark:hover:text-indigo-400 transition">
        <Home size={11} />
      </Link>
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight size={11} className="opacity-40 flex-shrink-0" />
          {c.isLast
            ? <span className="text-gray-700 dark:text-gray-300 font-medium">{c.label}</span>
            : <Link href={c.href} className="hover:text-indigo-500 dark:hover:text-indigo-400 transition">{c.label}</Link>
          }
        </span>
      ))}
    </nav>
  )
}
