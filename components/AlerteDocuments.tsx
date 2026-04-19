"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { AlertTriangle, Shield, Gauge, Wrench, ChevronRight, CalendarX, CheckCircle2 } from "lucide-react"
import Link from "next/link"

const SEUILS = [
  { label: "7j",  value: 7  },
  { label: "14j", value: 14 },
  { label: "30j", value: 30 },
  { label: "60j", value: 60 },
]

type DocAlerte = {
  id_vehicule: number
  immatriculation: string
  document: string
  dateExpiration: string
  joursRestants: number
}

function diffJours(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.floor((new Date(dateStr).getTime() - today.getTime()) / 86400000)
}

export default function AlerteDocuments() {
  const [alertes, setAlertes] = useState<DocAlerte[]>([])
  const [loading, setLoading] = useState(true)
  const [seuil,   setSeuil]   = useState(14)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data } = await supabase
        .from("vehicules")
        .select("id_vehicule, immatriculation, date_expiration_assurance, date_expiration_visite, date_expiration_carte_stationnement, date_expiration_patente")
        .eq("statut", "ACTIF")

      if (!data) { setLoading(false); return }

      const liste: DocAlerte[] = []

      for (const v of data) {
        const docs = [
          { document: "Assurance",              dateExpiration: v.date_expiration_assurance },
          { document: "Visite technique",       dateExpiration: v.date_expiration_visite },
          { document: "Carte de stationnement", dateExpiration: v.date_expiration_carte_stationnement },
          { document: "Patente",                dateExpiration: v.date_expiration_patente },
        ]
        for (const d of docs) {
          if (!d.dateExpiration) continue
          const j = diffJours(d.dateExpiration)
          if (j <= seuil) {
            liste.push({
              id_vehicule:    v.id_vehicule,
              immatriculation: v.immatriculation,
              document:       d.document,
              dateExpiration: d.dateExpiration,
              joursRestants:  j,
            })
          }
        }
      }

      // Tri : expirés d'abord, puis plus urgent
      liste.sort((a, b) => a.joursRestants - b.joursRestants)
      setAlertes(liste)
      setLoading(false)
    }
    load()
  }, [seuil])

  const expires    = alertes.filter(a => a.joursRestants < 0)
  const urgents    = alertes.filter(a => a.joursRestants >= 0 && a.joursRestants <= 30)
  const attentions = alertes.filter(a => a.joursRestants > 30)

  const aucuneAlerte = !loading && alertes.length === 0

  const borderColor = aucuneAlerte ? "border-emerald-200 dark:border-emerald-500/30"
    : expires.length > 0 ? "border-red-200 dark:border-red-800"
    : urgents.length > 0 ? "border-orange-200 dark:border-orange-800"
    : "border-amber-200 dark:border-amber-800"

  const bgColor = aucuneAlerte ? "bg-emerald-50/60 dark:bg-emerald-500/5"
    : expires.length > 0 ? "bg-red-50 dark:bg-red-900/10"
    : urgents.length > 0 ? "bg-orange-50 dark:bg-orange-900/10"
    : "bg-amber-50/60 dark:bg-amber-900/5"

  const iconColor = aucuneAlerte ? "text-emerald-500"
    : expires.length > 0 ? "text-red-500"
    : urgents.length > 0 ? "text-orange-500"
    : "text-amber-500"

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })

  return (
    <div className={`rounded-2xl border ${borderColor} ${bgColor} p-5 space-y-3`}>
      {/* En-tête */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {aucuneAlerte
            ? <CheckCircle2 size={16} className={iconColor} />
            : <AlertTriangle size={16} className={iconColor} />
          }
          <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
            Documents véhicules
            {!aucuneAlerte && (
              <span className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-full ${
                expires.length > 0 ? "bg-red-200 dark:bg-red-800 text-red-700 dark:text-red-300"
                : "bg-orange-200 dark:bg-orange-800 text-orange-700 dark:text-orange-300"
              }`}>
                {alertes.length} alerte{alertes.length > 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Seuil configurable */}
          <div className="flex items-center gap-1 bg-white/60 dark:bg-black/20 rounded-lg p-0.5 border border-black/5 dark:border-white/5">
            {SEUILS.map(s => (
              <button key={s.value} onClick={() => setSeuil(s.value)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition ${
                  seuil === s.value
                    ? "bg-white dark:bg-[#0D1424] text-orange-600 dark:text-orange-400 shadow-sm"
                    : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                }`}>
                {s.label}
              </button>
            ))}
          </div>
          <Link href="/vehicules" className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-500 transition">
            Voir tous <ChevronRight size={12} />
          </Link>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-2 animate-pulse">
          {[1,2,3].map(i => (
            <div key={i} className="h-10 bg-white/40 dark:bg-white/5 rounded-xl" />
          ))}
        </div>
      )}

      {/* État "tout va bien" */}
      {aucuneAlerte && (
        <div className="flex items-center gap-3 py-3">
          <CheckCircle2 size={28} className="text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              Tous les documents sont à jour
            </p>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-500/60 mt-0.5">
              Aucun document n&apos;expire dans les {seuil} prochains jours
            </p>
          </div>
        </div>
      )}

      {/* Liste alertes */}
      {!loading && !aucuneAlerte && (
      <div className="space-y-1.5">
        {alertes.slice(0, 6).map((a, i) => (
          <Link key={i} href={`/vehicules/${a.id_vehicule}`}
            className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/70 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 border border-white/50 dark:border-white/10 transition group">
            <div className="flex items-center gap-2.5">
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                a.document === "Assurance"         ? "bg-blue-500"
                : a.document === "Visite technique" ? "bg-violet-500"
                : a.document === "Carte de stationnement" ? "bg-teal-500"
                : "bg-amber-500"
              }`}>
                {a.document === "Assurance"         ? <Shield size={11} className="text-white" />
              : a.document === "Visite technique" ? <Gauge size={11} className="text-white" />
              : <Wrench size={11} className="text-white" />
            }
              </div>
              <div>
                <p className="text-xs font-bold text-gray-800 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                  {a.immatriculation}
                </p>
                <p className="text-[10px] text-gray-500">{a.document} · expire {fmtDate(a.dateExpiration)}</p>
              </div>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
              a.joursRestants < 0
                ? "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
                : a.joursRestants <= 30
                ? "bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400"
                : "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400"
            }`}>
              {a.joursRestants < 0
                ? <><CalendarX size={9} className="inline mr-0.5" />Expiré</>
                : `${a.joursRestants}j`
              }
            </span>
          </Link>
        ))}
        {alertes.length > 6 && (
          <p className="text-xs text-center text-gray-400 pt-1">
            +{alertes.length - 6} autres — <Link href="/vehicules" className="text-indigo-500 hover:underline">voir tous</Link>
          </p>
        )}
      </div>
      )}

      {/* Légende */}
      {!aucuneAlerte && !loading && (
      <div className="flex items-center gap-4 pt-1 border-t border-black/5 dark:border-white/5">
        {expires.length > 0    && <span className="text-[10px] text-red-600 dark:text-red-400 font-semibold flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{expires.length} expiré{expires.length > 1 ? "s" : ""}</span>}
        {urgents.length > 0    && <span className="text-[10px] text-orange-600 dark:text-orange-400 font-semibold flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />{urgents.length} urgent{urgents.length > 1 ? "s" : ""} (≤30j)</span>}
        {attentions.length > 0 && <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />{attentions.length} attention (≤60j)</span>}
      </div>
      )}
    </div>
  )
}
