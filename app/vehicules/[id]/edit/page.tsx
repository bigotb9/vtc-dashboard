"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import {
  ArrowLeft, Camera, Car, Wrench, FileText,
  CheckCircle, AlertCircle, User, Hash, Loader2, Save, UserCheck
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"

/* ── helpers ── */
async function uploadPhoto(file: File, bucket = "vehicules"): Promise<string> {
  const fd = new FormData()
  fd.append("file", file)
  fd.append("bucket", bucket)
  const res  = await fetch("/api/upload", { method: "POST", body: fd })
  const data = await res.json()
  if (!data.ok) throw new Error(data.error)
  return data.url
}

function SectionHeader({ icon: Icon, label, color }: {
  icon: React.ElementType; label: string; color: string
}) {
  return (
    <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100 dark:border-gray-800">
      <span className={`flex items-center justify-center w-7 h-7 rounded-lg ${color}`}>
        <Icon size={14} className="text-white" />
      </span>
      <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">{label}</span>
    </div>
  )
}

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-semibold text-gray-600 dark:text-gray-400">
        {label}{required && <span className="text-indigo-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </div>
  )
}

const inp = "w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 rounded-xl px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"

function PhotoZone({ label, preview, onSelect, onClear }: {
  label: string; preview: string | null; onSelect: () => void; onClear: () => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] font-semibold text-gray-600 dark:text-gray-400">{label}</span>
      <div className="relative">
        <div onClick={onSelect}
          className={`relative w-full h-32 rounded-xl border-2 border-dashed cursor-pointer overflow-hidden flex flex-col items-center justify-center transition group
            ${preview ? "border-indigo-300 dark:border-indigo-600" : "border-gray-200 dark:border-gray-700 hover:border-indigo-400 bg-gray-50 dark:bg-gray-800"}`}>
          {preview
            ? <Image src={preview} alt={label} fill className="object-cover" />
            : <div className="flex flex-col items-center gap-1.5 text-gray-400 group-hover:text-indigo-500 transition">
                <Camera size={20} />
                <span className="text-[11px] font-medium">Cliquer pour ajouter</span>
              </div>
          }
        </div>
        {preview && (
          <button type="button" onClick={e => { e.stopPropagation(); onClear() }}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500 transition text-xs font-bold z-10">
            ✕
          </button>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════
   PAGE
═══════════════════════════════════ */
export default function EditVehicule() {
  const router = useRouter()
  const params = useParams()
  const id     = params.id as string

  const photoRef = useRef<HTMLInputElement>(null)
  const rectoRef = useRef<HTMLInputElement>(null)
  const versoRef = useRef<HTMLInputElement>(null)

  const [loadingData, setLoadingData] = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null)
  const [success,     setSuccess]     = useState(false)

  // Champs
  const [form, setForm] = useState({
    immatriculation:           "",
    type_vehicule:             "",
    proprietaire:              "",
    statut:                    "ACTIF",
    km_actuel:                 "",
    km_derniere_vidange:       "",
    date_derniers_pneus:       "",
    date_assurance:            "",
    date_expiration_assurance: "",
    date_visite_technique:     "",
    date_expiration_visite:    "",
    date_carte_stationnement:            "",
    date_expiration_carte_stationnement: "",
    date_patente:            "",
    date_expiration_patente: "",
    sous_gestion:              false,
    montant_mensuel_client:    "",
    id_client:                 "",
    montant_recette_jour:      "",
  })
  const [clients, setClients] = useState<{ id: number; nom: string }[]>([])
  const set = (k: keyof typeof form, v: string | boolean) => setForm(p => ({ ...p, [k]: v }))

  // Photos
  const [photoUrl,     setPhotoUrl]     = useState<string | null>(null)
  const [photoFile,    setPhotoFile]    = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const [rectoUrl,     setRectoUrl]     = useState<string | null>(null)
  const [rectoFile,    setRectoFile]    = useState<File | null>(null)
  const [rectoPreview, setRectoPreview] = useState<string | null>(null)

  const [versoUrl,     setVersoUrl]     = useState<string | null>(null)
  const [versoFile,    setVersoFile]    = useState<File | null>(null)
  const [versoPreview, setVersoPreview] = useState<string | null>(null)

  /* ── chargement ── */
  useEffect(() => {
    supabase.from("clients").select("id, nom").order("nom")
      .then(({ data }) => setClients(data ?? []))
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase.from("vehicules").select("*").eq("id_vehicule", id).single()
        if (!data) return
        setForm({
          immatriculation:           data.immatriculation           ?? "",
          type_vehicule:             data.type_vehicule             ?? "",
          proprietaire:              data.proprietaire              ?? "",
          statut:                    data.statut                    ?? "ACTIF",
          km_actuel:                 data.km_actuel?.toString()     ?? "",
          km_derniere_vidange:       data.km_derniere_vidange?.toString() ?? "",
          date_derniers_pneus:       data.date_derniers_pneus       ?? "",
          date_assurance:            data.date_assurance            ?? "",
          date_expiration_assurance: data.date_expiration_assurance ?? "",
          date_visite_technique:     data.date_visite_technique     ?? "",
          date_expiration_visite:    data.date_expiration_visite    ?? "",
          date_carte_stationnement:            data.date_carte_stationnement            ?? "",
          date_expiration_carte_stationnement: data.date_expiration_carte_stationnement ?? "",
          date_patente:            data.date_patente            ?? "",
          date_expiration_patente: data.date_expiration_patente ?? "",
          sous_gestion:              data.sous_gestion              ?? false,
          montant_mensuel_client:    data.montant_mensuel_client?.toString() ?? "",
          id_client:                 data.id_client?.toString()     ?? "",
          montant_recette_jour:      data.montant_recette_jour?.toString() ?? "",
        })
        setPhotoUrl(data.photo ?? null);              setPhotoPreview(data.photo ?? null)
        setRectoUrl(data.carte_grise_recto ?? null);  setRectoPreview(data.carte_grise_recto ?? null)
        setVersoUrl(data.carte_grise_verso ?? null);  setVersoPreview(data.carte_grise_verso ?? null)
      } finally {
        setLoadingData(false)
      }
    }
    load()
  }, [id])

  const handleFile = (
    file: File | undefined,
    setFile: (f: File | null) => void,
    setPreview: (p: string | null) => void
  ) => {
    if (!file) return
    setFile(file); setPreview(URL.createObjectURL(file))
  }

  /* ── soumission ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.immatriculation.trim()) { setErrorMsg("L'immatriculation est requise."); return }
    setSaving(true); setErrorMsg(null)

    try {
      const finalPhoto = photoFile ? await uploadPhoto(photoFile) : photoUrl
      const finalRecto = rectoFile ? await uploadPhoto(rectoFile) : rectoUrl
      const finalVerso = versoFile ? await uploadPhoto(versoFile) : versoUrl

      const res = await fetch("/api/vehicules/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          immatriculation:           form.immatriculation.trim().toUpperCase(),
          type_vehicule:             form.type_vehicule.trim()  || null,
          proprietaire:              form.proprietaire.trim()   || null,
          statut:                    form.statut,
          km_actuel:                 form.km_actuel             !== "" ? Number(form.km_actuel)             : null,
          km_derniere_vidange:       form.km_derniere_vidange   !== "" ? Number(form.km_derniere_vidange)   : null,
          date_derniers_pneus:       form.date_derniers_pneus       || null,
          date_assurance:            form.date_assurance             || null,
          date_expiration_assurance: form.date_expiration_assurance  || null,
          date_visite_technique:     form.date_visite_technique       || null,
          date_expiration_visite:    form.date_expiration_visite      || null,
          date_carte_stationnement:            form.date_carte_stationnement            || null,
          date_expiration_carte_stationnement: form.date_expiration_carte_stationnement || null,
          date_patente:            form.date_patente            || null,
          date_expiration_patente: form.date_expiration_patente || null,
          sous_gestion:              form.sous_gestion,
          montant_mensuel_client:    form.sous_gestion && form.montant_mensuel_client !== "" ? Number(form.montant_mensuel_client) : 0,
          id_client:                 form.sous_gestion && form.id_client !== "" ? Number(form.id_client) : null,
          montant_recette_jour:      form.montant_recette_jour !== "" ? Number(form.montant_recette_jour) : 0,
          photo:                     finalPhoto,
          carte_grise_recto:         finalRecto,
          carte_grise_verso:         finalVerso,
        }),
      })

      const data = await res.json()
      if (!data.success) { setErrorMsg(data.error); return }

      setSuccess(true)
      setTimeout(() => router.push(`/vehicules/${id}`), 1200)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erreur inconnue")
    } finally {
      setSaving(false)
    }
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-3 text-gray-400">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">Chargement...</span>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-6 space-y-5">

      {/* ── HEADER ── */}
      <div className="flex items-center gap-3">
        <Link href={`/vehicules/${id}`}
          className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition shadow-sm">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Véhicules / Modifier le profil</p>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white font-mono">{form.immatriculation || "—"}</h1>
        </div>
      </div>

      {/* ── PHOTO ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">
        <SectionHeader icon={Camera} label="Photo du véhicule" color="bg-sky-500" />
        <input ref={photoRef} type="file" accept="image/*" className="hidden"
          onChange={e => handleFile(e.target.files?.[0], setPhotoFile, setPhotoPreview)} />
        <div className="flex items-center gap-4">
          <div onClick={() => photoRef.current?.click()}
            className="relative w-32 h-24 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 cursor-pointer overflow-hidden hover:border-indigo-400 transition flex-shrink-0 bg-gray-50 dark:bg-gray-800">
            {photoPreview
              ? <Image src={photoPreview} alt="photo" fill className="object-cover" />
              : <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-400"><Camera size={20} /></div>
            }
          </div>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => photoRef.current?.click()}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
              {photoPreview ? "Changer la photo" : "Ajouter une photo"}
            </button>
            {photoPreview && (
              <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null); setPhotoUrl(null) }}
                className="text-xs text-red-500 hover:underline">Supprimer</button>
            )}
            <p className="text-[11px] text-gray-400">JPG, PNG · max 5 Mo</p>
          </div>
        </div>
      </div>

      {/* ── INFORMATIONS GÉNÉRALES ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">
        <SectionHeader icon={Car} label="Informations générales" color="bg-indigo-500" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Immatriculation" required>
            <input value={form.immatriculation} onChange={e => set("immatriculation", e.target.value.toUpperCase())}
              placeholder="AA 000 XX" className={inp} />
          </Field>
          <Field label="Type de véhicule">
            <input value={form.type_vehicule} onChange={e => set("type_vehicule", e.target.value)}
              placeholder="Berline, SUV..." className={inp} />
          </Field>
          <Field label="Propriétaire">
            <input value={form.proprietaire} onChange={e => set("proprietaire", e.target.value)}
              placeholder="Nom du propriétaire" className={inp} />
          </Field>
          <Field label="Statut">
            <select value={form.statut} onChange={e => set("statut", e.target.value)} className={inp}>
              <option value="ACTIF">ACTIF</option>
              <option value="INACTIF">INACTIF</option>
              <option value="EN MAINTENANCE">EN MAINTENANCE</option>
            </select>
          </Field>
        </div>
      </div>

      {/* ── GESTION CLIENT ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">
        <SectionHeader icon={UserCheck} label="Gestion client" color="bg-violet-500" />

        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-white">Véhicule sous gestion</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Le propriétaire est un client externe — Boyah reverse un montant mensuel</p>
          </div>
          <button type="button"
            onClick={() => set("sous_gestion", !form.sous_gestion)}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${form.sous_gestion ? "bg-violet-500" : "bg-gray-300 dark:bg-gray-600"}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.sous_gestion ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </div>

        {form.sous_gestion && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Client propriétaire">
              <select className={inp} value={form.id_client} onChange={e => set("id_client", e.target.value)}>
                <option value="">— Sélectionner un client —</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.nom}</option>
                ))}
              </select>
            </Field>
            <Field label="Montant mensuel client (FCFA)">
              <input type="number" min={0} placeholder="ex : 200 000" className={inp}
                value={form.montant_mensuel_client}
                onChange={e => set("montant_mensuel_client", e.target.value)} />
            </Field>
          </div>
        )}
      </div>

      {/* ── KILOMÉTRAGE ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">
        <SectionHeader icon={Hash} label="Kilométrage & Recette" color="bg-teal-500" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Kilométrage actuel">
            <input type="number" min="0" value={form.km_actuel} onChange={e => set("km_actuel", e.target.value)}
              placeholder="Ex. 85000" className={inp} />
          </Field>
          <Field label="Km à la dernière vidange">
            <input type="number" min="0" value={form.km_derniere_vidange} onChange={e => set("km_derniere_vidange", e.target.value)}
              placeholder="Ex. 80000" className={inp} />
          </Field>
          <Field label="Recette jour (FCFA)" hint="Utilisée pour détecter les manquants et insuffisants dans le suivi">
            <input type="number" min="0" value={form.montant_recette_jour} onChange={e => set("montant_recette_jour", e.target.value)}
              placeholder="Ex. 22000" className={inp} />
          </Field>
        </div>
      </div>

      {/* ── DOCUMENTS & DATES ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">
        <SectionHeader icon={Wrench} label="Documents & dates d'expiration" color="bg-amber-500" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Date des derniers pneus">
            <input type="date" value={form.date_derniers_pneus} onChange={e => set("date_derniers_pneus", e.target.value)} className={inp} />
          </Field>
          <Field label="Date assurance">
            <input type="date" value={form.date_assurance} onChange={e => set("date_assurance", e.target.value)} className={inp} />
          </Field>
          <Field label="Expiration assurance">
            <input type="date" value={form.date_expiration_assurance} onChange={e => set("date_expiration_assurance", e.target.value)} className={inp} />
          </Field>
          <Field label="Date visite technique">
            <input type="date" value={form.date_visite_technique} onChange={e => set("date_visite_technique", e.target.value)} className={inp} />
          </Field>
          <Field label="Expiration visite technique">
            <input type="date" value={form.date_expiration_visite} onChange={e => set("date_expiration_visite", e.target.value)} className={inp} />
          </Field>
          <Field label="Date carte de stationnement">
            <input type="date" value={form.date_carte_stationnement} onChange={e => set("date_carte_stationnement", e.target.value)} className={inp} />
          </Field>
          <Field label="Expiration carte de stationnement">
            <input type="date" value={form.date_expiration_carte_stationnement} onChange={e => set("date_expiration_carte_stationnement", e.target.value)} className={inp} />
          </Field>
          <Field label="Date patente">
            <input type="date" value={form.date_patente} onChange={e => set("date_patente", e.target.value)} className={inp} />
          </Field>
          <Field label="Expiration patente">
            <input type="date" value={form.date_expiration_patente} onChange={e => set("date_expiration_patente", e.target.value)} className={inp} />
          </Field>
        </div>
      </div>

      {/* ── CARTE GRISE ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">
        <SectionHeader icon={FileText} label="Carte grise" color="bg-rose-500" />
        <input ref={rectoRef} type="file" accept="image/*" className="hidden"
          onChange={e => handleFile(e.target.files?.[0], setRectoFile, setRectoPreview)} />
        <input ref={versoRef} type="file" accept="image/*" className="hidden"
          onChange={e => handleFile(e.target.files?.[0], setVersoFile, setVersoPreview)} />
        <div className="grid grid-cols-2 gap-4">
          <PhotoZone label="Carte grise — Recto" preview={rectoPreview}
            onSelect={() => rectoRef.current?.click()}
            onClear={() => { setRectoFile(null); setRectoPreview(null); setRectoUrl(null) }} />
          <PhotoZone label="Carte grise — Verso" preview={versoPreview}
            onSelect={() => versoRef.current?.click()}
            onClear={() => { setVersoFile(null); setVersoPreview(null); setVersoUrl(null) }} />
        </div>
      </div>

      {/* ── MESSAGES ── */}
      {errorMsg && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
          <AlertCircle size={16} className="flex-shrink-0" />{errorMsg}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle size={16} className="flex-shrink-0" />Véhicule mis à jour avec succès ! Redirection...
        </div>
      )}

      {/* ── BOUTON ── */}
      <button type="submit" disabled={saving || success}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 shadow-md shadow-indigo-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
        {saving ? <><Loader2 size={16} className="animate-spin" />Enregistrement...</> : <><Save size={16} />Enregistrer les modifications</>}
      </button>

    </form>
  )
}
