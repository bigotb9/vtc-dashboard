"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, AlertCircle, Plus, User, FileText, Car, Briefcase } from "lucide-react"
import Link from "next/link"

type VehicleItem = {
  id?: string; number?: string; brand?: string; model?: string
  car?: { id?: string; number?: string; brand?: string; model?: string }
}
type WorkRuleItem = {
  id?: string; name?: string
  rule?: { id?: string; name?: string }
}

function SectionHeader({ icon: Icon, label, color }: { icon: React.ElementType; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100 dark:border-gray-800">
      <span className={`flex items-center justify-center w-7 h-7 rounded-lg ${color}`}>
        <Icon size={14} className="text-white" />
      </span>
      <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">{label}</span>
    </div>
  )
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
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

export default function CreateDriverPage() {
  const router = useRouter()
  const [loading, setLoading]   = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [vehicles, setVehicles] = useState<VehicleItem[]>([])
  const [workRules, setWorkRules] = useState<WorkRuleItem[]>([])
  const [search, setSearch]     = useState("")
  const [showDropdown, setShowDropdown] = useState(false)

  const [form, setForm] = useState({
    first_name: "", last_name: "", phone: "",
    license_number: "", issue_date: "", expiry_date: "",
    experience_date: "", hire_date: "",
    car_id: "", work_rule_id: "",
  })

  const getCar  = (item: VehicleItem)  => item?.car  || item
  const getRule = (item: WorkRuleItem) => item?.rule || item

  useEffect(() => {
    fetch("/api/yango/vehicles").then(r => r.json()).then(d => {
      setVehicles(d?.cars || d?.vehicles || d?.items || [])
    })
    fetch("/api/yango/work-rules").then(r => r.json()).then(d => {
      setWorkRules(Array.isArray(d) ? d : d?.rules || d?.work_rules || d?.items || [])
    })
  }, [])

  const filteredVehicles = vehicles.filter(item =>
    (getCar(item)?.number || "").toLowerCase().includes(search.toLowerCase())
  )

  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSelectVehicle = (item: VehicleItem) => {
    const car = getCar(item)
    setForm(p => ({ ...p, car_id: car.id ?? "" }))
    setSearch(car.number ?? "")
    setShowDropdown(false)
  }

  const handleSubmit = async (e?: { preventDefault?(): void }) => {
    e?.preventDefault?.()
    if (!form.first_name || !form.last_name || !form.phone) {
      setErrorMsg("Prénom, nom et téléphone sont obligatoires.")
      return
    }
    setLoading(true)
    setErrorMsg(null)

    const payload: Record<string, unknown> = {
      driver_profile: {
        first_name: form.first_name.trim(),
        last_name:  form.last_name.trim(),
        phones:     [form.phone.trim()],
        ...(form.license_number && {
          driver_license: {
            number:               form.license_number.trim(),
            country:              "CI",
            ...(form.issue_date      && { issue_date:            form.issue_date }),
            ...(form.expiry_date     && { expiry_date:           form.expiry_date }),
            ...(form.experience_date && { experience_since_date: form.experience_date }),
          },
        }),
      },
      // account est requis par l'API Yango même vide
      account: {
        ...(form.work_rule_id && { work_rule_id: form.work_rule_id }),
      },
      ...(form.hire_date && { hire_date: form.hire_date }),
      ...(form.car_id    && { car_id:    form.car_id }),
    }

    const res  = await fetch("/api/yango/create-driver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    setLoading(false)

    if (data.success) router.push("/boyah-transport/prestataires/list")
    else setErrorMsg(data.error || "Erreur inconnue")
  }

  const inp = "w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 rounded-xl px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white dark:focus:bg-gray-700"

  return (
    <div className="min-h-screen pb-28">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* HEADER */}
        <div className="flex items-start gap-4">
          <Link href="/boyah-transport/prestataires/list"
            className="mt-1 flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 hover:text-blue-600 hover:border-blue-300 transition shadow-sm">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nouveau prestataire</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Création via <span className="font-mono text-blue-500 text-xs bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">fleet.api.yango.com</span>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* INFOS PERSONNELLES */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-5">
            <SectionHeader icon={User} label="Informations personnelles" color="bg-blue-600" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Prénom" required>
                <input type="text" required placeholder="Prénom" className={inp}
                  value={form.first_name} onChange={e => set("first_name", e.target.value)} />
              </Field>
              <Field label="Nom" required>
                <input type="text" required placeholder="Nom de famille" className={inp}
                  value={form.last_name} onChange={e => set("last_name", e.target.value)} />
              </Field>
              <Field label="Téléphone" required hint="Format international : +225...">
                <input type="tel" required placeholder="+22507XXXXXXXX" className={inp}
                  value={form.phone} onChange={e => set("phone", e.target.value)} />
              </Field>
            </div>
          </div>

          {/* PERMIS */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-5">
            <SectionHeader icon={FileText} label="Permis de conduire" color="bg-violet-600" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Numéro de permis">
                <input type="text" placeholder="Numéro" className={inp}
                  value={form.license_number} onChange={e => set("license_number", e.target.value)} />
              </Field>
              <Field label="Pays de délivrance">
                <input type="text" value="Côte d'Ivoire" disabled
                  className={`${inp} opacity-60 cursor-not-allowed`} />
              </Field>
              <Field label="Délivré le">
                <input type="date" className={inp}
                  value={form.issue_date} onChange={e => set("issue_date", e.target.value)} />
              </Field>
              <Field label="Expire le">
                <input type="date" className={inp}
                  value={form.expiry_date} onChange={e => set("expiry_date", e.target.value)} />
              </Field>
              <Field label="Expérience de conduite depuis">
                <input type="date" className={inp}
                  value={form.experience_date} onChange={e => set("experience_date", e.target.value)} />
              </Field>
            </div>
          </div>

          {/* CONDITIONS DE TRAVAIL */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-5">
            <SectionHeader icon={Briefcase} label="Conditions de travail" color="bg-amber-500" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Règle de travail">
                <select className={inp} value={form.work_rule_id} onChange={e => set("work_rule_id", e.target.value)}>
                  <option value="">Choisir une règle</option>
                  {workRules.map((wr, i) => {
                    const rule = getRule(wr)
                    if (!rule?.id) return null
                    return <option key={i} value={rule.id}>{rule.name}</option>
                  })}
                </select>
              </Field>
              <Field label="Date d'embauche">
                <input type="date" className={inp}
                  value={form.hire_date} onChange={e => set("hire_date", e.target.value)} />
              </Field>
            </div>
          </div>

          {/* VÉHICULE */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-5">
            <SectionHeader icon={Car} label="Véhicule associé" color="bg-slate-600" />
            <div className="relative">
              <Field label="Rechercher par immatriculation">
                <input type="text" placeholder="Ex: AA-123-BB" className={inp}
                  value={search}
                  onChange={e => { setSearch(e.target.value); setShowDropdown(true) }}
                  onFocus={() => setShowDropdown(true)}
                />
              </Field>
              {showDropdown && filteredVehicles.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {filteredVehicles.map((item, i) => {
                    const car = getCar(item)
                    if (!car?.number) return null
                    return (
                      <div key={i} onClick={() => handleSelectVehicle(item)}
                        className="px-4 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white font-mono">{car.number}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{car.brand} {car.model}</p>
                      </div>
                    )
                  })}
                </div>
              )}
              {form.car_id && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">✓ Véhicule sélectionné : {search}</p>
              )}
            </div>
          </div>

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
            <Link href="/boyah-transport/prestataires/list">
              <button type="button" className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition shadow-sm">
                Annuler
              </button>
            </Link>
            <button type="submit" disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition shadow-sm flex items-center gap-2">
              {loading
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Création en cours...</>
                : <><Plus size={15} />Créer le prestataire sur Yango</>
              }
            </button>
          </div>

        </form>
      </div>

      {/* STICKY MOBILE */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-4 py-3 flex gap-3 shadow-2xl">
        <Link href="/boyah-transport/prestataires/list" className="flex-1">
          <button type="button" className="w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium">
            Annuler
          </button>
        </Link>
        <button disabled={loading} onClick={() => handleSubmit()}
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
