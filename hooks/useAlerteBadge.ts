"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"

type AlerteCount = { documents: number; paiements: number; total: number }

export function useAlerteBadge(): AlerteCount {
  const [counts, setCounts] = useState<AlerteCount>({ documents: 0, paiements: 0, total: 0 })

  useEffect(() => {
    const load = async () => {
      const today  = new Date().toISOString().split("T")[0]
      const seuil  = parseInt(localStorage.getItem("app_alert_threshold") || "14")
      const cutoff = new Date(Date.now() + seuil * 86400000).toISOString().split("T")[0]

      const [{ data: vehicules }, { data: recettes }] = await Promise.all([
        supabase.from("vehicules")
          .select("id_vehicule, date_expiration_assurance, date_expiration_visite, date_expiration_carte_stationnement, date_expiration_patente")
          .eq("statut", "ACTIF"),
        supabase.from("recettes_wave").select("Horodatage").gte("Horodatage", today),
      ])

      // Documents expirant bientôt
      let docs = 0
      for (const v of vehicules || []) {
        const dates = [v.date_expiration_assurance, v.date_expiration_visite, v.date_expiration_carte_stationnement, v.date_expiration_patente]
        for (const d of dates) {
          if (d && d <= cutoff) docs++
        }
      }

      // Paiements en retard
      const totalVeh  = vehicules?.length || 0
      const payesAuj  = recettes?.length  || 0
      const retard    = Math.max(0, totalVeh - payesAuj)

      const total = (docs > 0 ? 1 : 0) + (retard > 0 ? 1 : 0)
      setCounts({ documents: docs, paiements: retard, total })
    }

    load()
    const id = setInterval(load, 5 * 60 * 1000) // rafraîchit toutes les 5 min
    return () => clearInterval(id)
  }, [])

  return counts
}
