"use client"

/**
 * Section 4 — Informations société (Écran 7 §6).
 *
 * Formulaire éditable : raison sociale, RCCM, contribuable, adresse,
 * téléphone, email. Validation : raison sociale min 3, email format.
 * Bouton Enregistrer disabled tant que rien modifié.
 */

import { useEffect, useMemo, useState } from "react"
import { Building2, Save, Loader2 } from "lucide-react"
import { toast } from "@/lib/toast"
import type { ParametresPayload, SocieteInfo } from "@/types/compta-ui"

type Props = {
  data:    ParametresPayload | null
  loading?: boolean
  patching?: boolean
  onPatch: (update: Record<string, unknown>) => Promise<{ ok: true } | { ok: false; error: string }>
}

const EMPTY: SocieteInfo = {
  raison_sociale:      null,
  numero_rccm:         null,
  numero_contribuable: null,
  adresse_fiscale:     null,
  telephone:           null,
  email_comptable:     null,
}

export function SocieteSection({ data, loading, patching, onPatch }: Props) {
  const initial = data?.societe ?? EMPTY
  const [form, setForm] = useState<SocieteInfo>(initial)
  const [errors, setErrors] = useState<Partial<Record<keyof SocieteInfo, string>>>({})

  // Reset à chaque refresh des paramètres
  useEffect(() => { setForm(initial); setErrors({}) }, [data?.societe])

  function update<K extends keyof SocieteInfo>(k: K, v: SocieteInfo[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
    setErrors(prev => { const next = { ...prev }; delete next[k]; return next })
  }

  // Détection des changements
  const dirty = useMemo(() => {
    const keys = Object.keys(EMPTY) as (keyof SocieteInfo)[]
    return keys.some(k => (form[k] ?? null) !== (initial[k] ?? null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, data?.societe])

  function validate(): boolean {
    const e: typeof errors = {}
    if (form.raison_sociale && form.raison_sociale.trim().length < 3) {
      e.raison_sociale = "Min 3 caractères"
    }
    if (form.email_comptable && form.email_comptable.trim() !== "") {
      const v = form.email_comptable.trim()
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) e.email_comptable = "Email invalide"
    }
    if (form.adresse_fiscale && form.adresse_fiscale.length > 500) e.adresse_fiscale = "Max 500 caractères"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    // Build update : on n'envoie que les champs modifiés, avec normalisation (trim, vide → null)
    const update: Record<string, unknown> = {}
    const keys = Object.keys(EMPTY) as (keyof SocieteInfo)[]
    for (const k of keys) {
      const cur = form[k]
      const ini = initial[k]
      const cleaned = typeof cur === "string" ? (cur.trim() === "" ? null : cur.trim()) : cur
      if (cleaned !== (ini ?? null)) update[k] = cleaned
    }
    const res = await onPatch(update)
    if (res.ok) toast.success("Infos société enregistrées")
    else toast.error(res.error)
  }

  function handleCancel() {
    setForm(initial)
    setErrors({})
  }

  return (
    <section id="societe" className="relative rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-5 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent" />

      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-md shadow-amber-500/30 flex-shrink-0">
          <Building2 size={16} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-amber-700 dark:text-amber-300">Informations société</h2>
          <p className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
            Apparaîtra sur les exports comptables et documents officiels.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="h-64 rounded-xl animate-pulse bg-gray-100 dark:bg-white/[0.04]" />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Raison sociale" required error={errors.raison_sociale} hint="Nom légal de l'entreprise">
              <input
                type="text"
                value={form.raison_sociale ?? ""}
                onChange={e => update("raison_sociale", e.target.value || null)}
                maxLength={120}
                placeholder="Ex : Boyah Group SARL"
                className={inputCls(!!errors.raison_sociale)}
              />
            </Field>
            <Field label="N° RCCM" hint="Registre du Commerce et du Crédit Mobilier">
              <input
                type="text"
                value={form.numero_rccm ?? ""}
                onChange={e => update("numero_rccm", e.target.value || null)}
                maxLength={50}
                placeholder="CI-ABJ-2023-B-XXXXX"
                className={`${inputCls(false)} font-mono`}
              />
            </Field>

            <Field label="N° Contribuable" hint="Identifiant fiscal">
              <input
                type="text"
                value={form.numero_contribuable ?? ""}
                onChange={e => update("numero_contribuable", e.target.value || null)}
                maxLength={50}
                placeholder="1234567 X"
                className={`${inputCls(false)} font-mono`}
              />
            </Field>
            <Field label="Téléphone">
              <input
                type="tel"
                value={form.telephone ?? ""}
                onChange={e => update("telephone", e.target.value || null)}
                maxLength={30}
                placeholder="+225 XX XX XX XX"
                className={inputCls(false)}
              />
            </Field>

            <Field label="Email comptable" error={errors.email_comptable} hint="Adresse de contact pour les exports">
              <input
                type="email"
                value={form.email_comptable ?? ""}
                onChange={e => update("email_comptable", e.target.value || null)}
                placeholder="compta@boyahgroup.com"
                className={inputCls(!!errors.email_comptable)}
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Adresse fiscale" error={errors.adresse_fiscale}>
              <textarea
                value={form.adresse_fiscale ?? ""}
                onChange={e => update("adresse_fiscale", e.target.value || null)}
                rows={2}
                maxLength={500}
                placeholder="Adresse complète du siège social"
                className={`${inputCls(!!errors.adresse_fiscale)} min-h-[64px] resize-y`}
              />
              <p className="text-[10.5px] text-gray-400 dark:text-gray-500 mt-1 text-right tabular-nums">
                {(form.adresse_fiscale?.length ?? 0)}/500
              </p>
            </Field>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={!dirty || patching}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition disabled:opacity-40"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || patching}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-sm font-semibold shadow-md shadow-emerald-500/30 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {patching ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Enregistrer
            </button>
          </div>
        </>
      )}
    </section>
  )
}

const inputCls = (err: boolean) =>
  `w-full rounded-xl border bg-white dark:bg-white/[0.02] px-3 py-2.5 text-sm text-gray-900 dark:text-white transition focus:outline-none focus:ring-2 ${
    err
      ? "border-red-400 dark:border-red-500/50 focus:ring-red-500/30"
      : "border-gray-200/70 dark:border-white/[0.08] focus:ring-amber-500/30 focus:border-amber-400"
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
