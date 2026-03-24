"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import {
  ArrowLeft, Camera, Car, Wrench, FileText,
  AlertCircle, Plus, Hash, User
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"

/* ── helpers ── */
async function uploadPhoto(file: File): Promise<string> {
  const ext = file.name.split(".").pop()
  const name = `vehicule_${Date.now()}.${ext}`
  const { error } = await supabase.storage.from("vehicules").upload(name, file, { upsert: true })
  if (error) throw new Error(error.message)
  return supabase.storage.from("vehicules").getPublicUrl(name).data.publicUrl
}

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

function Field({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-semibold text-gray-600 dark:text-gray-400">
        {label}{required && <span className="text-indigo-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

/* ── page ── */
export default function CreateVehicule() {
  const router = useRouter()
  const photoRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading]       = useState(false)
  const [errorMsg, setErrorMsg]     = useState<string | null>(null)
  const [photoFile, setPhotoFile]   = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const [form, setForm] = useState({
    immatriculation:         "",
    type_vehicule:           "",
    proprietaire:            "",
    statut:                  "ACTIF",
    km_actuel:               "",
    km_derniere_vidange:     "",
    date_derniers_pneus:     "",
    date_assurance:          "",
    date_expiration_assurance: "",
    date_visite_technique:   "",
    date_expiration_visite:  "",
  })

  const set = (k: keyof typeof form, v: string) =>
    setForm(p => ({ ...p, [k]: v }))

  const inp = "w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 rounded-xl px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white"

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f)) }
    e.target.value = ""
  }

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    if (!form.immatriculation.trim()) return
    setLoading(true)
    setErrorMsg(null)

    try {
      let photoUrl: string | undefined
      if (photoFile) photoUrl = await uploadPhoto(photoFile)

      const payload: Record<string, unknown> = {
        immatriculation:           form.immatriculation.trim().toUpperCase(),
        type_vehicule:             form.type_vehicule.trim()         || null,
        proprietaire:              form.proprietaire.trim()          || null,
        statut:                    form.statut,
        km_actuel:                 form.km_actuel       !== "" ? Number(form.km_actuel)           : null,
        km_derniere_vidange:       form.km_derniere_vidange !== "" ? Number(form.km_derniere_vidange) : null,
        date_derniers_pneus:       form.date_derniers_pneus       || null,
        date_assurance:            form.date_assurance             || null,
        date_expiration_assurance: form.date_expiration_assurance  || null,
        date_visite_technique:     form.date_visite_technique       || null,
        date_expiration_visite:    form.date_expiration_visite      || null,
        ...(photoUrl ? { photo: photoUrl } : {}),
      }

      const res  = await fetch("/api/vehicules/create", { method: "POST", body: JSON.stringify(payload) })
      const data = await res.json()

      if (data.success) router.push("/vehicules")
      else { setErrorMsg(data.error); setLoading(false) }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erreur inconnue")
      setLoading(false)
    }
  }

  /* ── render ── */
  return (
    <div className="min-h-screen pb-28">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* HEADER */}
        <div className="flex items-start gap-4">
          <Link href="/vehicules"
            className="mt-1 flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition shadow-sm">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nouveau véhicule</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Table <span className="font-mono text-indigo-500 text-xs bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">vehicules</span>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ══ PHOTO ══ */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
            <div className="flex flex-col sm:flex-row items-center gap-6">

              <div className="relative flex-shrink-0">
                <div onClick={() => photoRef.current?.click()}
                  className="w-32 h-24 rounded-2xl bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-pointer overflow-hidden flex items-center justify-center hover:border-indigo-400 transition group">
                  {photoPreview
                    ? <Image src={photoPreview} alt="preview" fill className="object-cover" />
                    : <div className="flex flex-col items-center gap-1 text-gray-400 group-hover:text-indigo-500 transition">
                        <Camera size={24} /><span className="text-[10px] font-medium">Photo</span>
                      </div>
                  }
                </div>
                {photoPreview && (
                  <button type="button" onClick={() => { setPhotoPreview(null); setPhotoFile(null) }}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] hover:bg-red-600 shadow">✕</button>
                )}
                <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </div>

              <div className="text-center sm:text-left space-y-1">
                <p className="text-sm font-semibold text-gray-800 dark:text-white">Photo du véhicule</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">JPG, PNG, WEBP — vue extérieure recommandée</p>
                <button type="button" onClick={() => photoRef.current?.click()}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium hover:border-indigo-300 hover:text-indigo-600 transition">
                  <Camera size={12} />{photoPreview ? "Changer" : "Choisir une photo"}
                </button>
              </div>
            </div>
          </div>

          {/* ══ IDENTIFICATION ══ */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-5">
            <SectionHeader icon={Car} label="Identification" color="bg-indigo-500" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <Field label="Immatriculation" required>
                <div className="relative">
                  <Hash size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" required placeholder="ex : 31021WWCI" className={`${inp} pl-9 uppercase`}
                    value={form.immatriculation}
                    onChange={e => set("immatriculation", e.target.value)} />
                </div>
              </Field>

              <Field label="Type de véhicule">
                <input type="text" placeholder="ex : Berline, SUV..." className={inp}
                  value={form.type_vehicule} onChange={e => set("type_vehicule", e.target.value)} />
              </Field>

              <Field label="Propriétaire">
                <div className="relative">
                  <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Nom du propriétaire" className={`${inp} pl-9`}
                    value={form.proprietaire} onChange={e => set("proprietaire", e.target.value)} />
                </div>
              </Field>

              <Field label="Statut">
                <select className={inp} value={form.statut} onChange={e => set("statut", e.target.value)}>
                  <option value="ACTIF">ACTIF</option>
                  <option value="INACTIF">INACTIF</option>
                  <option value="EN MAINTENANCE">EN MAINTENANCE</option>
                </select>
              </Field>

            </div>
          </div>

          {/* ══ KILOMÉTRAGE ══ */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-5">
            <SectionHeader icon={Wrench} label="Kilométrage" color="bg-orange-500" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <Field label="Kilométrage actuel (km)">
                <input type="number" min={0} placeholder="0" className={inp}
                  value={form.km_actuel} onChange={e => set("km_actuel", e.target.value)} />
              </Field>

              <Field label="Km à la dernière vidange">
                <input type="number" min={0} placeholder="0" className={inp}
                  value={form.km_derniere_vidange} onChange={e => set("km_derniere_vidange", e.target.value)} />
              </Field>

            </div>
          </div>

          {/* ══ DOCUMENTS & DATES ══ */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500">
                  <FileText size={14} className="text-white" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                  Documents & dates
                </span>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                Optionnel
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <Field label="Date derniers pneus">
                <input type="date" className={inp}
                  value={form.date_derniers_pneus} onChange={e => set("date_derniers_pneus", e.target.value)} />
              </Field>

              <Field label="Date assurance">
                <input type="date" className={inp}
                  value={form.date_assurance} onChange={e => set("date_assurance", e.target.value)} />
              </Field>

              <Field label="Date expiration assurance">
                <input type="date" className={inp}
                  value={form.date_expiration_assurance} onChange={e => set("date_expiration_assurance", e.target.value)} />
              </Field>

              <Field label="Date visite technique">
                <input type="date" className={inp}
                  value={form.date_visite_technique} onChange={e => set("date_visite_technique", e.target.value)} />
              </Field>

              <Field label="Date expiration visite technique">
                <input type="date" className={inp}
                  value={form.date_expiration_visite} onChange={e => set("date_expiration_visite", e.target.value)} />
              </Field>

            </div>
          </div>

          {/* ERREUR */}
          {errorMsg && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              <AlertCircle size={18} className="flex-shrink-0" />
              <div><p className="font-semibold">Erreur</p><p className="text-xs opacity-75 mt-0.5">{errorMsg}</p></div>
            </div>
          )}

          {/* ACTIONS DESKTOP */}
          <div className="hidden sm:flex items-center justify-between pt-2">
            <Link href="/vehicules">
              <button type="button" className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition shadow-sm">
                Annuler
              </button>
            </Link>
            <button type="submit" disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition shadow-sm flex items-center gap-2">
              {loading
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Enregistrement...</>
                : <><Plus size={15} />Créer le véhicule</>
              }
            </button>
          </div>

        </form>
      </div>

      {/* STICKY MOBILE */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-4 py-3 flex gap-3 shadow-2xl">
        <Link href="/vehicules" className="flex-1">
          <button type="button" className="w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium">
            Annuler
          </button>
        </Link>
        <button disabled={loading} onClick={handleSubmit}
          className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2">
          {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Plus size={14} />Créer</>}
        </button>
      </div>
    </div>
  )
}
