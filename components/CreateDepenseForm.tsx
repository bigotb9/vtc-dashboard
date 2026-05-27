"use client"
import { authFetch } from "@/lib/authFetch"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, AlertCircle, Plus,
  Banknote, Car, FileText, AlertTriangle
} from "lucide-react"
import Link from "next/link"
import { toast } from "@/lib/toast"

/* -- types -- */
type Vehicule = {
  id_vehicule: number
  immatriculation: string
  proprietaire: string | null
}

type Props = {
  vehicules: Vehicule[]
}

/* -- types de depense predefinis -- */
const TYPES_DEPENSE = [
  "Carburant",
  "Vidange",
  "Reparation",
  "Assurance",
  "Visite technique",
  "Pneus",
  "Lavage",
  "Parking",
  "Amende",
  "Autre",
]

/* -- sous-composants -- */
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

function Field({ label, required, children, error }: {
  label: string; required?: boolean; children: React.ReactNode
  /** Lot R (audit 27/05/2026) : message d'erreur affiche sous le champ */
  error?: string | null
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-semibold text-gray-600 dark:text-gray-400">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-[11px] font-medium text-red-600 dark:text-red-400 flex items-center gap-1" role="alert">
          <AlertCircle size={11} className="flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

/* -- page -- */
type FormState = {
  date_depense:              string
  montant:                   string
  type_depense:              string
  type_custom:               string
  description:               string
  id_vehicule:               string
  immobilisation:            boolean
  date_debut_immobilisation: string
  date_fin_immobilisation:   string
}

type FieldErrors = Partial<Record<keyof FormState, string | null>>

// Lot R (audit 27/05/2026) : validation client centralisee.
// Regles metier (cf. finding 6.5 + spec Lot R) :
//   - montant requis et > 0
//   - date_depense requise et <= aujourd'hui
//   - type_depense (ou type_custom si typeCustom) requis et non vide
//   - si immobilisation : date_debut >= date_depense, date_fin >= date_debut
function validateDepenseField(
  field: keyof FormState,
  form: FormState,
  typeCustom: boolean,
): string | null {
  const todayIso = new Date().toISOString().slice(0, 10)

  switch (field) {
    case "date_depense": {
      if (!form.date_depense) return "Date requise"
      if (form.date_depense > todayIso) return "La date ne peut pas être dans le futur"
      return null
    }
    case "montant": {
      if (form.montant === "") return "Montant requis"
      const n = Number(form.montant)
      if (!Number.isFinite(n) || n <= 0) return "Montant doit être > 0"
      return null
    }
    case "type_depense": {
      const finalType = typeCustom ? form.type_custom.trim() : form.type_depense
      if (!finalType) return typeCustom ? "Précise le type personnalisé" : "Sélectionne un type"
      // L'API rejette les libellés contenant "reversement"
      if (finalType.toLowerCase().includes("reversement")) {
        return "Les reversements clients se saisissent dans le module Clients"
      }
      return null
    }
    case "type_custom": {
      // Mirror de type_depense quand typeCustom=true
      if (typeCustom && !form.type_custom.trim()) return "Précise le type personnalisé"
      if (typeCustom && form.type_custom.toLowerCase().includes("reversement")) {
        return "Les reversements clients se saisissent dans le module Clients"
      }
      return null
    }
    case "date_debut_immobilisation": {
      if (!form.immobilisation) return null
      if (!form.date_debut_immobilisation) return null   // optionnel meme si immo
      if (form.date_depense && form.date_debut_immobilisation < form.date_depense) {
        return "Doit être après la date de la dépense"
      }
      return null
    }
    case "date_fin_immobilisation": {
      if (!form.immobilisation) return null
      if (!form.date_fin_immobilisation) return null
      if (form.date_debut_immobilisation && form.date_fin_immobilisation < form.date_debut_immobilisation) {
        return "Doit être après le début d'immobilisation"
      }
      return null
    }
    default:
      return null
  }
}

function validateDepenseAll(form: FormState, typeCustom: boolean): FieldErrors {
  const errors: FieldErrors = {}
  const fields: (keyof FormState)[] = [
    "date_depense", "montant", "type_depense", "type_custom",
    "date_debut_immobilisation", "date_fin_immobilisation",
  ]
  for (const f of fields) {
    const err = validateDepenseField(f, form, typeCustom)
    if (err) errors[f] = err
  }
  return errors
}

export default function CreateDepenseForm({ vehicules }: Props) {

  const router = useRouter()
  const [loading, setLoading]   = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [typeCustom, setTypeCustom] = useState(false)

  const [form, setForm] = useState<FormState>({
    date_depense:            "",
    montant:                 "",
    type_depense:            "",
    type_custom:             "",
    description:             "",
    id_vehicule:             "",
    immobilisation:          false,
    date_debut_immobilisation: "",
    date_fin_immobilisation:   "",
  })

  // Lot R : validation client par champ avec feedback onBlur.
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const set = (k: keyof FormState, v: string | boolean) =>
    setForm(p => ({ ...p, [k]: v }))

  const handleBlur = (field: keyof FormState) => {
    const err = validateDepenseField(field, form, typeCustom)
    setFieldErrors(prev => ({ ...prev, [field]: err }))
  }

  /** Bouton submit désactivé tant qu'un champ requis est vide ou en erreur. */
  const submitDisabled = useMemo(() => {
    if (loading) return true
    if (!form.date_depense || !form.montant) return true
    const finalType = typeCustom ? form.type_custom.trim() : form.type_depense
    if (!finalType) return true
    // Toute erreur déjà signalée bloque aussi
    return Object.values(fieldErrors).some(e => e !== null && e !== undefined && e !== "")
  }, [loading, form, typeCustom, fieldErrors])

  const inp = "w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 rounded-xl px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent focus:bg-white"

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    // Lot R : re-validation finale avant l'appel API (cas où le user clique
    // sans avoir blur tous les champs, ex: submit clavier).
    const finalErrors = validateDepenseAll(form, typeCustom)
    if (Object.keys(finalErrors).length > 0) {
      setFieldErrors(finalErrors)
      toast.error("Corrige les champs en rouge avant d'enregistrer")
      return
    }
    setLoading(true)
    setErrorMsg(null)

    const finalType = typeCustom ? form.type_custom.trim() : form.type_depense

    const payload: Record<string, unknown> = {
      date_depense:  form.date_depense,
      montant:       Number(form.montant),
      type_depense:  finalType  || null,
      description:   form.description.trim() || null,
      id_vehicule:   form.id_vehicule !== "" ? Number(form.id_vehicule) : null,
      immobilisation: form.immobilisation,
      date_debut_immobilisation: form.immobilisation && form.date_debut_immobilisation ? form.date_debut_immobilisation : null,
      date_fin_immobilisation:   form.immobilisation && form.date_fin_immobilisation   ? form.date_fin_immobilisation   : null,
    }

    const res  = await authFetch("/api/depenses/create", { method: "POST", body: JSON.stringify(payload) })
    const data = await res.json()
    setLoading(false)

    if (data.success) {
      toast.success("Depense enregistree avec succes")
      router.push("/depenses")
    } else {
      toast.error(data.error || "Erreur lors de l'enregistrement")
      setErrorMsg(data.error)
    }
  }

  /* -- render -- */
  return (
    <div className="min-h-screen pb-28">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* HEADER */}
        <div className="flex items-start gap-4">
          <Link href="/depenses"
            className="mt-1 flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 hover:text-red-600 hover:border-red-300 dark:hover:border-red-700 transition shadow-sm">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nouvelle depense</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Table <span className="font-mono text-red-500 text-xs bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded">depenses_vehicules</span>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* -- DEPENSE -- */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-5">
            <SectionHeader icon={Banknote} label="Details de la depense" color="bg-red-500" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <Field label="Date de la depense" required error={fieldErrors.date_depense}>
                <input type="date" required className={inp}
                  max={new Date().toISOString().slice(0, 10)}
                  value={form.date_depense}
                  onChange={e => set("date_depense", e.target.value)}
                  onBlur={() => handleBlur("date_depense")} />
              </Field>

              <Field label="Montant (FCFA)" required error={fieldErrors.montant}>
                <input type="number" required min={1} step="any" placeholder="0" className={inp}
                  value={form.montant}
                  onChange={e => set("montant", e.target.value)}
                  onBlur={() => handleBlur("montant")} />
              </Field>

              <Field label="Type de depense" required error={fieldErrors.type_depense}>
                <select className={inp}
                  value={typeCustom ? "Autre" : form.type_depense}
                  onBlur={() => handleBlur("type_depense")}
                  onChange={e => {
                    if (e.target.value === "Autre") {
                      setTypeCustom(true)
                      set("type_depense", "Autre")
                    } else {
                      setTypeCustom(false)
                      set("type_depense", e.target.value)
                    }
                    // Reset des erreurs liées au type (typeCustom switche)
                    setFieldErrors(prev => ({ ...prev, type_depense: null, type_custom: null }))
                  }}>
                  <option value="">- Selectionner -</option>
                  {TYPES_DEPENSE.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>

              {typeCustom && (
                <Field label="Preciser le type" required error={fieldErrors.type_custom}>
                  <input type="text" placeholder="Type personnalise..." className={inp}
                    value={form.type_custom}
                    onChange={e => set("type_custom", e.target.value)}
                    onBlur={() => handleBlur("type_custom")} />
                  {/* L4 patch 18/05/2026 - hint pour rediriger les reversements clients. */}
                  {/* L'API refusera tout type contenant 'reversement' ; on l'indique en amont pour eviter la friction. */}
                  {form.type_custom.toLowerCase().includes("reversement") && (
                    <p className="mt-1.5 text-[12px] text-orange-700 dark:text-orange-300">
                      Les reversements clients ne se saisissent pas ici. Utilisez le module{" "}
                      <Link href="/clients" className="font-semibold underline">Clients</Link>.
                    </p>
                  )}
                </Field>
              )}

            </div>

            <Field label="Description">
              <textarea rows={3} placeholder="Details de la depense (optionnel)..."
                className={`${inp} resize-none`}
                value={form.description} onChange={e => set("description", e.target.value)} />
            </Field>
          </div>

          {/* -- VEHICULE -- */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-500">
                  <Car size={14} className="text-white" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                  Vehicule concerne
                </span>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                Optionnel
              </span>
            </div>

            <Field label="Selectionner un vehicule">
              <select className={inp} value={form.id_vehicule}
                onChange={e => set("id_vehicule", e.target.value)}>
                <option value="">- Depense generale (sans vehicule) -</option>
                {vehicules.map(v => (
                  <option key={v.id_vehicule} value={v.id_vehicule}>
                    {v.immatriculation}{v.proprietaire ? ` - ${v.proprietaire}` : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* -- IMMOBILISATION -- */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-5">
            <SectionHeader icon={AlertTriangle} label="Immobilisation" color="bg-orange-500" />

            {/* toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">
                  Vehicule immobilise
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Le vehicule est hors service pendant cette periode
                </p>
              </div>
              <button type="button" onClick={() => set("immobilisation", !form.immobilisation)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200
                  ${form.immobilisation ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200
                  ${form.immobilisation ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>

            {/* dates conditionnelles */}
            {form.immobilisation && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-200">
                <Field label="Debut immobilisation" error={fieldErrors.date_debut_immobilisation}>
                  <input type="date" className={inp}
                    value={form.date_debut_immobilisation}
                    onChange={e => set("date_debut_immobilisation", e.target.value)}
                    onBlur={() => handleBlur("date_debut_immobilisation")} />
                </Field>
                <Field label="Fin immobilisation" error={fieldErrors.date_fin_immobilisation}>
                  <input type="date" className={inp}
                    value={form.date_fin_immobilisation}
                    onChange={e => set("date_fin_immobilisation", e.target.value)}
                    onBlur={() => handleBlur("date_fin_immobilisation")} />
                </Field>
                <div className="sm:col-span-2">
                  <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl text-xs text-orange-700 dark:text-orange-400">
                    <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                    <span>Le vehicule sera marque comme indisponible sur cette periode dans les statistiques.</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RESUME */}
          {form.montant && form.date_depense && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <FileText size={16} className="text-gray-400 flex-shrink-0" />
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-semibold text-gray-900 dark:text-white">
                  {Number(form.montant).toLocaleString("fr-FR")} FCFA
                </span>
                {" "}- {typeCustom ? form.type_custom || "Autre" : form.type_depense || "Type non defini"}
                {" "}le{" "}
                {new Date(form.date_depense).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                {form.id_vehicule && vehicules.find(v => v.id_vehicule === Number(form.id_vehicule)) && (
                  <> - Vehicule <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    {vehicules.find(v => v.id_vehicule === Number(form.id_vehicule))?.immatriculation}
                  </span></>
                )}
              </div>
            </div>
          )}

          {/* ERREUR */}
          {errorMsg && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              <AlertCircle size={18} className="flex-shrink-0" />
              <div>
                <p className="font-semibold">Erreur lors de l&apos;enregistrement</p>
                <p className="text-xs opacity-75 mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* ACTIONS DESKTOP */}
          <div className="hidden sm:flex items-center justify-between pt-2">
            <Link href="/depenses">
              <button type="button" className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition shadow-sm">
                Annuler
              </button>
            </Link>
            <button type="submit" disabled={submitDisabled}
              className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition shadow-sm flex items-center gap-2">
              {loading
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Enregistrement...</>
                : <><Plus size={15} />Enregistrer la depense</>
              }
            </button>
          </div>

        </form>
      </div>

      {/* STICKY MOBILE */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-4 py-3 flex gap-3 shadow-2xl">
        <Link href="/depenses" className="flex-1">
          <button type="button" className="w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium">
            Annuler
          </button>
        </Link>
        <button disabled={submitDisabled} onClick={handleSubmit}
          className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center justify-center gap-2">
          {loading
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <><Plus size={14} />Enregistrer</>
          }
        </button>
      </div>
    </div>
  )
}
