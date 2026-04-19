"use client"

import { useState, useMemo } from "react"
import { TrendingUp, Wallet, Activity, Plus, FileDown, BarChart3 } from "lucide-react"
import Link from "next/link"
import RecettesTable from "@/components/RecettesTable"
import RecettesChart from "@/components/RecettesChart"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"

type Recette = {
  Horodatage: string
  "Montant net": number
  chauffeur?: string
  "Nom de contrepartie"?: string
  "Nom d'utilisateur"?: string
  "Numéro de téléphone de contrepartie"?: string
}

function nomChauffeur(r: Recette): string {
  return r.chauffeur
    || r["Nom de contrepartie"]
    || r["Nom d'utilisateur"]
    || r["Numéro de téléphone de contrepartie"]
    || "Inconnu"
}

const MONTHS = [
  { label: "Ce mois",     value: "current" },
  { label: "Mois préc.",  value: "prev"    },
  { label: "3 mois",      value: "3m"      },
  { label: "Tout",        value: "all"     },
]

const COLORS = ["#6366f1","#8b5cf6","#a78bfa","#7c3aed","#4f46e5","#818cf8"]

const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-[#0D1424] border border-gray-100 dark:border-[#1E2D45] rounded-xl px-4 py-3 shadow-xl">
      <p className="text-xs text-gray-500 mb-1 truncate max-w-[150px]">{label}</p>
      <p className="text-sm font-bold font-numeric text-emerald-600 dark:text-emerald-400">
        {Number(payload[0].value).toLocaleString("fr-FR")} <span className="text-xs opacity-60">FCFA</span>
      </p>
    </div>
  )
}

export default function RecettesPageClient({ recettes: allRecettes }: { recettes: Recette[] }) {
  const [period, setPeriod] = useState<"current" | "prev" | "3m" | "all">("current")
  const [exporting, setExporting] = useState(false)

  const filtered = useMemo(() => {
    const now = new Date()
    if (period === "current") {
      return allRecettes.filter(r => {
        const d = new Date(r.Horodatage)
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      })
    }
    if (period === "prev") {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return allRecettes.filter(r => {
        const d = new Date(r.Horodatage)
        return d.getMonth() === prev.getMonth() && d.getFullYear() === prev.getFullYear()
      })
    }
    if (period === "3m") {
      const cutoff = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      return allRecettes.filter(r => new Date(r.Horodatage) >= cutoff)
    }
    return allRecettes
  }, [allRecettes, period])

  const total    = filtered.reduce((s, r) => s + Number(r["Montant net"] || 0), 0)
  const today    = new Date()
  const todayCA  = filtered.filter(r => {
    const d = new Date(r.Horodatage)
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  }).reduce((s, r) => s + Number(r["Montant net"] || 0), 0)

  // Graphique CA par chauffeur (top 6) — utilise le nom de la jointure ou le nom Wave
  const caParChauffeur = useMemo(() => {
    const map: Record<string, number> = {}
    filtered.forEach(r => {
      const nom = nomChauffeur(r)
      map[nom] = (map[nom] || 0) + Number(r["Montant net"] || 0)
    })
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([nom, ca]) => ({ nom: nom.split(" ")[0], ca: Math.round(ca) }))
  }, [filtered])

  const graphData = filtered.map(r => ({ date: r.Horodatage, montant: r["Montant net"] }))

  const handlePdf = async () => {
    setExporting(true)
    const { exportRecettesPdf } = await import("@/lib/exportPdf")
    await exportRecettesPdf(filtered)
    setExporting(false)
  }

  const kpis = [
    { label: "Recettes totales",     value: Math.round(total).toLocaleString("fr-FR"),   unit: "FCFA", icon: TrendingUp, color: "from-emerald-400 to-emerald-600", glow: "bg-emerald-500" },
    { label: "Recettes aujourd'hui", value: Math.round(todayCA).toLocaleString("fr-FR"), unit: "FCFA", icon: Wallet,     color: "from-indigo-400 to-blue-600",     glow: "bg-indigo-500"  },
    { label: "Transactions",         value: filtered.length.toLocaleString("fr-FR"),     unit: "",     icon: Activity,   color: "from-violet-400 to-purple-600",   glow: "bg-violet-500"  },
  ]

  return (
    <div className="space-y-6 animate-in">

      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Recettes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">Suivi des encaissements Wave</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtres période */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#1A2235] rounded-lg p-1">
            {MONTHS.map(m => (
              <button key={m.value} onClick={() => setPeriod(m.value as typeof period)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  period === m.value
                    ? "bg-white dark:bg-[#0D1424] text-emerald-600 dark:text-emerald-400 shadow-sm"
                    : "text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}>
                {m.label}
              </button>
            ))}
          </div>
          <button onClick={handlePdf} disabled={exporting}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-[#1E2D45] text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-500/40 transition disabled:opacity-50">
            {exporting
              ? <span className="w-4 h-4 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              : <FileDown size={15} />
            }
            PDF
          </button>
          <Link href="/recettes/create"
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-5 py-2.5 rounded-xl shadow-md shadow-emerald-500/20 text-sm font-semibold transition">
            <Plus size={15} />Ajouter
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpis.map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="relative bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 overflow-hidden hover:shadow-lg dark:hover:shadow-black/20 transition-all">
              <div className={`absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-10 blur-xl ${k.glow}`} />
              <div className="flex items-start justify-between relative">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider">{k.label}</p>
                  <p className="text-2xl font-bold font-numeric text-gray-900 dark:text-white mt-1 break-words">
                    {k.value}{k.unit && <span className="text-xs font-semibold text-gray-400 dark:text-gray-600 ml-1">{k.unit}</span>}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${k.color} flex items-center justify-center shadow-md flex-shrink-0`}>
                  <Icon size={18} className="text-white" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RecettesChart data={graphData} />
        </div>

        {/* R2 — Graphique CA par chauffeur */}
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={14} className="text-indigo-500" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">CA par chauffeur</h2>
          </div>
          {caParChauffeur.length === 0 ? (
            <div className="flex items-center justify-center h-[200px] text-sm text-gray-400">Aucune donnée</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={caParChauffeur} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="nom" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={60} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="ca" radius={[0, 6, 6, 0]} maxBarSize={18}>
                  {caParChauffeur.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Table filtrée */}
      <RecettesTable recettes={filtered} />
    </div>
  )
}
