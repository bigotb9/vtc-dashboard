"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, AlertCircle, Plus, Car, FileText,
  Settings, Shield, Tag, CreditCard
} from "lucide-react"
import Link from "next/link"

/* ── enums / options ── */

const STATUTS = [
  { value: "working",     label: "En service" },
  { value: "not_working", label: "Hors service" },
  { value: "repairing",   label: "En réparation" },
  { value: "no_driver",   label: "Sans chauffeur" },
  { value: "pending",     label: "En attente" },
  { value: "unknown",     label: "Inconnu" },
]

const FUEL_TYPES = [
  { value: "petrol",      label: "Essence" },
  { value: "methane",     label: "Méthane (CNG)" },
  { value: "propane",     label: "Propane (LPG)" },
  { value: "electricity", label: "Électrique" },
]

const TRANSMISSIONS = [
  { value: "automatic",   label: "Automatique" },
  { value: "mechanical",  label: "Manuelle" },
  { value: "robotic",     label: "Robotisée" },
  { value: "variator",    label: "Variateur (CVT)" },
]

const OWNERSHIP_TYPES = [
  { value: "park",    label: "Propriété du parc" },
  { value: "leasing", label: "Leasing" },
]

/* ── marques & modèles ── */

/* Russian color names required by Yango API */
const COULEURS = [
  { value: "Белый",     label: "Blanc" },
  { value: "Черный",    label: "Noir" },
  { value: "Серый",     label: "Gris" },
  { value: "Голубой",   label: "Bleu clair" },
  { value: "Синий",     label: "Bleu foncé" },
  { value: "Красный",   label: "Rouge" },
  { value: "Желтый",    label: "Jaune" },
  { value: "Оранжевый", label: "Orange" },
  { value: "Зеленый",   label: "Vert" },
  { value: "Бежевый",   label: "Beige" },
  { value: "Коричневый",label: "Marron" },
  { value: "Фиолетовый",label: "Violet" },
  { value: "Розовый",   label: "Rose" },
]

const CATEGORIES = [
  { value: "econom",          label: "Économique" },
  { value: "comfort",         label: "Confort" },
  { value: "comfort_plus",    label: "Confort+" },
  { value: "business",        label: "Business" },
  { value: "minivan",         label: "Minivan" },
  { value: "vip",             label: "VIP" },
  { value: "wagon",           label: "Break (Wagon)" },
  { value: "pool",            label: "Pool" },
  { value: "start",           label: "Start" },
  { value: "standart",        label: "Standard" },
  { value: "ultimate",        label: "Premier" },
  { value: "maybach",         label: "Elite (Maybach)" },
  { value: "promo",           label: "Promo" },
  { value: "premium_van",     label: "Van Premium" },
  { value: "premium_suv",     label: "SUV Premium" },
  { value: "suv",             label: "SUV" },
  { value: "personal_driver", label: "Chauffeur privé" },
  { value: "express",         label: "Express (Livraison)" },
  { value: "cargo",           label: "Cargo" },
]


/* ── sous-composants ── */
function SectionHeader({ icon: Icon, label, color }: {
  icon: React.ElementType; label: string; color: string
}) {
  return (
    <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100 dark:border-gray-800">
      <span className={`flex items-center justify-center w-7 h-7 rounded-lg ${color}`}>
        <Icon size={14} className="text-white" />
      </span>
      <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
        {label}
      </span>
    </div>
  )
}

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-semibold text-gray-600 dark:text-gray-400">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-gray-400 dark:text-gray-600">{hint}</p>}
    </div>
  )
}

/* ── page ── */
export default function CreateYangoCarPage() {
  const router = useRouter()
  const [loading, setLoading]   = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  /* --- state --- */
  const [form, setForm] = useState({
    // park_profile
    callsign:          "",
    status:            "working",
    fuel_type:         "petrol",
    ownership_type:    "park",
    is_park_property:  true,
    comment:           "",
    // categories (multi)
    categories:        [] as string[],
    // vehicle_licenses
    licence_plate_number:     "",
    licence_number:           "",
    registration_certificate: "",
    // vehicle_specifications
    brand:        "",
    model:        "",
    year:         "",
    color:        "Черный",
    transmission: "automatic",
    vin:          "",
    body_number:  "",
    mileage:      "",
    // leasing_conditions (conditional)
    leasing_company:        "",
    leasing_interest_rate:  "",
    leasing_monthly_payment:"",
    leasing_start_date:     "",
    leasing_term:           "",
    // child_safety
    booster_count: "",
  })

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm(p => ({ ...p, [k]: v }))

  const toggleCategory = (val: string) =>
    setForm(p => ({
      ...p,
      categories: p.categories.includes(val)
        ? p.categories.filter(x => x !== val)
        : [...p.categories, val],
    }))

  const inp = "w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 rounded-xl px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white dark:focus:bg-gray-700"

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    if (!form.licence_plate_number || !form.brand || !form.model || !form.year || !form.callsign) return
    setLoading(true)
    setErrorMsg(null)

    const payload: Record<string, unknown> = {
      park_profile: {
        callsign:        form.callsign,
        status:          form.status,
        fuel_type:       form.fuel_type,
        ownership_type:  form.ownership_type,
        is_park_property: form.is_park_property,
        ...(form.comment.trim() && { comment: form.comment.trim() }),
        ...(form.categories.length  && { categories: form.categories }),
        ...(form.ownership_type === "leasing" && form.leasing_company && {
          leasing_conditions: {
            company:         form.leasing_company,
            interest_rate:   form.leasing_interest_rate,
            monthly_payment: Number(form.leasing_monthly_payment),
            start_date:      form.leasing_start_date,
            term:            Number(form.leasing_term),
          },
        }),
      },
      vehicle_licenses: {
        licence_plate_number: form.licence_plate_number.toUpperCase().trim(),
        ...(form.licence_number           && { licence_number:           form.licence_number }),
        ...(form.registration_certificate && { registration_certificate: form.registration_certificate }),
      },
      vehicle_specifications: {
        brand:        form.brand.trim(),
        model:        form.model.trim(),
        year:         Number(form.year),
        color:        form.color,
        transmission: form.transmission,
        ...(form.vin         && { vin:         form.vin }),
        ...(form.body_number && { body_number: form.body_number }),
        ...(form.mileage     && { mileage:     Number(form.mileage) }),
      },
      ...(form.booster_count && {
        child_safety: { booster_count: Number(form.booster_count) },
      }),
    }

    const res  = await fetch("/api/yango/create-car", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    const data = await res.json()
    setLoading(false)

    if (data.success) router.push("/boyah-transport/vehicules/list")
    else setErrorMsg(data.error)
  }

  const isLeasing = form.ownership_type === "leasing"

  return (
    <div className="min-h-screen pb-28">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* HEADER */}
        <div className="flex items-start gap-4">
          <Link href="/boyah-transport/vehicules/list"
            className="mt-1 flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 hover:text-blue-600 hover:border-blue-300 dark:hover:border-blue-700 transition shadow-sm">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nouveau véhicule Yango</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Création via <span className="font-mono text-blue-500 text-xs bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">fleet.api.yango.com</span>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ══ IDENTIFICATION ══ */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-5">
            <SectionHeader icon={Car} label="Identification & statut" color="bg-blue-600" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <Field label="Immatriculation" required hint="Numéro de plaque d'immatriculation">
                <input type="text" required placeholder="AA-123-BB" className={inp}
                  value={form.licence_plate_number}
                  onChange={e => set("licence_plate_number", e.target.value.toUpperCase())} />
              </Field>

              <Field label="Indicatif (callsign)" required hint="Nom court / code du véhicule dans le parc">
                <input type="text" required placeholder="VTC-01" className={inp}
                  value={form.callsign}
                  onChange={e => set("callsign", e.target.value)} />
              </Field>

              <Field label="Statut" required>
                <select className={inp} value={form.status} onChange={e => set("status", e.target.value)}>
                  {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>

              <Field label="Type de propriété">
                <select className={inp} value={form.ownership_type} onChange={e => set("ownership_type", e.target.value)}>
                  {OWNERSHIP_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>

              <Field label="N° licence taxi">
                <input type="text" placeholder="Numéro de licence taxi" className={inp}
                  value={form.licence_number}
                  onChange={e => set("licence_number", e.target.value)} />
              </Field>

              <Field label="Certificat d'immatriculation">
                <input type="text" placeholder="Numéro du certificat" className={inp}
                  value={form.registration_certificate}
                  onChange={e => set("registration_certificate", e.target.value)} />
              </Field>

            </div>

            {/* toggle propriété du parc */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">Véhicule propriété du parc</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Véhicule en location via le parc</p>
              </div>
              <button type="button" onClick={() => set("is_park_property", !form.is_park_property)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200
                  ${form.is_park_property ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200
                  ${form.is_park_property ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
          </div>

          {/* ══ SPÉCIFICATIONS TECHNIQUES ══ */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-5">
            <SectionHeader icon={Settings} label="Spécifications techniques" color="bg-slate-600" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <Field label="Marque" required>
                <input type="text" required placeholder="Ex: Toyota, Mercedes-Benz..." className={inp}
                  value={form.brand} onChange={e => set("brand", e.target.value)} />
              </Field>

              <Field label="Modèle" required>
                <input type="text" required placeholder="Ex: Camry, E-Class, Creta..." className={inp}
                  value={form.model} onChange={e => set("model", e.target.value)} />
              </Field>

              <Field label="Année de fabrication" required>
                <input type="number" required min={1990} max={new Date().getFullYear() + 1}
                  placeholder={String(new Date().getFullYear())} className={inp}
                  value={form.year} onChange={e => set("year", e.target.value)} />
              </Field>

              <Field label="Couleur" required>
                <select className={inp} value={form.color} onChange={e => set("color", e.target.value)}>
                  {COULEURS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </Field>

              <Field label="Transmission" required>
                <select className={inp} value={form.transmission} onChange={e => set("transmission", e.target.value)}>
                  {TRANSMISSIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>

              <Field label="Carburant" required>
                <select className={inp} value={form.fuel_type} onChange={e => set("fuel_type", e.target.value)}>
                  {FUEL_TYPES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </Field>

              <Field label="Kilométrage" hint="En km">
                <input type="number" min={0} placeholder="0" className={inp}
                  value={form.mileage} onChange={e => set("mileage", e.target.value)} />
              </Field>

              <Field label="Numéro VIN">
                <input type="text" placeholder="17 caractères" className={inp}
                  value={form.vin} onChange={e => set("vin", e.target.value.toUpperCase())} />
              </Field>

              <Field label="Numéro de carrosserie" hint="Du certificat d'immatriculation">
                <input type="text" placeholder="Body number" className={inp}
                  value={form.body_number} onChange={e => set("body_number", e.target.value)} />
              </Field>

            </div>
          </div>

          {/* ══ CATÉGORIES ══ */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-5">
            <SectionHeader icon={Tag} label="Catégories de service" color="bg-indigo-500" />
            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
              Sélectionnez les catégories Yango pour ce véhicule
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map(cat => {
                const active = form.categories.includes(cat.value)
                return (
                  <button key={cat.value} type="button"
                    onClick={() => toggleCategory(cat.value)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium text-left transition border
                      ${active
                        ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300"
                        : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-indigo-300 dark:hover:border-indigo-700"
                      }`}>
                    {active && <span className="mr-1">✓</span>}{cat.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ══ LEASING (conditionnel) ══ */}
          {isLeasing && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-5">
              <SectionHeader icon={CreditCard} label="Conditions de leasing" color="bg-amber-500" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                <Field label="Société de leasing" required>
                  <input type="text" placeholder="Nom de la société" className={inp}
                    value={form.leasing_company} onChange={e => set("leasing_company", e.target.value)} />
                </Field>

                <Field label="Taux d'intérêt" hint="Ex: 11.7">
                  <input type="text" placeholder="11.7" className={inp}
                    value={form.leasing_interest_rate} onChange={e => set("leasing_interest_rate", e.target.value)} />
                </Field>

                <Field label="Mensualité" hint="En devise locale">
                  <input type="number" min={0} placeholder="0" className={inp}
                    value={form.leasing_monthly_payment} onChange={e => set("leasing_monthly_payment", e.target.value)} />
                </Field>

                <Field label="Durée du leasing" hint="En mois">
                  <input type="number" min={1} placeholder="36" className={inp}
                    value={form.leasing_term} onChange={e => set("leasing_term", e.target.value)} />
                </Field>

                <Field label="Date de début">
                  <input type="date" className={inp}
                    value={form.leasing_start_date} onChange={e => set("leasing_start_date", e.target.value)} />
                </Field>

              </div>
            </div>
          )}

          {/* ══ SÉCURITÉ ENFANTS ══ */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-5">
            <SectionHeader icon={Shield} label="Sécurité enfants" color="bg-pink-500" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nombre de réhausseurs" hint="0 à 3 réhausseurs enfants">
                <input type="number" min={0} max={3} placeholder="0" className={inp}
                  value={form.booster_count} onChange={e => set("booster_count", e.target.value)} />
              </Field>
            </div>
          </div>

          {/* ══ COMMENTAIRE ══ */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-5">
            <SectionHeader icon={FileText} label="Commentaire" color="bg-gray-500" />
            <textarea rows={3} placeholder="Description ou notes sur le véhicule (optionnel)..."
              className={`${inp} resize-none`}
              value={form.comment} onChange={e => set("comment", e.target.value)} />
          </div>

          {/* RÉSUMÉ */}
          {form.brand && form.model && form.licence_plate_number && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <Car size={16} className="text-gray-400 flex-shrink-0" />
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-semibold text-gray-900 dark:text-white">{form.brand} {form.model}</span>
                {form.year && <> — {form.year}</>}
                {" · "}
                <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">
                  {form.licence_plate_number}
                </span>
                {form.categories.length > 0 && (
                  <span className="ml-2 text-xs text-indigo-600 dark:text-indigo-400">
                    {form.categories.length} catégorie{form.categories.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ERREUR */}
          {errorMsg && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              <AlertCircle size={18} className="flex-shrink-0" />
              <div>
                <p className="font-semibold">Erreur lors de la création</p>
                <p className="text-xs opacity-75 mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* ACTIONS DESKTOP */}
          <div className="hidden sm:flex items-center justify-between pt-2">
            <Link href="/boyah-transport/vehicules/list">
              <button type="button" className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition shadow-sm">
                Annuler
              </button>
            </Link>
            <button type="submit" disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition shadow-sm flex items-center gap-2">
              {loading
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Création en cours...</>
                : <><Plus size={15} />Créer le véhicule sur Yango</>
              }
            </button>
          </div>

        </form>
      </div>

      {/* STICKY MOBILE */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-4 py-3 flex gap-3 shadow-2xl">
        <Link href="/boyah-transport/vehicules/list" className="flex-1">
          <button type="button" className="w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium">
            Annuler
          </button>
        </Link>
        <button disabled={loading} onClick={handleSubmit}
          className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2">
          {loading
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <><Plus size={14} />Créer</>
          }
        </button>
      </div>
    </div>
  )
}
