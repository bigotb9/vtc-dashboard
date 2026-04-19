export const dynamic = 'force-dynamic'

import { supabase } from "@/lib/supabaseClient"
import Link from "next/link"
import Image from "next/image"
import {
  ArrowLeft, Phone, MessageSquare, TrendingUp,
  Wallet, Trophy, Calendar, Home, Users,
  CreditCard, ShieldCheck, FileText, ZoomIn, Pencil
} from "lucide-react"
import AffectationWidget from "@/components/AffectationWidget"
import Breadcrumbs from "@/components/Breadcrumbs"
import ExportFicheButton from "@/components/ExportFicheButton"

/* ── helpers ── */
const fmt     = (n: number)  => n.toLocaleString("fr-FR")
const fmtDate = (d: string)  => {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}

/* ── sous-composants ── */

function InfoRow({ icon: Icon, label, value, color }: {
  icon: React.ElementType
  label: string
  value: string | number | null | undefined
  color: string
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
      <span className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg ${color}`}>
        <Icon size={14} className="text-white" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
          {value || <span className="text-gray-400 font-normal italic text-xs">Non renseigné</span>}
        </p>
      </div>
    </div>
  )
}

function PermisPhoto({ src, label }: { src: string | null | undefined; label: string }) {
  if (!src) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[12px] font-semibold text-gray-600 dark:text-gray-400">{label}</p>
        <div className="w-full h-36 rounded-xl bg-gray-100 dark:bg-gray-800 border border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center gap-1">
          <FileText size={20} className="text-gray-300 dark:text-gray-600" />
          <span className="text-[11px] text-gray-400">Non fourni</span>
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[12px] font-semibold text-gray-600 dark:text-gray-400">{label}</p>
      <a href={src} target="_blank" rel="noopener noreferrer" className="group relative block">
        <div className="relative w-full h-36 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <Image src={src} alt={label} fill className="object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
            <ZoomIn size={20} className="text-white opacity-0 group-hover:opacity-100 transition" />
          </div>
        </div>
      </a>
    </div>
  )
}

/* ═══════════════════════════════════
   PAGE
═══════════════════════════════════ */

export default async function ChauffeurPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  /* ── données chauffeur ── */
  const { data: chauffeur } = await supabase
    .from("chauffeurs")
    .select("*")
    .eq("id_chauffeur", id)
    .single()

  if (!chauffeur) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">Chauffeur introuvable</p>
        <Link href="/chauffeurs" className="text-indigo-500 text-sm hover:underline">← Retour à la liste</Link>
      </div>
    )
  }

  /* ── CA classement ── */
  const { data: classement } = await supabase
    .from("classement_chauffeurs")
    .select("*")
    .eq("nom", chauffeur.nom)
    .single()

  /* ── recettes via vue_recettes_vehicules (colonne "chauffeur" déjà réconciliée) ── */
  const { data: recettesRaw } = await supabase
    .from("vue_recettes_vehicules")
    .select("*")
    .ilike("chauffeur", `%${chauffeur.nom}%`)
    .order("Horodatage", { ascending: false })
    .limit(50)

  /* ── CA mensuel calculé depuis la même vue ── */
  const now = new Date()
  const caMensuel = (recettesRaw || [])
    .filter(r => {
      if (!r.Horodatage) return false
      const d = new Date(r.Horodatage)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    .reduce((sum: number, r) => sum + (Number(r["Montant net"]) || 0), 0)

  /* ── classement global ── */
  const { data: tousClassements } = await supabase
    .from("classement_chauffeurs")
    .select("nom, ca")
    .order("ca", { ascending: false })

  const rang            = (tousClassements || []).findIndex(c => c.nom === chauffeur.nom) + 1
  const totalChauffeurs = tousClassements?.length || 0

  /* ─────────── RENDER ─────────── */
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

      <Breadcrumbs entityName={chauffeur.nom} />

      {/* ── HEADER ── */}
      <div className="flex items-center gap-3">
        <Link href="/chauffeurs"
          className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition shadow-sm">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 dark:text-gray-400">Chauffeurs / Profil</p>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{chauffeur.nom}</h1>
        </div>
        <ExportFicheButton type="chauffeur" opts={{
          nom:         chauffeur.nom,
          numeroWave:  chauffeur.numero_wave  || undefined,
          numeroPermis: chauffeur.numero_permis || undefined,
          numeroCni:   chauffeur.numero_cni    || undefined,
          domicile:    chauffeur.domicile      || undefined,
          garant:      chauffeur.numero_garant || undefined,
          caTotal:     classement?.ca || 0,
          caMensuel,
          transactions: recettesRaw?.length || 0,
          rang,
          totalChauffeurs,
          actif:       chauffeur.actif,
          recettes:    (recettesRaw || []).map(r => ({
            date:       fmtDate(r.Horodatage),
            montantNet:  r["Montant net"]  || 0,
            montantBrut: r["Montant brut"] || 0,
          })),
        }} />
        <Link href={`/chauffeurs/${id}/edit`}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition shadow-sm">
          <Pencil size={14} />Modifier
        </Link>
      </div>

      {/* ── HERO ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500" />
        <div className="px-5 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 -mt-12">

            <div className="flex items-end gap-4">
              <div className="relative w-24 h-24 rounded-2xl border-4 border-white dark:border-gray-900 overflow-hidden bg-gray-100 dark:bg-gray-800 shadow-lg flex-shrink-0">
                {chauffeur.photo ? (
                  <Image src={chauffeur.photo} alt={chauffeur.nom} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-indigo-300 dark:text-indigo-700">
                    {chauffeur.nom?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                )}
              </div>
              <div className="pb-1">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{chauffeur.nom}</h2>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mt-1
                  ${chauffeur.actif
                    ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700"
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${chauffeur.actif ? "bg-emerald-500" : "bg-gray-400"}`} />
                  {chauffeur.actif ? "Actif" : "Inactif"}
                </span>
              </div>
            </div>

            {rang > 0 && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl self-end sm:self-auto">
                <Trophy size={16} className="text-amber-500" />
                <div>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Classement</p>
                  <p className="text-lg font-bold text-amber-700 dark:text-amber-300 leading-none">
                    {rang}<span className="text-xs font-normal ml-0.5">/{totalChauffeurs}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">

        {[
          { icon: Wallet,    color: "bg-emerald-100 dark:bg-emerald-900/20", iconColor: "text-emerald-600 dark:text-emerald-400", label: "CA Total",    value: fmt(classement?.ca || 0), unit: "FCFA" },
          { icon: TrendingUp, color: "bg-indigo-100 dark:bg-indigo-900/20",  iconColor: "text-indigo-600 dark:text-indigo-400",  label: "CA ce mois", value: fmt(caMensuel),             unit: "FCFA" },
          { icon: Calendar,  color: "bg-purple-100 dark:bg-purple-900/20",   iconColor: "text-purple-600 dark:text-purple-400",  label: "Versements", value: recettesRaw?.length || 0,   unit: "transactions" },
        ].map(({ icon: Icon, color, iconColor, label, value, unit }) => (
          <div key={label} className={`${label === "Versements" ? "col-span-2 sm:col-span-1" : ""} bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5`}>
            <div className={`inline-flex items-center justify-center w-8 h-8 rounded-xl ${color} mb-3`}>
              <Icon size={15} className={iconColor} />
            </div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
            <p className="text-xl font-bold font-numeric text-gray-900 dark:text-white mt-0.5 break-words">{value}</p>
            <p className="text-xs text-gray-400">{unit}</p>
          </div>
        ))}

      </div>

      {/* ── AFFECTATION VÉHICULE ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
        <AffectationWidget mode="chauffeur" id={Number(id)} />
      </div>

      {/* ── INFOS GÉNÉRALES ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 pb-3 border-b border-gray-100 dark:border-gray-800">
          Informations générales
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InfoRow icon={Phone}       color="bg-blue-500"    label="Numéro Wave"    value={chauffeur.numero_wave} />
          <InfoRow icon={Home}        color="bg-teal-500"    label="Domicile"       value={chauffeur.domicile} />
          <InfoRow icon={ShieldCheck} color="bg-orange-500"  label="Garant"         value={chauffeur.numero_garant} />
          <InfoRow icon={MessageSquare} color="bg-purple-500" label="Commentaire"  value={chauffeur.commentaire} />
        </div>
      </div>

      {/* ── SITUATION PERSONNELLE ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 pb-3 border-b border-gray-100 dark:border-gray-800">
          Situation personnelle
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InfoRow icon={Users}    color="bg-pink-500"    label="Situation matrimoniale" value={chauffeur.situation_matrimoniale} />
          <InfoRow icon={Users}    color="bg-violet-500"  label="Nombre d'enfants"       value={chauffeur.nombre_enfants?.toString()} />
        </div>
      </div>

      {/* ── DOCUMENTS D'IDENTITÉ ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 pb-3 border-b border-gray-100 dark:border-gray-800">
          Documents d&apos;identité
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InfoRow icon={CreditCard} color="bg-amber-500"  label="Numéro de permis" value={chauffeur.numero_permis} />
          <InfoRow icon={CreditCard} color="bg-rose-500"   label="Numéro de CNI"    value={chauffeur.numero_cni} />
        </div>

        {/* photos permis */}
        <div className="grid grid-cols-2 gap-4 mt-2">
          <PermisPhoto src={chauffeur.photo_permis_recto} label="Permis — Recto" />
          <PermisPhoto src={chauffeur.photo_permis_verso} label="Permis — Verso" />
        </div>
      </div>

      {/* ── HISTORIQUE RECETTES ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Dernières recettes</p>
          <span className="text-xs text-gray-400">{recettesRaw?.length || 0} transactions</span>
        </div>

        {recettesRaw && recettesRaw.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[360px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left py-2.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="text-right py-2.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Montant net</th>
                  <th className="text-right py-2.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Montant brut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {recettesRaw.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                    <td className="py-2.5 text-gray-700 dark:text-gray-300 text-xs">{fmtDate(r.Horodatage)}</td>
                    <td className="py-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400 text-xs">{fmt(r["Montant net"] || 0)} FCFA</td>
                    <td className="py-2.5 text-right text-gray-500 dark:text-gray-400 text-xs">{fmt(r["Montant brut"] || 0)} FCFA</td>
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
