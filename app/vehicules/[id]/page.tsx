export const dynamic = 'force-dynamic'

import { supabase } from "@/lib/supabaseClient"
import Link from "next/link"
import Image from "next/image"
import {
  ArrowLeft, Car, User, Wrench,
  TrendingUp, Wallet, AlertTriangle, CheckCircle, Clock, Pencil
} from "lucide-react"
import VehiculeUpdateDocs from "@/components/VehiculeUpdateDocs"

/* ── helpers ── */
const fmt     = (n: number) => n.toLocaleString("fr-FR")
const fmtDate = (d: string | null) => {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}

/* ── badge expiration ── */
function ExpirationBadge({ dateStr }: { dateStr: string | null }) {
  if (!dateStr) return <span className="text-gray-400 italic text-xs">Non renseigné</span>

  const today     = new Date(); today.setHours(0,0,0,0)
  const date      = new Date(dateStr)
  const diffDays  = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm font-semibold text-red-600 dark:text-red-400">{fmtDate(dateStr)}</span>
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[10px] font-bold">
        <AlertTriangle size={9} />EXPIRÉ
      </span>
    </div>
  )
  if (diffDays <= 30) return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">{fmtDate(dateStr)}</span>
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 text-[10px] font-bold">
        <Clock size={9} />{diffDays}j
      </span>
    </div>
  )
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm font-semibold text-gray-900 dark:text-white">{fmtDate(dateStr)}</span>
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-[10px] font-bold">
        <CheckCircle size={9} />OK
      </span>
    </div>
  )
}

/* ── info row ── */
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
      <p className="text-[11px] text-gray-500 dark:text-gray-400">{label}</p>
      <div className="text-sm font-semibold text-gray-900 dark:text-white">
        {value ?? <span className="text-gray-400 font-normal italic text-xs">Non renseigné</span>}
      </div>
    </div>
  )
}

/* ═══════════════════════ PAGE ═══════════════════════ */
export default async function VehiculePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const vehiculeId = parseInt(id)

  /* ── données véhicule ── */
  const { data: v } = await supabase
    .from("vehicules")
    .select("*")
    .eq("id_vehicule", vehiculeId)
    .maybeSingle()

  if (!v) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Car size={40} className="text-gray-300 dark:text-gray-700" />
        <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">Véhicule introuvable</p>
        <Link href="/vehicules" className="text-indigo-500 text-sm hover:underline">← Retour à la liste</Link>
      </div>
    )
  }

  /* ── CA depuis vue_dashboard_vehicules ── */
  const { data: stats } = await supabase
    .from("vue_dashboard_vehicules")
    .select("ca_aujourdhui, ca_mensuel, profit")
    .eq("immatriculation", v.immatriculation)
    .maybeSingle()

  /* ── dernières recettes ── */
  const { data: recettes } = await supabase
    .from("vue_recettes_vehicules")
    .select("Horodatage, chauffeur, \"Montant net\"")
    .ilike("immatriculation", v.immatriculation)
    .order("Horodatage", { ascending: false })
    .limit(20)

  /* ── render ── */
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

      {/* ── HEADER ── */}
      <div className="flex items-center gap-3">
        <Link href="/vehicules"
          className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition shadow-sm">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 dark:text-gray-400">Véhicules / Profil</p>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white font-mono">{v.immatriculation}</h1>
        </div>
        <Link href={`/vehicules/${id}/edit`}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition shadow-sm">
          <Pencil size={14} />Modifier
        </Link>
      </div>

      {/* ── HERO ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-500 relative">
          {v.photo && (
            <Image src={v.photo} alt={v.immatriculation} fill className="object-cover opacity-30" />
          )}
        </div>
        <div className="px-5 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-12">

            <div className="flex items-end gap-4">
              <div className="relative w-24 h-20 rounded-2xl border-4 border-white dark:border-gray-900 overflow-hidden bg-gray-100 dark:bg-gray-800 shadow-lg flex-shrink-0">
                {v.photo
                  ? <Image src={v.photo} alt={v.immatriculation} fill className="object-cover" />
                  : <div className="w-full h-full flex items-center justify-center">
                      <Car size={28} className="text-gray-300 dark:text-gray-600" />
                    </div>
                }
              </div>
              <div className="pb-1">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{v.immatriculation}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{v.type_vehicule || "—"}</p>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mt-1
                  ${v.statut === "ACTIF"
                    ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                    : v.statut === "EN MAINTENANCE"
                      ? "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700"
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${v.statut === "ACTIF" ? "bg-emerald-500" : v.statut === "EN MAINTENANCE" ? "bg-orange-500" : "bg-gray-400"}`} />
                  {v.statut}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl self-end sm:self-auto">
              <User size={15} className="text-blue-500" />
              <div>
                <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">Propriétaire</p>
                <p className="text-sm font-bold text-blue-700 dark:text-blue-300">{v.proprietaire || "—"}</p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── KPI ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">

        {[
          { icon: Wallet,    color: "bg-green-100 dark:bg-green-900/20",  ic: "text-green-600 dark:text-green-400",  label: "CA ce mois",    value: fmt(stats?.ca_mensuel   || 0), unit: "FCFA" },
          { icon: TrendingUp, color: "bg-indigo-100 dark:bg-indigo-900/20", ic: "text-indigo-600 dark:text-indigo-400", label: "CA aujourd'hui", value: fmt(stats?.ca_aujourdhui || 0), unit: "FCFA" },
          { icon: Wallet,    color: "bg-purple-100 dark:bg-purple-900/20", ic: "text-purple-600 dark:text-purple-400", label: "Profit mensuel",  value: fmt(stats?.profit       || 0), unit: "FCFA" },
        ].map(({ icon: Icon, color, ic, label, value, unit }, i) => (
          <div key={i} className={`${i === 2 ? "col-span-2 sm:col-span-1" : ""} bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5`}>
            <div className={`inline-flex items-center justify-center w-8 h-8 rounded-xl ${color} mb-3`}>
              <Icon size={15} className={ic} />
            </div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5 break-words">{value}</p>
            <p className="text-xs text-gray-400">{unit}</p>
          </div>
        ))}

      </div>

      {/* ── INFOS GÉNÉRALES ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 pb-3 border-b border-gray-100 dark:border-gray-800">
          Informations générales
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <InfoRow label="Immatriculation" value={v.immatriculation} />
          <InfoRow label="Type de véhicule" value={v.type_vehicule} />
          <InfoRow label="Propriétaire" value={v.proprietaire} />
          <InfoRow label="Statut" value={v.statut} />
          <InfoRow label="Kilométrage actuel" value={v.km_actuel ? `${fmt(v.km_actuel)} km` : null} />
          <InfoRow label="Km dernière vidange" value={v.km_derniere_vidange ? `${fmt(v.km_derniere_vidange)} km` : null} />
        </div>
      </div>

      {/* ── ÉTAT DES DOCUMENTS ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 pb-3 border-b border-gray-100 dark:border-gray-800">
          État des documents
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

          <div className="flex flex-col gap-0.5 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Derniers pneus</p>
            <ExpirationBadge dateStr={v.date_derniers_pneus} />
          </div>

          <div className="flex flex-col gap-0.5 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Assurance</p>
            <ExpirationBadge dateStr={v.date_assurance} />
          </div>

          <div className="flex flex-col gap-0.5 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Expiration assurance</p>
            <ExpirationBadge dateStr={v.date_expiration_assurance} />
          </div>

          <div className="flex flex-col gap-0.5 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Visite technique</p>
            <ExpirationBadge dateStr={v.date_visite_technique} />
          </div>

          <div className="flex flex-col gap-0.5 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Expiration visite technique</p>
            <ExpirationBadge dateStr={v.date_expiration_visite} />
          </div>

        </div>
      </div>

      {/* ── MISE À JOUR DOCUMENTS ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-5">
        <div className="flex items-center gap-2 pb-4 border-b border-gray-100 dark:border-gray-800">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-orange-500">
            <Wrench size={14} className="text-white" />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
            Mettre à jour les documents
          </span>
        </div>

        <VehiculeUpdateDocs
          id={vehiculeId}
          initial={{
            km_actuel:                 v.km_actuel               ?? null,
            km_derniere_vidange:       v.km_derniere_vidange     ?? null,
            date_derniers_pneus:       v.date_derniers_pneus     ?? null,
            date_assurance:            v.date_assurance          ?? null,
            date_expiration_assurance: v.date_expiration_assurance ?? null,
            date_visite_technique:     v.date_visite_technique   ?? null,
            date_expiration_visite:    v.date_expiration_visite  ?? null,
          }}
        />
      </div>

      {/* ── DERNIÈRES RECETTES ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Dernières recettes</p>
          <span className="text-xs text-gray-400">{recettes?.length || 0} transactions</span>
        </div>

        {recettes && recettes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[360px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left py-2.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="text-left py-2.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Chauffeur</th>
                  <th className="text-right py-2.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Montant net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {recettes.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                    <td className="py-2.5 text-gray-700 dark:text-gray-300 text-xs">{fmtDate(r.Horodatage)}</td>
                    <td className="py-2.5 text-gray-600 dark:text-gray-400 text-xs">{r.chauffeur || "—"}</td>
                    <td className="py-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400 text-xs">
                      {fmt(r["Montant net"] || 0)} FCFA
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <Wallet size={32} className="text-gray-200 dark:text-gray-700" />
            <p className="text-sm text-gray-400">Aucune recette enregistrée</p>
          </div>
        )}
      </div>

    </div>
  )
}
