"use client"
import { authFetch } from "@/lib/authFetch"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { toast } from "@/lib/toast"
import {
  ArrowLeft, Camera, User, Phone, MessageSquare,
  CheckCircle, AlertCircle, UserPlus, FileText,
  Home, Users, CreditCard, ShieldCheck
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"

/* ═══════════════════════════════════
   SOUS-COMPOSANTS
═══════════════════════════════════ */

function SectionHeader({ icon: Icon, label, color }: {
  icon: React.ElementType
  label: string
  color: string
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
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-semibold text-gray-600 dark:text-gray-400">
        {label}
        {required && <span className="text-indigo-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </div>
  )
}

/* Zone upload photo avec preview */
function PhotoZone({ label, sublabel, preview, onSelect, onClear }: {
  label: string
  sublabel: string
  preview: string | null
  onSelect: () => void
  onClear: () => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] font-semibold text-gray-600 dark:text-gray-400">{label}</span>
      <div className="relative">
        <div
          onClick={onSelect}
          className={`relative w-full h-36 rounded-xl border-2 border-dashed cursor-pointer overflow-hidden flex flex-col items-center justify-center transition group
            ${preview
              ? "border-indigo-300 dark:border-indigo-600"
              : "border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 bg-gray-50 dark:bg-gray-800 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10"
            }`}
        >
          {preview ? (
            <Image src={preview} alt={label} fill className="object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-gray-400 group-hover:text-indigo-500 transition p-4 text-center">
              <Camera size={22} />
              <span className="text-[11px] font-medium">{sublabel}</span>
            </div>
          )}
        </div>
        {preview && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClear() }}
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] hover:bg-red-600 transition shadow z-10"
          >✕</button>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════
   HELPERS UPLOAD
═══════════════════════════════════ */

async function uploadToStorage(file: File, bucket: string): Promise<string | null> {
  const fd = new FormData()
  fd.append("file", file)
  fd.append("bucket", bucket)
  const res  = await fetch("/api/upload", { method: "POST", body: fd })
  const data = await res.json()
  if (!data.ok) throw new Error(data.error)
  return data.url
}

/* ═══════════════════════════════════
   PAGE
═══════════════════════════════════ */

export default function CreateChauffeur() {

  const router = useRouter()

  /* refs inputs fichiers */
  const refPhoto        = useRef<HTMLInputElement>(null)
  const refPermisRecto  = useRef<HTMLInputElement>(null)
  const refPermisVerso  = useRef<HTMLInputElement>(null)

  /* états */
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [photoFile,        setPhotoFile]        = useState<File | null>(null)
  const [photoPreview,     setPhotoPreview]     = useState<string | null>(null)
  const [permisRectoFile,  setPermisRectoFile]  = useState<File | null>(null)
  const [permisRectoPreview, setPermisRectoPreview] = useState<string | null>(null)
  const [permisVersoFile,  setPermisVersoFile]  = useState<File | null>(null)
  const [permisVersoPreview, setPermisVersoPreview] = useState<string | null>(null)

  const [form, setForm] = useState({
    nom:                    "",
    numero_wave:            "",
    numero_permis:          "",
    numero_cni:             "",
    situation_matrimoniale: "",
    nombre_enfants:         "",
    domicile:               "",
    numero_garant:          "",
    actif:                  true,
    commentaire:            "",
  })

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm(p => ({ ...p, [k]: v }))

  const inp = "w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 rounded-xl px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white"

  /* handler générique fichier */
  const pickFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (f: File) => void,
    setPreview: (s: string) => void
  ) => {
    const f = e.target.files?.[0]
    if (f) { setFile(f); setPreview(URL.createObjectURL(f)) }
    e.target.value = ""
  }

  /* ── submit ── */
  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    if (!form.nom.trim()) return
    setLoading(true)
    setErrorMsg(null)

    try {
      const [photoUrl, permisRectoUrl, permisVersoUrl] = await Promise.all([
        photoFile       ? uploadToStorage(photoFile,       "chauffeurs") : null,
        permisRectoFile ? uploadToStorage(permisRectoFile, "chauffeurs") : null,
        permisVersoFile ? uploadToStorage(permisVersoFile, "chauffeurs") : null,
      ])

      const payload: Record<string, unknown> = {
        nom:                    form.nom.trim(),
        numero_wave:            form.numero_wave.trim()            || null,
        numero_permis:          form.numero_permis.trim()          || null,
        numero_cni:             form.numero_cni.trim()             || null,
        situation_matrimoniale: form.situation_matrimoniale        || null,
        nombre_enfants:         form.nombre_enfants !== "" ? Number(form.nombre_enfants) : null,
        domicile:               form.domicile.trim()               || null,
        numero_garant:          form.numero_garant.trim()          || null,
        actif:                  form.actif,
        commentaire:            form.commentaire.trim()            || null,
        ...(photoUrl        ? { photo: photoUrl }               : {}),
        ...(permisRectoUrl  ? { photo_permis_recto: permisRectoUrl } : {}),
        ...(permisVersoUrl  ? { photo_permis_verso: permisVersoUrl } : {}),
      }

      const res  = await authFetch("/api/chauffeurs/create", { method: "POST", body: JSON.stringify(payload) })
      const data = await res.json()

      if (data.success) {
        toast.success("Chauffeur créé avec succès")
        router.push("/chauffeurs")
      } else {
        toast.error(data.error || "Erreur lors de la création")
        setErrorMsg(data.error)
        setLoading(false)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue"
      toast.error(msg)
      setErrorMsg(msg)
      setLoading(false)
    }
  }

  /* ─────────── RENDER ─────────── */
  return (
    <div className="min-h-screen pb-28">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* ── HEADER ── */}
        <div className="flex items-start gap-4">
          <Link
            href="/chauffeurs"
            className="mt-1 flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-600 transition shadow-sm"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nouveau chauffeur</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Table <span className="font-mono text-indigo-500 text-xs bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">chauffeurs</span>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* ════════ PHOTO PROFIL ════════ */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
            <div className="flex flex-col sm:flex-row items-center gap-6">

              <div className="relative flex-shrink-0">
                <div
                  onClick={() => refPhoto.current?.click()}
                  className="w-28 h-28 rounded-2xl bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-pointer overflow-hidden flex items-center justify-center hover:border-indigo-400 transition group"
                >
                  {photoPreview ? (
                    <Image src={photoPreview} alt="preview" fill className="object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-gray-400 group-hover:text-indigo-500 transition">
                      <Camera size={28} />
                      <span className="text-[10px] font-medium">Photo</span>
                    </div>
                  )}
                </div>
                {photoPreview && (
                  <button type="button" onClick={() => { setPhotoPreview(null); setPhotoFile(null) }}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600 shadow">✕</button>
                )}
                <input ref={refPhoto} type="file" accept="image/*" className="hidden"
                  onChange={e => pickFile(e, setPhotoFile, setPhotoPreview)} />
              </div>

              <div className="text-center sm:text-left space-y-1">
                <p className="text-sm font-semibold text-gray-800 dark:text-white">Photo de profil</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">JPG, PNG, WEBP — 400×400px recommandé</p>
                <button type="button" onClick={() => refPhoto.current?.click()}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium hover:border-indigo-300 hover:text-indigo-600 transition">
                  <Camera size={12} />
                  {photoPreview ? "Changer" : "Choisir une photo"}
                </button>
              </div>
            </div>
          </div>

          {/* ════════ INFORMATIONS GÉNÉRALES ════════ */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-5">
            <SectionHeader icon={User} label="Informations générales" color="bg-indigo-500" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <Field label="Nom complet" required>
                <input type="text" required placeholder="Prénom et nom" className={inp}
                  value={form.nom} onChange={e => set("nom", e.target.value)} />
              </Field>

              <Field label="Numéro Wave">
                <div className="relative">
                  <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="+225 XX XX XX XX XX" className={`${inp} pl-9`}
                    value={form.numero_wave} onChange={e => set("numero_wave", e.target.value)} />
                </div>
              </Field>

              <Field label="Domicile (adresse)">
                <div className="relative">
                  <Home size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Quartier, ville..." className={`${inp} pl-9`}
                    value={form.domicile} onChange={e => set("domicile", e.target.value)} />
                </div>
              </Field>

              <Field label="Numéro du garant">
                <div className="relative">
                  <ShieldCheck size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="+225 XX XX XX XX XX" className={`${inp} pl-9`}
                    value={form.numero_garant} onChange={e => set("numero_garant", e.target.value)} />
                </div>
              </Field>

            </div>
          </div>

          {/* ════════ SITUATION PERSONNELLE ════════ */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-5">
            <SectionHeader icon={Users} label="Situation personnelle" color="bg-blue-500" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <Field label="Situation matrimoniale">
                <select className={inp} value={form.situation_matrimoniale}
                  onChange={e => set("situation_matrimoniale", e.target.value)}>
                  <option value="">— Sélectionner —</option>
                  <option value="Célibataire">Célibataire</option>
                  <option value="Marié(e)">Marié(e)</option>
                  <option value="Divorcé(e)">Divorcé(e)</option>
                  <option value="Veuf/Veuve">Veuf / Veuve</option>
                </select>
              </Field>

              <Field label="Nombre d'enfants">
                <input type="number" min={0} placeholder="0" className={inp}
                  value={form.nombre_enfants} onChange={e => set("nombre_enfants", e.target.value)} />
              </Field>

            </div>
          </div>

          {/* ════════ DOCUMENTS D'IDENTITÉ ════════ */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-5">
            <SectionHeader icon={CreditCard} label="Documents d'identité" color="bg-amber-500" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <Field label="Numéro de permis de conduire">
                <input type="text" placeholder="XX-XXXXXX-XX" className={inp}
                  value={form.numero_permis} onChange={e => set("numero_permis", e.target.value)} />
              </Field>

              <Field label="Numéro de CNI">
                <input type="text" placeholder="CI-XXXXXXXXXX" className={inp}
                  value={form.numero_cni} onChange={e => set("numero_cni", e.target.value)} />
              </Field>

            </div>
          </div>

          {/* ════════ PHOTOS DU PERMIS ════════ */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-orange-500">
                  <FileText size={14} className="text-white" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                  Photos du permis de conduire
                </span>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                Optionnel
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">

              <div>
                <PhotoZone
                  label="Recto"
                  sublabel="Face avant"
                  preview={permisRectoPreview}
                  onSelect={() => refPermisRecto.current?.click()}
                  onClear={() => { setPermisRectoPreview(null); setPermisRectoFile(null) }}
                />
                <input ref={refPermisRecto} type="file" accept="image/*" className="hidden"
                  onChange={e => pickFile(e, setPermisRectoFile, setPermisRectoPreview)} />
              </div>

              <div>
                <PhotoZone
                  label="Verso"
                  sublabel="Face arrière"
                  preview={permisVersoPreview}
                  onSelect={() => refPermisVerso.current?.click()}
                  onClear={() => { setPermisVersoPreview(null); setPermisVersoFile(null) }}
                />
                <input ref={refPermisVerso} type="file" accept="image/*" className="hidden"
                  onChange={e => pickFile(e, setPermisVersoFile, setPermisVersoPreview)} />
              </div>

            </div>

            <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
              <Camera size={11} className="flex-shrink-0" />
              Formats acceptés : JPG, PNG, WEBP — Taille max recommandée : 5 Mo
            </p>
          </div>

          {/* ════════ STATUT ════════ */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">
            <SectionHeader icon={CheckCircle} label="Statut" color="bg-emerald-500" />

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">Chauffeur actif</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Un chauffeur inactif n&apos;apparaît plus dans les statistiques
                </p>
              </div>
              <button type="button" onClick={() => set("actif", !form.actif)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200
                  ${form.actif ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200
                  ${form.actif ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>

            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
              ${form.actif
                ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                : "bg-gray-100 dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700"
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${form.actif ? "bg-emerald-500" : "bg-gray-400"}`} />
              {form.actif ? "Actif" : "Inactif"}
            </span>
          </div>

          {/* ════════ COMMENTAIRE ════════ */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-5">
            <SectionHeader icon={MessageSquare} label="Commentaire" color="bg-purple-500" />
            <textarea rows={3} placeholder="Notes internes sur le chauffeur (optionnel)..."
              className={`${inp} resize-none`} value={form.commentaire}
              onChange={e => set("commentaire", e.target.value)} />
          </div>

          {/* ════════ ERREUR ════════ */}
          {errorMsg && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              <AlertCircle size={18} className="flex-shrink-0" />
              <div>
                <p className="font-semibold">Erreur</p>
                <p className="text-xs opacity-75 mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* ════════ ACTIONS DESKTOP ════════ */}
          <div className="hidden sm:flex items-center justify-between pt-2">
            <Link href="/chauffeurs">
              <button type="button" className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition shadow-sm">
                Annuler
              </button>
            </Link>
            <button type="submit" disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold transition shadow-sm flex items-center gap-2">
              {loading
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enregistrement...</>
                : <><UserPlus size={15} /> Créer le chauffeur</>
              }
            </button>
          </div>

        </form>
      </div>

      {/* ════════ BARRE STICKY MOBILE ════════ */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-4 py-3 flex gap-3 shadow-2xl">
        <Link href="/chauffeurs" className="flex-1">
          <button type="button" className="w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium">
            Annuler
          </button>
        </Link>
        <button disabled={loading} onClick={handleSubmit}
          className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2">
          {loading
            ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <><UserPlus size={14} /> Créer</>
          }
        </button>
      </div>
    </div>
  )
}
