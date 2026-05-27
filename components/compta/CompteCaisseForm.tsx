"use client"

/**
 * Formulaire création/modification partagé caisse/compte (Écran 5 §4.1).
 *
 * Champs : libellé, type_cible (radio caisse/compte), code interne, sous-type
 * (cash/mobile_money pour caisse), opérateur (si mobile_money), banque (si
 * compte), numéro, compte SYSCOHADA (filtré classe 5), description, actif.
 *
 * Sur modification, type_cible est figé (on ne peut pas convertir une caisse
 * en compte ou inversement — change d'endpoint API).
 */

import { useEffect, useState } from "react"
import { Coins, Landmark, Loader2, Save } from "lucide-react"
import { SyscohadaSelector } from "@/components/compta/SyscohadaSelector"
import type { CompteCaisseFormInput } from "@/types/compta-ui"

type Props = {
  /** Mode du formulaire : create ou edit. */
  mode:        "create" | "edit"
  initial?:    Partial<CompteCaisseFormInput>
  loading?:    boolean
  serverError?: string | null
  onSubmit:    (input: CompteCaisseFormInput) => void
  onCancel:    () => void
}

const OPERATEURS = ["Wave", "Orange Money", "MTN MoMo", "Moov Money"]

function defaultInput(): CompteCaisseFormInput {
  return {
    type_cible:             "caisse",
    libelle:                "",
    code:                   null,
    type:                   "mobile_money",
    operateur:              null,
    banque:                 null,
    numero:                 null,
    compte_syscohada_code:  null,
    description:            null,
    actif:                  true,
  }
}

export function CompteCaisseForm({ mode, initial, loading, serverError, onSubmit, onCancel }: Props) {
  const [input, setInput] = useState<CompteCaisseFormInput>(() => ({
    ...defaultInput(),
    ...(initial ?? {}),
  }))
  const [errors, setErrors] = useState<Partial<Record<keyof CompteCaisseFormInput, string>>>({})

  // Reset lorsque initial change (passage de loading false → true sur edit)
  useEffect(() => {
    if (initial) setInput(prev => ({ ...prev, ...initial }))
  }, [initial])

  const isCaisse = input.type_cible === "caisse"

  function update<K extends keyof CompteCaisseFormInput>(k: K, v: CompteCaisseFormInput[K]) {
    setInput(prev => ({ ...prev, [k]: v }))
    setErrors(prev => { const next = { ...prev }; delete next[k]; return next })
  }

  function validate(): boolean {
    const e: typeof errors = {}
    if (!input.libelle || input.libelle.trim().length < 3) e.libelle = "Min 3 caractères"
    if (input.libelle && input.libelle.length > 100)       e.libelle = "Max 100 caractères"
    if (input.code && !/^[a-z0-9_]+$/.test(input.code))    e.code    = "snake_case (a-z, 0-9, _)"
    if (input.code && input.code.length > 40)              e.code    = "Max 40 caractères"
    if (isCaisse && input.type === "mobile_money" && !input.operateur) {
      e.operateur = "Opérateur obligatoire pour mobile money"
    }
    if (isCaisse && input.type === "cash" && input.operateur) {
      e.operateur = "Une caisse cash ne doit pas avoir d'opérateur"
    }
    if (!input.compte_syscohada_code) e.compte_syscohada_code = "Obligatoire"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validate()) return
    onSubmit(input)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Type cible */}
      <Section title="Type de contenant" accent="violet">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <RadioCard
            active={isCaisse}
            disabled={mode === "edit"}
            onClick={() => update("type_cible", "caisse")}
            Icon={Coins}
            title="Caisse"
            sub="Cash en main ou mobile money"
            accent="emerald"
          />
          <RadioCard
            active={!isCaisse}
            disabled={mode === "edit"}
            onClick={() => update("type_cible", "compte")}
            Icon={Landmark}
            title="Compte bancaire"
            sub="SGCI, Ecobank, NSIA…"
            accent="violet"
          />
        </div>
        {mode === "edit" && (
          <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500 italic">
            Le type de contenant ne peut pas être modifié après création.
          </p>
        )}
      </Section>

      {/* Infos principales */}
      <Section title="Informations" accent="emerald">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Libellé" required error={errors.libelle}>
            <input
              type="text"
              value={input.libelle}
              onChange={e => update("libelle", e.target.value)}
              maxLength={100}
              placeholder={isCaisse ? "Ex : Wave Boyah" : "Ex : SGCI Compte courant"}
              className={inputCls(!!errors.libelle)}
            />
          </Field>
          <Field label="Code interne" hint="snake_case (a-z, 0-9, _)" error={errors.code}>
            <input
              type="text"
              value={input.code ?? ""}
              onChange={e => update("code", e.target.value.toLowerCase() || null)}
              maxLength={40}
              placeholder={isCaisse ? "wave, orange_money…" : "sgci, ecobank…"}
              className={`${inputCls(!!errors.code)} font-mono`}
            />
          </Field>
        </div>

        {isCaisse && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Sous-type">
              <div className="flex bg-gray-100 dark:bg-white/[0.04] rounded-lg p-1">
                {(["cash", "mobile_money"] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      update("type", t)
                      if (t === "cash") update("operateur", null)
                    }}
                    className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                      input.type === t
                        ? "bg-white dark:bg-white/[0.08] text-violet-600 dark:text-violet-400 shadow-sm"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {t === "cash" ? "Cash" : "Mobile money"}
                  </button>
                ))}
              </div>
            </Field>
            {input.type === "mobile_money" && (
              <Field label="Opérateur" required error={errors.operateur}>
                <select
                  value={input.operateur ?? ""}
                  onChange={e => update("operateur", e.target.value || null)}
                  className={inputCls(!!errors.operateur)}
                >
                  <option value="">— Sélectionner —</option>
                  {OPERATEURS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
            )}
          </div>
        )}

        {!isCaisse && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Banque" hint="Nom de l'établissement bancaire">
              <input
                type="text"
                value={input.banque ?? ""}
                onChange={e => update("banque", e.target.value || null)}
                placeholder="SGCI, Ecobank, NSIA…"
                className={inputCls(false)}
              />
            </Field>
            <Field label="Numéro de compte" hint="Optionnel">
              <input
                type="text"
                value={input.numero ?? ""}
                onChange={e => update("numero", e.target.value || null)}
                placeholder="…"
                className={`${inputCls(false)} font-mono`}
              />
            </Field>
          </div>
        )}

        {isCaisse && input.type === "mobile_money" && (
          <Field label="Numéro mobile money" hint="Optionnel">
            <input
              type="text"
              value={input.numero ?? ""}
              onChange={e => update("numero", e.target.value || null)}
              placeholder="07 00 00 00 00"
              className={`${inputCls(false)} font-mono`}
            />
          </Field>
        )}
      </Section>

      {/* Mapping SYSCOHADA */}
      <Section title="Mapping comptable" accent="violet">
        <SyscohadaSelector
          value={input.compte_syscohada_code}
          onChange={code => update("compte_syscohada_code", code)}
          error={errors.compte_syscohada_code}
          required
        />
      </Section>

      {/* Description */}
      <Section title="Description" accent="amber">
        <textarea
          value={input.description ?? ""}
          onChange={e => update("description", e.target.value || null)}
          maxLength={500}
          rows={3}
          placeholder="Notes libres sur ce contenant…"
          className={`${inputCls(false)} min-h-[80px] resize-y`}
        />
        <p className="text-[10.5px] text-gray-400 dark:text-gray-500 mt-1 text-right tabular-nums">
          {(input.description?.length ?? 0)}/500
        </p>
      </Section>

      {/* Actif */}
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
            ? "Visible dans les sélecteurs de l'écran de saisie d'opération."
            : "Masqué dans les sélecteurs (mais conservé dans les écritures existantes)."}
        </p>
      </Section>

      {serverError && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-700 dark:text-red-300">
          {serverError}
        </div>
      )}

      {/* Footer actions */}
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

function Field({
  label, required, hint, error, children,
}: {
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

function RadioCard({
  active, disabled, onClick, Icon, title, sub, accent,
}: {
  active: boolean; disabled?: boolean; onClick: () => void
  Icon: React.ElementType; title: string; sub: string; accent: "emerald" | "violet"
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-left rounded-2xl border p-4 transition relative overflow-hidden ${
        active
          ? accent === "emerald"
            ? "bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/40 ring-2 ring-emerald-500/30"
            : "bg-violet-500/5 dark:bg-violet-500/10 border-violet-500/40 ring-2 ring-violet-500/30"
          : "bg-white dark:bg-white/[0.02] border-gray-200/70 dark:border-white/[0.06] hover:border-violet-300 dark:hover:border-violet-500/30"
      } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${
          active
            ? accent === "emerald"
              ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-emerald-500/40"
              : "bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-violet-500/40"
            : accent === "emerald"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-violet-500/10 text-violet-600 dark:text-violet-400"
        }`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black tracking-tight text-gray-900 dark:text-white">{title}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{sub}</p>
        </div>
      </div>
    </button>
  )
}
