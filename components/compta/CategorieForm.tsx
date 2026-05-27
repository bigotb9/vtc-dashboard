"use client"

/**
 * Formulaire création/modification partagé d'une catégorie (Écran 6 §4).
 *
 * Champs : libellé, type métier, sens (radio), SYSCOHADA (avec filtre classe),
 * journal par défaut (optionnel), description, actif (toggle).
 *
 * Validations frontend : libellé min 3 / max 100 ; type non vide ; sens non
 * vide ; SYSCOHADA obligatoire ; description max 500.
 */

import { useEffect, useState } from "react"
import { ArrowDownCircle, ArrowUpCircle, Loader2, Save } from "lucide-react"
import { TypeMetierSelector } from "@/components/compta/TypeMetierSelector"
import { SyscohadaClassFilter } from "@/components/compta/SyscohadaClassFilter"
import type { CategorieFormInput } from "@/types/compta-ui"

const JOURNAUX = [
  { code: "",   label: "— Par défaut OD —" },
  { code: "BQ", label: "BQ — Banque" },
  { code: "CA", label: "CA — Caisse" },
  { code: "AC", label: "AC — Achats" },
  { code: "VE", label: "VE — Ventes" },
  { code: "PA", label: "PA — Paie" },
  { code: "OD", label: "OD — Opérations diverses" },
]

type Props = {
  mode:         "create" | "edit"
  initial?:     Partial<CategorieFormInput>
  loading?:     boolean
  serverError?: string | null
  onSubmit:     (input: CategorieFormInput) => void
  onCancel:     () => void
}

function defaultInput(): CategorieFormInput {
  return {
    libelle:                "",
    type:                   "",
    sens:                   "credit",
    compte_syscohada_code:  null,
    journal_par_defaut:     null,
    description:            null,
    actif:                  true,
  }
}

export function CategorieForm({ mode, initial, loading, serverError, onSubmit, onCancel }: Props) {
  const [input,  setInput]  = useState<CategorieFormInput>(() => ({ ...defaultInput(), ...(initial ?? {}) }))
  const [errors, setErrors] = useState<Partial<Record<keyof CategorieFormInput, string>>>({})

  useEffect(() => {
    if (initial) setInput(prev => ({ ...prev, ...initial }))
  }, [initial])

  function update<K extends keyof CategorieFormInput>(k: K, v: CategorieFormInput[K]) {
    setInput(prev => ({ ...prev, [k]: v }))
    setErrors(prev => { const next = { ...prev }; delete next[k]; return next })
  }

  function validate(): boolean {
    const e: typeof errors = {}
    if (!input.libelle || input.libelle.trim().length < 3) e.libelle = "Min 3 caractères"
    if (input.libelle && input.libelle.length > 100)       e.libelle = "Max 100 caractères"
    if (!input.type)                                       e.type    = "Sélectionnez un type"
    if (!input.sens)                                       e.sens    = "Sélectionnez un sens"
    if (!input.compte_syscohada_code)                      e.compte_syscohada_code = "Obligatoire"
    if (input.description && input.description.length > 500) e.description = "Max 500 caractères"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    onSubmit({ ...input, libelle: input.libelle.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Section title="Identification" accent="emerald">
        <Field label="Libellé" required error={errors.libelle} hint="Texte court qui identifie la catégorie">
          <input
            type="text"
            value={input.libelle}
            onChange={e => update("libelle", e.target.value)}
            maxLength={100}
            placeholder="Ex : Fournitures bureau"
            className={inputCls(!!errors.libelle)}
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TypeMetierSelector
            value={input.type}
            onChange={t => update("type", t)}
            error={errors.type}
            required
          />
          <Field label="Sens comptable" required error={errors.sens}>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => update("sens", "credit")}
                className={`rounded-xl border p-3 text-left transition relative overflow-hidden ${
                  input.sens === "credit"
                    ? "bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/40 ring-2 ring-emerald-500/30"
                    : "bg-white dark:bg-white/[0.02] border-gray-200/70 dark:border-white/[0.06] hover:border-emerald-300 dark:hover:border-emerald-500/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    input.sens === "credit"
                      ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/30"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  }`}>
                    <ArrowDownCircle size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[12.5px] font-bold ${input.sens === "credit" ? "text-emerald-700 dark:text-emerald-300" : "text-gray-900 dark:text-white"}`}>
                      Crédit (Entrée)
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Recette, apport…</p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => update("sens", "debit")}
                className={`rounded-xl border p-3 text-left transition relative overflow-hidden ${
                  input.sens === "debit"
                    ? "bg-red-500/5 dark:bg-red-500/10 border-red-500/40 ring-2 ring-red-500/30"
                    : "bg-white dark:bg-white/[0.02] border-gray-200/70 dark:border-white/[0.06] hover:border-red-300 dark:hover:border-red-500/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    input.sens === "debit"
                      ? "bg-gradient-to-br from-red-500 to-rose-500 text-white shadow-md shadow-red-500/30"
                      : "bg-red-500/10 text-red-600 dark:text-red-400"
                  }`}>
                    <ArrowUpCircle size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[12.5px] font-bold ${input.sens === "debit" ? "text-red-700 dark:text-red-300" : "text-gray-900 dark:text-white"}`}>
                      Débit (Sortie)
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Dépense, charge…</p>
                  </div>
                </div>
              </button>
            </div>
          </Field>
        </div>
      </Section>

      <Section title="Mapping SYSCOHADA" accent="violet">
        <SyscohadaClassFilter
          value={input.compte_syscohada_code}
          onChange={code => update("compte_syscohada_code", code)}
          sens={input.sens}
          error={errors.compte_syscohada_code}
          required
        />
        <Field label="Journal par défaut" hint="Optionnel. Par défaut : OD (Opérations diverses)">
          <select
            value={input.journal_par_defaut ?? ""}
            onChange={e => update("journal_par_defaut", e.target.value || null)}
            className={inputCls(false)}
          >
            {JOURNAUX.map(j => <option key={j.code} value={j.code}>{j.label}</option>)}
          </select>
        </Field>
      </Section>

      <Section title="Description" accent="amber">
        <textarea
          value={input.description ?? ""}
          onChange={e => update("description", e.target.value || null)}
          maxLength={500}
          rows={3}
          placeholder="Notes libres sur cette catégorie…"
          className={`${inputCls(!!errors.description)} min-h-[80px] resize-y`}
        />
        <p className="text-[10.5px] text-gray-400 dark:text-gray-500 mt-1 text-right tabular-nums">
          {(input.description?.length ?? 0)}/500
        </p>
        {errors.description && <p className="mt-1 text-[11px] font-semibold text-red-500">{errors.description}</p>}
      </Section>

      <Section title="Statut" accent="cyan">
        <button
          type="button"
          onClick={() => update("actif", !input.actif)}
          className={`inline-flex items-center gap-2.5 px-3 py-2 rounded-xl border text-sm font-semibold transition ${
            input.actif
              ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
              : "bg-gray-100 dark:bg-white/[0.05] border-gray-300 dark:border-white/[0.10] text-gray-600 dark:text-gray-400"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${input.actif ? "bg-emerald-500" : "bg-gray-400"}`} />
          {input.actif ? "Actif" : "Inactif"}
        </button>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">
          {input.actif
            ? "Visible dans le sélecteur de catégorie de l'écran de saisie d'opération."
            : "Masquée dans le sélecteur (mais conservée dans les opérations existantes)."}
        </p>
      </Section>

      {serverError && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-700 dark:text-red-300">
          {serverError}
        </div>
      )}

      <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition disabled:opacity-50"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-sm font-semibold shadow-md shadow-emerald-500/30 transition disabled:opacity-40"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {mode === "create" ? "Créer" : "Enregistrer"}
        </button>
      </div>
    </form>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const inputCls = (err: boolean) =>
  `w-full rounded-xl border bg-white dark:bg-white/[0.02] px-3 py-2.5 text-sm text-gray-900 dark:text-white transition focus:outline-none focus:ring-2 ${
    err
      ? "border-red-400 dark:border-red-500/50 focus:ring-red-500/30"
      : "border-gray-200/70 dark:border-white/[0.08] focus:ring-violet-500/30 focus:border-violet-400"
  }`

function Field({ label, required, hint, error, children }: {
  label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em] mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">{hint}</p>}
      {error && <p className="mt-1 text-[11px] font-semibold text-red-500">{error}</p>}
    </div>
  )
}

type Accent = "emerald" | "violet" | "cyan" | "amber"
const ACCENT_BAR: Record<Accent, string> = {
  emerald: "from-transparent via-emerald-500 to-transparent",
  violet:  "from-transparent via-violet-500 to-transparent",
  cyan:    "from-transparent via-cyan-500 to-transparent",
  amber:   "from-transparent via-amber-500 to-transparent",
}
const ACCENT_TITLE: Record<Accent, string> = {
  emerald: "text-emerald-700 dark:text-emerald-300",
  violet:  "text-violet-700 dark:text-violet-300",
  cyan:    "text-cyan-700 dark:text-cyan-300",
  amber:   "text-amber-700 dark:text-amber-300",
}

function Section({ title, accent, children }: { title: string; accent: Accent; children: React.ReactNode }) {
  return (
    <div className="relative rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-5 space-y-4 overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${ACCENT_BAR[accent]}`} />
      <h2 className={`text-sm font-bold ${ACCENT_TITLE[accent]}`}>{title}</h2>
      {children}
    </div>
  )
}
