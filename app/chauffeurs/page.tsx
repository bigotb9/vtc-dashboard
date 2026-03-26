export const dynamic = 'force-dynamic'

import { supabase } from "@/lib/supabaseClient"
import ChauffeursTable from "@/components/ChauffeursTable"
import ChauffeursChart from "@/components/ChauffeursChart"
import TopChauffeurChart from "@/components/TopChauffeurChart"
import Link from "next/link"
import { Users, UserCheck, UserX, Trophy, Plus } from "lucide-react"

export default async function ChauffeursPage() {

  const { data: chauffeurs } = await supabase.from("vue_chauffeurs_vehicules").select("*")
  const { data: classement } = await supabase.from("classement_chauffeurs").select("*").order("ca", { ascending: false })

  const totalChauffeurs   = chauffeurs?.length || 0
  const chauffeursActifs  = chauffeurs?.filter(c => c.actif === true).length  || 0
  const chauffeursInactifs= chauffeurs?.filter(c => c.actif === false).length || 0
  const topChauffeur      = classement?.[0]

  let versementsTop: { date_recette: string; montant: number }[] = []
  if (topChauffeur) {
    const { data } = await supabase.from("vue_ca_chauffeur_jour").select("*").eq("nom", topChauffeur.nom)
    versementsTop = (data || []).map((d: Record<string, unknown>) => ({
      date_recette: String(d.date_recette ?? d.date ?? ""),
      montant:      Number(d.montant ?? d.ca ?? d.ca_jour ?? d.chiffre_affaire ?? 0),
    }))
  }

  const kpis = [
    { label: "Total",    value: totalChauffeurs,    icon: Users,      color: "from-indigo-400 to-blue-600",     glow: "bg-indigo-500" },
    { label: "Actifs",   value: chauffeursActifs,   icon: UserCheck,  color: "from-emerald-400 to-teal-600",   glow: "bg-emerald-500" },
    { label: "Inactifs", value: chauffeursInactifs,  icon: UserX,      color: "from-red-400 to-rose-600",       glow: "bg-red-500" },
  ]

  return (
    <div className="space-y-6 animate-in">

      {/* HEADER */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Chauffeurs</h1>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">Gestion de l'équipe</p>
        </div>
        <Link href="/chauffeurs/create">
          <button className="flex items-center gap-2 bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white px-5 py-2.5 rounded-xl shadow-md shadow-indigo-500/20 text-sm font-semibold transition">
            <Plus size={15} />Ajouter un chauffeur
          </button>
        </Link>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpis.map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="relative bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 overflow-hidden hover:shadow-lg dark:hover:shadow-black/20 transition-all">
              <div className={`absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-10 blur-xl ${k.glow}`} />
              <div className="flex items-start justify-between relative">
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wider">{k.label}</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{k.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${k.color} flex items-center justify-center shadow-md flex-shrink-0`}>
                  <Icon size={18} className="text-white" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        <div className="lg:col-span-2 bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Performance — Top chauffeurs</h2>
          <ChauffeursChart data={classement || []} />
        </div>

        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-gray-100 dark:border-[#1E2D45] p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
              <Trophy size={13} className="text-white" />
            </div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Top chauffeur</h2>
          </div>
          {topChauffeur && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-100 dark:border-amber-500/20">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
                  {topChauffeur.nom?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-white text-sm">{topChauffeur.nom}</p>
                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                    {topChauffeur.ca?.toLocaleString("fr-FR")} FCFA
                  </p>
                </div>
              </div>
              <TopChauffeurChart data={versementsTop} />
            </div>
          )}
        </div>
      </div>

      {/* TABLE */}
      <ChauffeursTable chauffeurs={chauffeurs || []} classement={classement || []} />

    </div>
  )
}
