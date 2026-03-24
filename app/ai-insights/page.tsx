"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { AlertTriangle, Car, User, TrendingUp } from "lucide-react"

export default function AIInsightsPage() {

  // =========================
  // TYPES
  // =========================

  type Insight = {
    id?: string
    created_at?: string
    message?: string
    importance?: string
    type?: string
    title?: string
  }

  type ProfitType = {
    profit: number
  }

  type Vehicle = {
    immatriculation?: string
    ca_total?: number
  }

  // =========================
  // STATES
  // =========================

  const [insights, setInsights] = useState<Insight[]>([])
  const [profit, setProfit] = useState<ProfitType | null>(null)
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)

  const [question, setQuestion] = useState("")
  const [response, setResponse] = useState("")
  const [loading, setLoading] = useState(false)

  // =========================
  // LOAD DATA
  // =========================

  useEffect(() => {
    const fetchData = async () => {

      // INSIGHTS
      const { data: ins } = await supabase
        .from("vue_ai_insights_today")
        .select("*")
        .order("created_at", { ascending: false })

      setInsights(ins || [])

      // PROFIT
      const { data: p } = await supabase
        .from("vue_profit_journalier")
        .select("*")
        .order("date_recette", { ascending: false })
        .limit(1)

      setProfit(p?.[0] || null)

      // VEHICULE TOP
      const { data: v } = await supabase
        .from("vue_ca_vehicules")
        .select("*")
        .order("ca_total", { ascending: false })
        .limit(1)

      setVehicle(v?.[0] || null)
    }

    fetchData()
  }, [])

  // =========================
  // AI QUESTION
  // =========================

  const askAI = async () => {
    if (!question) return

    setLoading(true)

    try {
      const res = await fetch("/api/ai-insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ question })
      })

      const data = await res.json()
      setResponse(data.answer)

    } catch (error) {
      setResponse("Erreur lors de l'analyse IA")
    }

    setLoading(false)
  }

  // =========================
  // UI
  // =========================

  return (
    <div className="space-y-10">

      <h1 className="text-3xl font-bold text-white">
        AI Insights
      </h1>

      {/* KPI ROW */}

      <div className="grid grid-cols-3 gap-6">

        {/* SCORE */}

        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl p-6 shadow text-white">
          <p className="text-sm opacity-80">
            Fleet Health Score
          </p>

          <p className="text-4xl font-bold mt-2">
            82 / 100
          </p>

          <p className="opacity-80 text-sm mt-2">
            Votre flotte fonctionne correctement aujourd’hui.
          </p>
        </div>

        {/* PROFIT */}

        <div className="bg-white rounded-2xl p-6 shadow">
          <p className="text-gray-500 text-sm">
            Profit aujourd’hui
          </p>

          <p className="text-3xl font-bold text-green-600 mt-2">
            {profit?.profit
              ? `${profit.profit.toLocaleString()} FCFA`
              : "0 FCFA"}
          </p>
        </div>

        {/* VEHICULE TOP */}

        <div className="bg-white rounded-2xl p-6 shadow">
          <p className="text-gray-500 text-sm">
            Véhicule le plus rentable
          </p>

          <p className="text-xl font-semibold mt-2 text-indigo-600">
            {vehicle?.immatriculation || "Aucun"}
          </p>

          <p className="text-sm text-gray-500">
            {vehicle?.ca_total
              ? `${vehicle.ca_total.toLocaleString()} FCFA`
              : "0 FCFA"}
          </p>
        </div>

      </div>

      {/* INSIGHTS */}

      <div className="bg-white rounded-2xl shadow p-8">

        <h2 className="text-xl font-semibold mb-6 text-gray-900">
          Insights du jour
        </h2>

        <div className="space-y-4">

          {insights.length === 0 && (
            <p className="text-gray-500">
              Aucun insight généré aujourd’hui
            </p>
          )}

          {insights.map((insight) => {

            let icon = <TrendingUp className="text-blue-500 w-6 h-6" />
            let bg = "bg-blue-50 border-blue-200"
            let badge = "bg-blue-500"

            if (insight.importance === "critical") {
              icon = <AlertTriangle className="text-red-600 w-6 h-6" />
              bg = "bg-red-50 border-red-200"
              badge = "bg-red-600"
            }

            if (insight.importance === "high") {
              icon = <AlertTriangle className="text-orange-600 w-6 h-6" />
              bg = "bg-orange-50 border-orange-200"
              badge = "bg-orange-500"
            }

            if (insight.type === "performance") {
              icon = <User className="text-green-600 w-6 h-6" />
              bg = "bg-green-50 border-green-200"
              badge = "bg-green-600"
            }

            if (insight.type === "vehicle") {
              icon = <Car className="text-indigo-600 w-6 h-6" />
              bg = "bg-indigo-50 border-indigo-200"
              badge = "bg-indigo-600"
            }

            return (
              <div
                key={insight.id}
                className={`flex items-start gap-4 border p-5 rounded-xl ${bg}`}
              >

                <div>
                  {icon}
                </div>

                <div className="flex-1">

                  <div className="flex items-center gap-2 mb-1">

                    <span className={`text-xs text-white px-2 py-1 rounded ${badge}`}>
                      {insight.importance || "info"}
                    </span>

                    <p className="font-semibold text-gray-900">
                      {insight.title || "Insight"}
                    </p>

                  </div>

                  <p className="text-gray-700 text-sm">
                    {insight.message}
                  </p>

                </div>

              </div>
            )
          })}

        </div>

      </div>

      {/* ASSISTANT IA */}

      <div className="bg-white rounded-2xl shadow p-8">

        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          Assistant IA
        </h2>

        <div className="flex gap-3">

          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Pose une question sur ta flotte..."
            className="flex-1 bg-gray-50 border border-gray-300 text-gray-900 rounded-lg p-3"
          />

          <button
            onClick={askAI}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 rounded-lg transition"
          >
            Analyser
          </button>

        </div>

        {loading && (
          <p className="text-gray-500 mt-3">
            Analyse en cours...
          </p>
        )}

        {response && (
          <div className="mt-4 bg-gray-100 p-4 rounded-lg">
            <p className="text-gray-900">
              {response}
            </p>
          </div>
        )}

      </div>

    </div>
  )
}