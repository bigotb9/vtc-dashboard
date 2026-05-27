"use client"

/**
 * Étape 3 — Infos société optionnelles (Écran 9 §3.3).
 * Champs pré-remplis depuis BD si disponibles. Validation email côté client.
 */

import { Building2 } from "lucide-react"

export type SocieteWizardForm = {
  raison_sociale:  string
  telephone:       string
  email_comptable: string
}

type Props = {
  value:    SocieteWizardForm
  onChange: (next: SocieteWizardForm) => void
  /** Erreur email format inline. */
  emailError?: string | null
}

const inputCls = (err: boolean) =>
  `w-full rounded-xl border bg-white dark:bg-white/[0.02] px-3 py-2.5 text-sm text-gray-900 dark:text-white transition focus:outline-none focus:ring-2 ${
    err
      ? "border-red-400 dark:border-red-500/50 focus:ring-red-500/30"
      : "border-gray-200/70 dark:border-white/[0.08] focus:ring-emerald-500/30 focus:border-emerald-400"
  }`

export function OnboardingStep3Societe({ value, onChange, emailError }: Props) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-md shadow-amber-500/30 flex-shrink-0">
          <Building2 size={18} />
        </div>
        <div>
          <h2 className="text-xl font-black tracking-tight text-gray-900 dark:text-white">
            Renseignez vos informations société
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-snug">
            Ces informations apparaîtront sur vos exports PDF et états comptables.{" "}
            <strong className="text-gray-700 dark:text-gray-300">Optionnel</strong> — vous pouvez
            passer cette étape.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Raison sociale" hint="Nom légal de l'entreprise" colSpan={2}>
          <input
            type="text"
            value={value.raison_sociale}
            onChange={e => onChange({ ...value, raison_sociale: e.target.value })}
            maxLength={120}
            placeholder="Ex : Boyah Group SARL"
            className={inputCls(false)}
          />
        </Field>

        <Field label="Téléphone">
          <input
            type="tel"
            value={value.telephone}
            onChange={e => onChange({ ...value, telephone: e.target.value })}
            maxLength={30}
            placeholder="+225 XX XX XX XX"
            className={inputCls(false)}
          />
        </Field>

        <Field label="Email comptable" error={emailError ?? undefined}>
          <input
            type="email"
            value={value.email_comptable}
            onChange={e => onChange({ ...value, email_comptable: e.target.value })}
            placeholder="compta@boyahgroup.com"
            className={inputCls(!!emailError)}
          />
        </Field>
      </div>

      <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug">
        Les autres informations (N° RCCM, N° contribuable, adresse fiscale) pourront être
        renseignées depuis les <strong>Paramètres</strong>.
      </p>
    </div>
  )
}

function Field({
  label, hint, error, colSpan, children,
}: {
  label: string; hint?: string; error?: string; colSpan?: number; children: React.ReactNode
}) {
  return (
    <div className={colSpan === 2 ? "md:col-span-2" : ""}>
      <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em] mb-1.5">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">{hint}</p>}
      {error && <p className="mt-1 text-[11px] font-semibold text-red-500">{error}</p>}
    </div>
  )
}
