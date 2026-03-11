"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import {
  Wallet,
  TrendingUp,
  Car,
  Users,
  BarChart3,
  CreditCard,
  DollarSign
} from "lucide-react"

export default function KpiCards() {

  const [kpi, setKpi] = useState({
    caTotal: 0,
    depensesTotal: 0,
    profit: 0,
    caJour: 0,
    caMois: 0,
    vehicules: 0,
    chauffeurs: 0
  })

  useEffect(() => {
    fetchKpi()
  }, [])

  async function fetchKpi() {

    const { data: caJour } = await supabase
      .from("vue_ca_journalier")
      .select("date, chiffre_affaire")
      .order("date", { ascending: false })
      .limit(1)
      .single()

    const { data: caMois } = await supabase
      .from("vue_ca_mensuel")
      .select("annee, mois, chiffre_affaire")
      .order("annee", { ascending: false })
      .order("mois", { ascending: false })
      .limit(1)
      .single()

    const { data: caTotal } = await supabase
      .from("vue_ca_journalier")
      .select("chiffre_affaire")

    const totalCA =
      caTotal?.reduce(
        (sum, row) => sum + Number(row.chiffre_affaire || 0),
        0
      ) || 0

    const { data: depenses } = await supabase
      .from("vue_depenses_categories")
      .select("total_depenses")

    const totalDepenses =
      depenses?.reduce(
        (sum, row) => sum + Number(row.total_depenses || 0),
        0
      ) || 0

    const { count: vehicules } = await supabase
      .from("vehicules")
      .select("*", { count: "exact", head: true })

    const { count: chauffeurs } = await supabase
      .from("chauffeurs")
      .select("*", { count: "exact", head: true })

    setKpi({
      caTotal: totalCA,
      depensesTotal: totalDepenses,
      profit: totalCA - totalDepenses,
      caJour: caJour?.chiffre_affaire || 0,
      caMois: caMois?.chiffre_affaire || 0,
      vehicules: vehicules || 0,
      chauffeurs: chauffeurs || 0
    })
  }

  const financeCards = [
    {
      title: "CA Total",
      value: kpi.caTotal,
      icon: BarChart3,
      color: "bg-emerald-500"
    },
    {
      title: "Dépenses Totales",
      value: kpi.depensesTotal,
      icon: CreditCard,
      color: "bg-red-500"
    },
    {
      title: "Profit",
      value: kpi.profit,
      icon: DollarSign,
      color: "bg-indigo-600"
    }
  ]

  const operationsCards = [
    {
      title: "CA Aujourd'hui",
      value: kpi.caJour,
      icon: Wallet,
      color: "bg-green-500"
    },
    {
      title: "CA Mensuel",
      value: kpi.caMois,
      icon: TrendingUp,
      color: "bg-indigo-500"
    },
    {
      title: "Véhicules",
      value: kpi.vehicules,
      icon: Car,
      color: "bg-blue-500",
      currency: false
    },
    {
      title: "Chauffeurs",
      value: kpi.chauffeurs,
      icon: Users,
      color: "bg-purple-500",
      currency: false
    }
  ]

  return (

    <div className="space-y-6 mb-10">

      {/* Ligne finance */}

      <div className="grid grid-cols-3 gap-6">

        {financeCards.map((card) => {

          const Icon = card.icon

          return (

            <div
              key={card.title}
              className="bg-white p-6 rounded-2xl shadow-sm border"
            >

              <div className="flex justify-between">

                <div>

                  <p className="text-gray-500 text-sm">
                    {card.title}
                  </p>

                  <h2 className="text-2xl font-bold text-gray-900 mt-1">
                    {Number(card.value).toLocaleString()} FCFA
                  </h2>

                </div>

                <div className={`${card.color} p-3 rounded-xl`}>
                  <Icon size={20} className="text-white"/>
                </div>

              </div>

            </div>

          )

        })}

      </div>

      {/* Ligne opération */}

      <div className="grid grid-cols-4 gap-6">

        {operationsCards.map((card) => {

          const Icon = card.icon

          return (

            <div
              key={card.title}
              className="bg-white p-6 rounded-2xl shadow-sm border"
            >

              <div className="flex justify-between">

                <div>

                  <p className="text-gray-500 text-sm">
                    {card.title}
                  </p>

                  <h2 className="text-2xl font-bold text-gray-900 mt-1">

                    {card.currency === false
                      ? Number(card.value).toLocaleString()
                      : `${Number(card.value).toLocaleString()} FCFA`
                    }

                  </h2>

                </div>

                <div className={`${card.color} p-3 rounded-xl`}>
                  <Icon size={20} className="text-white"/>
                </div>

              </div>

            </div>

          )

        })}

      </div>

    </div>
  )
}