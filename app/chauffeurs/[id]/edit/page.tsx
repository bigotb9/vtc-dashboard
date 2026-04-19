"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import {
  ArrowLeft, Camera, User, Phone, MessageSquare,
  CheckCircle, AlertCircle, FileText,
  Home, Users, CreditCard, ShieldCheck, Loader2, Save
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"

/* ── helpers ── */
async function uploadPhoto(bucket: string, file: File): Promise<string> {
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

const inputCls = "w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition"

function PhotoZone({ label, preview, onSelect, onClear }: {
  label: string; preview: string | null; onSelect: () => void; onClear: () => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] font-semibold text-gray-600 dark:text-gray-400">{label}</span>
      <div className="relative">
        <div onClick={onSelect}
          className={`relative w-full h-36 rounded-xl border-2 border-dashed cursor-pointer overflow-hidden flex flex-col items-center justify-center transition group
            ${preview ? "border-indigo-300 dark:border-indigo-600" : "border-gray-200 dark:border-gray-700 hover:border-indigo-400 bg-gray-50 dark:bg-gray-800 hover:bg-indigo-50/50"}`}>
          {preview ? (
            <Image src={preview} alt={label} fill className="object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-gray-400 group-hover:text-indigo-500 transition p-4 text-center">
              <Camera size={22} />
              <span className="text-[11px] font-medium">Cliquer pour ajouter</span>
            </div>
          )}
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
export default function EditChauffeur() {
  const router = useRouter()
  const params = useParams()
  const id     = params.id as string

  const photoRef  = useRef<HTMLInputElement>(null)
  const rectoRef  = useRef<HTMLInputElement>(null)
  const versoRef  = useRef<HTMLInputElement>(null)

  const [loadingData, setLoadingData] = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null)
  const [success,     setSuccess]     = useState(false)

  // Champs texte
  const [nom,                   setNom]                   = useState("")
  const [numeroWave,             setNumeroWave]            = useState("")
  const [numeroPermis,           setNumeroPermis]          = useState("")
  const [numeroCni,              setNumeroCni]             = useState("")
  const [situationMatrimoniale,  setSituationMatrimoniale] = useState("")
  const [nombreEnfants,          setNombreEnfants]         = useState("")
  const [domicile,               setDomicile]              = useState("")
  const [numeroGarant,           setNumeroGarant]          = useState("")
  const [actif,                  setActif]                 = useState(true)
  const [commentaire,            setCommentaire]           = useState("")

  // Photos : URL existante + nouveau fichier sélectionné
  const [photoUrl,       setPhotoUrl]       = useState<string | null>(null)
  const [photoFile,      setPhotoFile]      = useState<File | null>(null)
  const [photoPreview,   setPhotoPreview]   = useState<string | null>(null)

  const [rectoUrl,       setRectoUrl]       = useState<string | null>(null)
  const [rectoFile,      setRectoFile]      = useState<File | null>(null)
  const [rectoPreview,   setRectoPreview]   = useState<string | null>(null)

  const [versoUrl,       setVersoUrl]       = useState<string | null>(null)
  const [versoFile,      setVersoFile]      = useState<File | null>(null)
  const [versoPreview,   setVersoPreview]   = useState<string | null>(null)

  /* ── chargement des données existantes ── */
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase.from("chauffeurs").select("*").eq("id_chauffeur", id).single()
        if (!data) return
        setNom(data.nom ?? "")
        setNumeroWave(data.numero_wave ?? "")
        setNumeroPermis(data.numero_permis ?? "")
        setNumeroCni(data.numero_cni ?? "")
        setSituationMatrimoniale(data.situation_matrimoniale ?? "")
        setNombreEnfants(data.nombre_enfants?.toString() ?? "")
        setDomicile(data.domicile ?? "")
        setNumeroGarant(data.numero_garant ?? "")
        setActif(data.actif ?? true)
        setCommentaire(data.commentaire ?? "")
        setPhotoUrl(data.photo ?? null);     setPhotoPreview(data.photo ?? null)
        setRectoUrl(data.photo_permis_recto ?? null); setRectoPreview(data.photo_permis_recto ?? null)
        setVersoUrl(data.photo_permis_verso ?? null); setVersoPreview(data.photo_permis_verso ?? null)
      } finally {
        setLoadingData(false)
      }
    }
    load()
  }, [id])

  /* ── sélection fichier → preview ── */
  const handleFile = (
    file: File | undefined,
    setFile: (f: File | null) => void,
    setPreview: (p: string | null) => void
  ) => {
    if (!file) return
    setFile(file)
    setPreview(URL.createObjectURL(file))
  }

  /* ── soumission ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nom.trim()) { setErrorMsg("Le nom est requis."); return }
    setSaving(true); setErrorMsg(null)

    try {
      // Upload nouvelles photos seulement si un fichier a été sélectionné
      const finalPhoto = photoFile ? await uploadPhoto("chauffeurs", photoFile) : photoUrl
      const finalRecto = rectoFile ? await uploadPhoto("chauffeurs", rectoFile) : rectoUrl
      const finalVerso = versoFile ? await uploadPhoto("chauffeurs", versoFile) : versoUrl

      const res = await fetch("/api/chauffeurs/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          nom:                    nom.trim(),
          numero_wave:            numeroWave.trim()   || null,
          numero_permis:          numeroPermis.trim() || null,
          numero_cni:             numeroCni.trim()    || null,
          situation_matrimoniale: situationMatrimoniale || null,
          nombre_enfants:         nombreEnfants ? parseInt(nombreEnfants) : null,
          domicile:               domicile.trim()     || null,
          numero_garant:          numeroGarant.trim() || null,
          actif,
          commentaire:            commentaire.trim()  || null,
          photo:                  finalPhoto,
          photo_permis_recto:     finalRecto,
          photo_permis_verso:     finalVerso,
        }),
      })

      const data = await res.json()
      if (!data.success) { setErrorMsg(data.error); return }

      setSuccess(true)
      setTimeout(() => router.push(`/chauffeurs/${id}`), 1200)
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
        <Link href={`/chauffeurs/${id}`}
          className="flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition shadow-sm">
          <ArrowLeft size={16} />
        </Link>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Chauffeurs / Modifier le profil</p>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{nom || "—"}</h1>
        </div>
      </div>

      {/* ── PHOTO PROFIL ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">
        <SectionHeader icon={Camera} label="Photo de profil" color="bg-indigo-500" />
        <input ref={photoRef} type="file" accept="image/*" className="hidden"
          onChange={e => handleFile(e.target.files?.[0], setPhotoFile, setPhotoPreview)} />
        <div className="flex items-center gap-4">
          <div onClick={() => photoRef.current?.click()}
            className="relative w-24 h-24 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 cursor-pointer overflow-hidden hover:border-indigo-400 transition flex-shrink-0 bg-gray-50 dark:bg-gray-800">
            {photoPreview ? (
              <Image src={photoPreview} alt="photo" fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-400">
                <Camera size={20} />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => photoRef.current?.click()}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
              {photoPreview ? "Changer la photo" : "Ajouter une photo"}
            </button>
            {photoPreview && (
              <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null); setPhotoUrl(null) }}
                className="text-xs text-red-500 hover:underline">
                Supprimer
              </button>
            )}
            <p className="text-[11px] text-gray-400">JPG, PNG · max 5 Mo</p>
          </div>
        </div>
      </div>

      {/* ── INFOS GÉNÉRALES ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">
        <SectionHeader icon={User} label="Informations générales" color="bg-indigo-500" />

        <Field label="Nom complet" required>
          <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Prénom Nom" className={inputCls} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Numéro Wave / Téléphone">
            <input value={numeroWave} onChange={e => setNumeroWave(e.target.value)} placeholder="+225 07 00 00 00 00" className={inputCls} />
          </Field>
          <Field label="Numéro garant">
            <input value={numeroGarant} onChange={e => setNumeroGarant(e.target.value)} placeholder="+225 07 00 00 00 00" className={inputCls} />
          </Field>
        </div>

        <Field label="Domicile">
          <input value={domicile} onChange={e => setDomicile(e.target.value)} placeholder="Quartier, ville" className={inputCls} />
        </Field>

        <Field label="Commentaire">
          <textarea value={commentaire} onChange={e => setCommentaire(e.target.value)}
            rows={2} placeholder="Remarques éventuelles..." className={`${inputCls} resize-none`} />
        </Field>

        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Statut actif</p>
            <p className="text-[11px] text-gray-400">Le chauffeur apparaît dans les listes actives</p>
          </div>
          <button type="button" onClick={() => setActif(v => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${actif ? "bg-indigo-500" : "bg-gray-300 dark:bg-gray-600"}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${actif ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>
      </div>

      {/* ── SITUATION PERSONNELLE ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">
        <SectionHeader icon={Users} label="Situation personnelle" color="bg-pink-500" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Situation matrimoniale">
            <select value={situationMatrimoniale} onChange={e => setSituationMatrimoniale(e.target.value)} className={inputCls}>
              <option value="">— Sélectionner —</option>
              <option value="Célibataire">Célibataire</option>
              <option value="Marié(e)">Marié(e)</option>
              <option value="Divorcé(e)">Divorcé(e)</option>
              <option value="Veuf/Veuve">Veuf/Veuve</option>
            </select>
          </Field>
          <Field label="Nombre d'enfants">
            <input type="number" min="0" value={nombreEnfants} onChange={e => setNombreEnfants(e.target.value)} placeholder="0" className={inputCls} />
          </Field>
        </div>
      </div>

      {/* ── DOCUMENTS D'IDENTITÉ ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">
        <SectionHeader icon={CreditCard} label="Documents d'identité" color="bg-amber-500" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Numéro de permis">
            <input value={numeroPermis} onChange={e => setNumeroPermis(e.target.value)} placeholder="AB123456" className={inputCls} />
          </Field>
          <Field label="Numéro de CNI">
            <input value={numeroCni} onChange={e => setNumeroCni(e.target.value)} placeholder="CI-XXXXXXXXX" className={inputCls} />
          </Field>
        </div>

        <input ref={rectoRef} type="file" accept="image/*" className="hidden"
          onChange={e => handleFile(e.target.files?.[0], setRectoFile, setRectoPreview)} />
        <input ref={versoRef} type="file" accept="image/*" className="hidden"
          onChange={e => handleFile(e.target.files?.[0], setVersoFile, setVersoPreview)} />

        <div className="grid grid-cols-2 gap-4">
          <PhotoZone label="Permis — Recto" preview={rectoPreview}
            onSelect={() => rectoRef.current?.click()}
            onClear={() => { setRectoFile(null); setRectoPreview(null); setRectoUrl(null) }} />
          <PhotoZone label="Permis — Verso" preview={versoPreview}
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
          <CheckCircle size={16} className="flex-shrink-0" />Profil mis à jour avec succès ! Redirection...
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
