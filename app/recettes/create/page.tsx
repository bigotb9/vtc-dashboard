"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Papa from "papaparse"
import {
  Upload, PlusCircle, ArrowLeft, CheckCircle,
  AlertCircle, FileText, Hash,
  Phone, User, Banknote, Tag
} from "lucide-react"
import Link from "next/link"

/* ─────────────────── types ─────────────────── */

type FormState = {
  id_recette: string
  Horodatage: string
  "Identifiant de transaction": string
  "Type de transaction": string
  "Montant net": string
  "Montant brut": string
  Frais: string
  Solde: string
  Devise: string
  "Nom de contrepartie": string
  "Numéro de téléphone de contrepartie": string
  "Nom d'utilisateur": string
  "Numéro de téléphone d'utilisateur": string
  date_paiement: string
  telephone_chauffeur: string
  date_travail: string
}

const emptyForm: FormState = {
  id_recette: "",
  Horodatage: "",
  "Identifiant de transaction": "",
  "Type de transaction": "",
  "Montant net": "",
  "Montant brut": "",
  Frais: "",
  Solde: "",
  Devise: "XOF",
  "Nom de contrepartie": "",
  "Numéro de téléphone de contrepartie": "",
  "Nom d'utilisateur": "",
  "Numéro de téléphone d'utilisateur": "",
  date_paiement: "",
  telephone_chauffeur: "",
  date_travail: "",
}

type Tab = "csv" | "manuel"

/* ─────────────────── sous-composants ─────────────────── */

function SectionHeader({ icon: Icon, label, color }: {
  icon: React.ElementType
  label: string
  color: string
}) {
  return (
    <div className={`flex items-center gap-2 pb-3 border-b border-gray-100 dark:border-gray-800`}>
      <span className={`flex items-center justify-center w-7 h-7 rounded-lg ${color}`}>
        <Icon size={14} className="text-white" />
      </span>
      <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
        {label}
      </span>
    </div>
  )
}

function Field({ label, children, required }: {
  label: string
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-semibold text-gray-600 dark:text-gray-400 leading-none">
        {label}
        {required && <span className="text-indigo-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

/* ─────────────────── page ─────────────────── */

export default function CreateRecette() {

  const router = useRouter()
  const [tab, setTab] = useState<Tab>("csv")
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [csvResult, setCsvResult] = useState<{ success: boolean; count?: number; error?: string } | null>(null)
  const [formResult, setFormResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)

  const set = (key: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const input = "w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 rounded-xl px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white dark:focus:bg-gray-750"

  /* ── CSV ── */

  type CsvRow = { [key: string]: string }

  const processFile = (file: File) => {
    setLoading(true)
    setCsvResult(null)

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data.map((row) => {
          const entry: Record<string, unknown> = {
            Horodatage: row["Horodatage"] || row["Date"] || null,
            "Identifiant de transaction": row["Identifiant de transaction"] || null,
            "Type de transaction": row["Type de transaction"] || null,
            "Montant net": row["Montant net"] !== undefined ? Number(row["Montant net"]) : null,
            "Montant brut": row["Montant brut"] !== undefined ? Number(row["Montant brut"]) : null,
            Frais: row["Frais"] !== undefined ? Number(row["Frais"]) : null,
            Solde: row["Solde"] !== undefined ? Number(row["Solde"]) : null,
            Devise: row["Devise"] || "XOF",
            "Nom de contrepartie": row["Nom de contrepartie"] || null,
            "Numéro de téléphone de contrepartie": row["Numéro de téléphone de contrepartie"] || null,
            "Nom d'utilisateur": row["Nom d'utilisateur"] || null,
            "Numéro de téléphone d'utilisateur": row["Numéro de téléphone d'utilisateur"] || null,
          }
          if (row["id_recette"]) entry.id_recette = Number(row["id_recette"])
          return entry
        })

        const res = await fetch("/api/recettes/import", {
          method: "POST",
          body: JSON.stringify(rows),
        })
        const data = await res.json()
        setLoading(false)

        if (data.success) {
          setCsvResult({ success: true, count: data.count })
          setTimeout(() => router.push("/recettes"), 2500)
        } else {
          setCsvResult({ success: false, error: data.error })
        }
      },
    })
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.name.endsWith(".csv")) processFile(file)
  }

  /* ── Manuel ── */

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault()
    setLoading(true)
    setFormResult(null)

    const payload: Record<string, unknown> = {
      Horodatage: form.Horodatage || null,
      "Identifiant de transaction": form["Identifiant de transaction"] || null,
      "Type de transaction": form["Type de transaction"] || null,
      "Montant net": form["Montant net"] !== "" ? Number(form["Montant net"]) : null,
      "Montant brut": form["Montant brut"] !== "" ? Number(form["Montant brut"]) : null,
      Frais: form.Frais !== "" ? Number(form.Frais) : null,
      Solde: form.Solde !== "" ? Number(form.Solde) : null,
      Devise: form.Devise || "XOF",
      "Nom de contrepartie": form["Nom de contrepartie"] || null,
      "Numéro de téléphone de contrepartie": form["Numéro de téléphone de contrepartie"] || null,
      "Nom d'utilisateur": form["Nom d'utilisateur"] || null,
      "Numéro de téléphone d'utilisateur": form["Numéro de téléphone d'utilisateur"] || null,
      date_paiement: form.date_paiement || null,
      telephone_chauffeur: form.telephone_chauffeur || null,
      date_travail: form.date_travail || null,
    }
    if (form.id_recette !== "") payload.id_recette = Number(form.id_recette)

    const res = await fetch("/api/recettes/create", {
      method: "POST",
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    setLoading(false)

    if (data.success) {
      router.push("/recettes")
    } else {
      setFormResult({ success: false, error: data.error })
    }
  }

  /* ── CSV columns ── */

  const csvColumns = [
    "Horodatage", "Identifiant de transaction", "Type de transaction",
    "Montant net", "Montant brut", "Frais", "Solde", "Devise",
    "Nom de contrepartie", "Numéro de téléphone de contrepartie",
    "Nom d'utilisateur", "Numéro de téléphone d'utilisateur",
  ]

  /* ─────────────── RENDER ─────────────── */

  return (
    <div className="min-h-screen pb-32">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        {/* ── HEADER ── */}
        <div className="flex items-start gap-4">
          <Link
            href="/recettes"
            className="mt-1 flex items-center justify-center w-9 h-9 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-600 transition shadow-sm"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
              Ajouter des recettes
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Table <span className="font-mono text-indigo-500 text-xs bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">recettes_wave</span>
            </p>
          </div>
        </div>

        {/* ── TABS ── */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl">
          <button
            onClick={() => setTab("csv")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all duration-200
              ${tab === "csv"
                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
          >
            <Upload size={15} />
            Import CSV
          </button>
          <button
            onClick={() => setTab("manuel")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all duration-200
              ${tab === "manuel"
                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
          >
            <PlusCircle size={15} />
            Saisie manuelle
          </button>
        </div>

        {/* ══════════════════════ TAB CSV ══════════════════════ */}
        {tab === "csv" && (
          <div className="space-y-4">

            {/* Colonnes Wave */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-3">
              <div className="flex items-center gap-2">
                <FileText size={15} className="text-purple-500" />
                <span className="text-sm font-semibold text-gray-800 dark:text-white">
                  Colonnes attendues dans l&apos;export Wave
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {csvColumns.map((col) => (
                  <span
                    key={col}
                    className="inline-flex items-center px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-[11px] font-mono font-medium border border-purple-100 dark:border-purple-800"
                  >
                    {col}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                <CheckCircle size={11} className="text-green-500 flex-shrink-0" />
                Les doublons (même &quot;Identifiant de transaction&quot;) sont automatiquement ignorés.
              </p>
            </div>

            {/* Zone upload */}
            <label
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center gap-3 min-h-[220px] rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200
                ${loading
                  ? "opacity-60 cursor-not-allowed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
                  : dragOver
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 scale-[1.01]"
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-purple-400 dark:hover:border-purple-600 hover:bg-purple-50/50 dark:hover:bg-purple-900/10"
                }`}
            >
              <div className={`flex items-center justify-center w-16 h-16 rounded-2xl transition-colors
                ${dragOver ? "bg-purple-100 dark:bg-purple-800" : "bg-gray-100 dark:bg-gray-800"}`}>
                <Upload size={28} className={`transition-colors ${dragOver ? "text-purple-600" : "text-gray-400"}`} />
              </div>

              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-gray-800 dark:text-white">
                  {loading ? "Import en cours..." : "Déposer votre fichier ici"}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  ou <span className="text-purple-600 dark:text-purple-400 font-medium">cliquer pour parcourir</span>
                </p>
                <p className="text-[11px] text-gray-400">Format .csv — export Wave</p>
              </div>

              <input
                type="file"
                accept=".csv"
                className="hidden"
                disabled={loading}
                onChange={handleFileInput}
              />
            </label>

            {/* Résultat */}
            {csvResult && (
              <div className={`flex items-center gap-3 p-4 rounded-2xl border text-sm font-medium
                ${csvResult.success
                  ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
                  : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
                }`}>
                {csvResult.success
                  ? (
                    <>
                      <CheckCircle size={18} className="flex-shrink-0" />
                      <div>
                        <p className="font-semibold">{csvResult.count} recettes importées avec succès</p>
                        <p className="text-xs opacity-75 mt-0.5">Redirection vers la liste...</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={18} className="flex-shrink-0" />
                      <div>
                        <p className="font-semibold">Erreur lors de l&apos;import</p>
                        <p className="text-xs opacity-75 mt-0.5">{csvResult.error}</p>
                      </div>
                    </>
                  )
                }
              </div>
            )}

          </div>
        )}

        {/* ══════════════════════ TAB MANUEL ══════════════════════ */}
        {tab === "manuel" && (
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* ── Section 1 : Identification ── */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-5">

              <SectionHeader icon={Hash} label="Identification" color="bg-indigo-500" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                <Field label="ID recette">
                  <input
                    type="number"
                    placeholder="Généré automatiquement"
                    className={input}
                    value={form.id_recette}
                    onChange={(e) => set("id_recette", e.target.value)}
                  />
                </Field>

                <Field label="Identifiant de transaction">
                  <input
                    type="text"
                    placeholder="ex : TXN_XXXXXXXXXXXX"
                    className={input}
                    value={form["Identifiant de transaction"]}
                    onChange={(e) => set("Identifiant de transaction", e.target.value)}
                  />
                </Field>

                <Field label="Horodatage" required>
                  <input
                    type="datetime-local"
                    required
                    className={input}
                    value={form.Horodatage}
                    onChange={(e) => set("Horodatage", e.target.value)}
                  />
                </Field>

                <Field label="Type de transaction">
                  <input
                    type="text"
                    placeholder="ex : Retrait, Dépôt..."
                    className={input}
                    value={form["Type de transaction"]}
                    onChange={(e) => set("Type de transaction", e.target.value)}
                  />
                </Field>

              </div>
            </div>

            {/* ── Section 2 : Montants ── */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-5">

              <SectionHeader icon={Banknote} label="Montants" color="bg-emerald-500" />

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">

                <Field label="Montant net (FCFA)" required>
                  <input
                    type="number"
                    required
                    placeholder="0"
                    className={input}
                    value={form["Montant net"]}
                    onChange={(e) => set("Montant net", e.target.value)}
                  />
                </Field>

                <Field label="Montant brut (FCFA)">
                  <input
                    type="number"
                    placeholder="0"
                    className={input}
                    value={form["Montant brut"]}
                    onChange={(e) => set("Montant brut", e.target.value)}
                  />
                </Field>

                <Field label="Frais (FCFA)">
                  <input
                    type="number"
                    placeholder="0"
                    className={input}
                    value={form.Frais}
                    onChange={(e) => set("Frais", e.target.value)}
                  />
                </Field>

                <Field label="Solde après transaction">
                  <input
                    type="number"
                    placeholder="0"
                    className={input}
                    value={form.Solde}
                    onChange={(e) => set("Solde", e.target.value)}
                  />
                </Field>

                <Field label="Devise">
                  <input
                    type="text"
                    placeholder="XOF"
                    className={input}
                    value={form.Devise}
                    onChange={(e) => set("Devise", e.target.value)}
                  />
                </Field>

              </div>
            </div>

            {/* ── Section 3 : Contrepartie ── */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-5">

              <SectionHeader icon={User} label="Contrepartie & Utilisateur" color="bg-blue-500" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                <Field label="Nom de contrepartie">
                  <input
                    type="text"
                    placeholder="Nom complet"
                    className={input}
                    value={form["Nom de contrepartie"]}
                    onChange={(e) => set("Nom de contrepartie", e.target.value)}
                  />
                </Field>

                <Field label="Téléphone de contrepartie">
                  <input
                    type="tel"
                    placeholder="+225 XX XX XX XX XX"
                    className={input}
                    value={form["Numéro de téléphone de contrepartie"]}
                    onChange={(e) => set("Numéro de téléphone de contrepartie", e.target.value)}
                  />
                </Field>

                <Field label="Nom d'utilisateur">
                  <input
                    type="text"
                    placeholder="Nom complet"
                    className={input}
                    value={form["Nom d'utilisateur"]}
                    onChange={(e) => set("Nom d'utilisateur", e.target.value)}
                  />
                </Field>

                <Field label="Téléphone d'utilisateur">
                  <input
                    type="tel"
                    placeholder="+225 XX XX XX XX XX"
                    className={input}
                    value={form["Numéro de téléphone d'utilisateur"]}
                    onChange={(e) => set("Numéro de téléphone d'utilisateur", e.target.value)}
                  />
                </Field>

              </div>
            </div>

            {/* ── Section 4 : Chauffeur ── */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-5">

              <div className="flex items-center justify-between">
                <SectionHeader icon={Phone} label="Données chauffeur" color="bg-orange-500" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                  Optionnel
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                <Field label="Téléphone chauffeur">
                  <input
                    type="tel"
                    placeholder="+225 XX XX XX XX XX"
                    className={input}
                    value={form.telephone_chauffeur}
                    onChange={(e) => set("telephone_chauffeur", e.target.value)}
                  />
                </Field>

                <Field label="Date de paiement">
                  <input
                    type="date"
                    className={input}
                    value={form.date_paiement}
                    onChange={(e) => set("date_paiement", e.target.value)}
                  />
                </Field>

                <Field label="Date de travail">
                  <input
                    type="date"
                    className={input}
                    value={form.date_travail}
                    onChange={(e) => set("date_travail", e.target.value)}
                  />
                </Field>

              </div>
            </div>

            {/* Erreur */}
            {formResult && !formResult.success && (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                <AlertCircle size={18} className="flex-shrink-0" />
                <div>
                  <p className="font-semibold">Erreur lors de l&apos;enregistrement</p>
                  <p className="text-xs opacity-75 mt-0.5">{formResult.error}</p>
                </div>
              </div>
            )}

            {/* Boutons — visible seulement sur desktop dans le flow normal */}
            <div className="hidden sm:flex items-center justify-between pt-2">
              <Link href="/recettes">
                <button type="button" className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition shadow-sm">
                  Annuler
                </button>
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold transition shadow-sm flex items-center gap-2"
              >
                {loading
                  ? <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enregistrement...</>
                  : <><Tag size={15} /> Enregistrer la recette</>
                }
              </button>
            </div>

          </form>
        )}

      </div>

      {/* ── BARRE D'ACTION STICKY MOBILE ── */}
      {tab === "manuel" && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-4 py-3 flex gap-3 shadow-2xl">
          <Link href="/recettes" className="flex-1">
            <button type="button" className="w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium">
              Annuler
            </button>
          </Link>
          <button
            type="submit"
            form="recette-form"
            disabled={loading}
            onClick={handleSubmit}
            className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2"
          >
            {loading
              ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : "Enregistrer"
            }
          </button>
        </div>
      )}

    </div>
  )
}
