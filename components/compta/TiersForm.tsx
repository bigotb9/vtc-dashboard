"use client"

/**
 * Formulaire complet de création / modification d'un tiers
 * (Phase 4.x Vague 2 §3.3 + §3.5).
 *
 * 4 sections :
 *   1. Identité (nom required + type radio pills + téléphone + email + adresse)
 *   2. Entreprise (collapsible : raison sociale + RCCM + contribuable)
 *   3. Comptabilité (parent SYSCOHADA auto + suffixe live suggéré + dispo)
 *   4. Notes (textarea libre)
 *
 * Mode = "create" → on appelle POST via le hook parent (avec le suffix_manuel).
 * Mode = "edit"   → on PATCH les champs modifiés.
 */

import { useEffect, useState } from "react"
import { Loader2, ChevronDown, Check, AlertTriangle } from "lucide-react"
import { TiersTypeBadge } from "@/components/compta/TiersTypeBadge"
import { useSuggestSuffix } from "@/hooks/compta/useSuggestSuffix"
import {
  TIERS_SYSCOHADA_PARENT,
  type TiersDetail,
  type TiersPayload,
  type TiersType,
  type TiersUpdatePayload,
} from "@/types/compta-ui"

type Mode = "create" | "edit"

type FormState = {
  nom:                 string
  type:                TiersType
  telephone:           string
  email:               string
  adresse:             string
  raison_sociale:      string
  numero_rccm:         string
  numero_contribuable: string
  suffix_manuel:       string         // "" → auto
  notes:               string
}

function emptyState(): FormState {
  return {
    nom: "", type: "fournisseur",
    telephone: "", email: "", adresse: "",
    raison_sociale: "", numero_rccm: "", numero_contribuable: "",
    suffix_manuel: "", notes: "",
  }
}

function fromDetail(d: TiersDetail): FormState {
  return {
    nom:                 d.nom,
    type:                d.type,
    telephone:           d.telephone           ?? "",
    email:               d.email               ?? "",
    adresse:             d.adresse             ?? "",
    raison_sociale:      d.raison_sociale      ?? "",
    numero_rccm:         d.numero_rccm         ?? "",
    numero_contribuable: d.numero_contribuable ?? "",
    suffix_manuel:       d.compte_syscohada_suffix ?? "",
    notes:               d.notes               ?? "",
  }
}

const TYPE_OPTIONS: TiersType[] = ["client", "fournisseur", "salarie", "autre"]

type CreateProps = {
  mode:    "create"
  initial?: undefined
  loading:  boolean
  onSubmit: (payload: TiersPayload) => void
  onCancel?: () => void
}
type EditProps = {
  mode:    "edit"
  initial: TiersDetail
  loading:  boolean
  onSubmit: (patch: TiersUpdatePayload) => void
  onCancel?: () => void
}

export function TiersForm(props: CreateProps | EditProps) {
  const { mode, loading, onSubmit, onCancel } = props
  const [s, setS] = useState<FormState>(mode === "edit" ? fromDetail(props.initial) : emptyState())
  const [showEntreprise, setShowEntreprise] = useState(
    mode === "edit" && (!!props.initial.raison_sociale || !!props.initial.numero_rccm || !!props.initial.numero_contribuable)
  )
  const [suffixDirty, setSuffixDirty] = useState(mode === "edit" && !!s.suffix_manuel)

  // ─── Suggest suffix live (mode create + edit avec nom modifié) ─────────────
  const suggest = useSuggestSuffix(s.nom, s.type, 200)
  // Quand l'utilisateur n'a pas encore édité le suffixe, on adopte la suggestion
  useEffect(() => {
    if (mode === "create" && !suffixDirty && suggest.data) {
      // Préfère "GA1" si "GA" pris ET qu'il y a des alternatives
      const next = suggest.data.disponible
        ? suggest.data.suffix_suggere
        : (suggest.data.alternatives[0] ?? suggest.data.suffix_suggere)
      setS(prev => ({ ...prev, suffix_manuel: next }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggest.data?.suffix_suggere, suggest.data?.disponible, suffixDirty, mode])

  const parent = TIERS_SYSCOHADA_PARENT[s.type]
  const codeFinal = s.suffix_manuel ? `${parent}-${s.suffix_manuel.toUpperCase()}` : parent
  const disabled = loading || s.nom.trim().length < 2

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (disabled) return
    if (mode === "create") {
      const payload: TiersPayload = {
        nom:                  s.nom.trim(),
        type:                 s.type,
        telephone:            s.telephone.trim()           || null,
        email:                s.email.trim()               || null,
        adresse:              s.adresse.trim()             || null,
        raison_sociale:       s.raison_sociale.trim()      || null,
        numero_rccm:          s.numero_rccm.trim()         || null,
        numero_contribuable:  s.numero_contribuable.trim() || null,
        suffix_manuel:        suffixDirty && s.suffix_manuel.trim() ? s.suffix_manuel.trim() : null,
        notes:                s.notes.trim()               || null,
      }
      onSubmit(payload)
    } else {
      // PATCH : envoie tout (le backend nullify les chaînes vides)
      const initial = fromDetail(props.initial)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patch: TiersUpdatePayload & Record<string, any> = {}
      // Les champs "type" et "nom" sont stricts (jamais null)
      if (s.type !== initial.type) patch.type = s.type
      if (s.nom !== initial.nom) patch.nom = s.nom.trim()
      ;(["telephone","email","adresse","raison_sociale","numero_rccm","numero_contribuable","notes"] as const)
        .forEach(k => { if (s[k] !== initial[k]) patch[k] = (s[k] || null) as string | null })
      if (s.suffix_manuel.trim() !== (initial.suffix_manuel ?? "").trim()) {
        patch.suffix_manuel = s.suffix_manuel.trim() || null
      }
      onSubmit(patch)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Section 1 — Identité */}
      <Section title="Identité">
        <Field label="Nom" required>
          <input
            type="text" value={s.nom}
            onChange={e => setS({ ...s, nom: e.target.value })}
            placeholder="Ex: Garage Atta Mécanique"
            className={inputCls}
            minLength={2} maxLength={200} required
          />
        </Field>
        <Field label="Type" required>
          <div className="flex flex-wrap gap-1.5">
            {TYPE_OPTIONS.map(t => (
              <button
                key={t} type="button"
                onClick={() => setS({ ...s, type: t })}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition ${
                  s.type === t
                    ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/30"
                    : "bg-gray-100 dark:bg-white/[0.05] text-gray-600 dark:text-gray-300 hover:bg-indigo-500/10"
                }`}
              >
                <TiersTypeBadge type={t} size="xs" />
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Téléphone">
            <input type="tel" value={s.telephone} onChange={e => setS({ ...s, telephone: e.target.value })} placeholder="+225 07 12 34 56 78" className={inputCls} maxLength={30} />
          </Field>
          <Field label="Email">
            <input type="email" value={s.email} onChange={e => setS({ ...s, email: e.target.value })} placeholder="contact@…" className={inputCls} maxLength={120} />
          </Field>
        </div>
        <Field label="Adresse">
          <input type="text" value={s.adresse} onChange={e => setS({ ...s, adresse: e.target.value })} placeholder="Marcory Zone 4, Abidjan" className={inputCls} maxLength={500} />
        </Field>
      </Section>

      {/* Section 2 — Entreprise (collapsible) */}
      <details className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06]" open={showEntreprise}>
        <summary
          onClick={e => { e.preventDefault(); setShowEntreprise(v => !v) }}
          className="cursor-pointer select-none px-4 py-3 flex items-center justify-between"
        >
          <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
            Données entreprise (optionnel)
          </span>
          <ChevronDown size={14} className={`text-gray-400 transition ${showEntreprise ? "rotate-180" : ""}`} />
        </summary>
        <div className="px-4 pb-4 space-y-3">
          <Field label="Raison sociale">
            <input type="text" value={s.raison_sociale} onChange={e => setS({ ...s, raison_sociale: e.target.value })} placeholder="Garage Atta SARL" className={inputCls} maxLength={200} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="N° RCCM">
              <input type="text" value={s.numero_rccm} onChange={e => setS({ ...s, numero_rccm: e.target.value })} placeholder="CI-ABJ-2024-A-9876" className={inputCls} maxLength={60} />
            </Field>
            <Field label="N° contribuable">
              <input type="text" value={s.numero_contribuable} onChange={e => setS({ ...s, numero_contribuable: e.target.value })} placeholder="9876543 X" className={inputCls} maxLength={60} />
            </Field>
          </div>
        </div>
      </details>

      {/* Section 3 — Comptabilité (suggest live) */}
      <Section title="Comptabilité">
        <div className="rounded-xl bg-violet-500/5 border border-violet-500/15 p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-300">
                Compte SYSCOHADA généré
              </div>
              <div className="mt-1 text-lg font-black font-mono tabular-nums text-violet-700 dark:text-violet-300">
                {codeFinal}
              </div>
            </div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 text-right max-w-[180px]">
              Parent <span className="font-mono font-bold">{parent}</span> auto selon le type
              · Suffixe modifiable
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] font-bold uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400 mb-1.5">
                Suffixe (auto / manuel)
              </label>
              <div className="relative">
                <input
                  type="text" value={s.suffix_manuel}
                  onChange={e => { setS({ ...s, suffix_manuel: e.target.value.toUpperCase() }); setSuffixDirty(true) }}
                  placeholder="GA"
                  className={`${inputCls} font-mono uppercase`}
                  maxLength={8} pattern="[A-Z0-9]{1,8}"
                />
                {suggest.loading && (
                  <Loader2 size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
                )}
              </div>
              {!suffixDirty && suggest.data && (
                <div className="mt-1 text-[10.5px] text-gray-500 dark:text-gray-400">
                  Suggéré <span className="font-mono font-bold">{suggest.data.suffix_suggere}</span>
                  {suggest.data.disponible
                    ? <span className="text-emerald-600 dark:text-emerald-400 ml-1">· disponible</span>
                    : <span className="text-amber-600 dark:text-amber-400 ml-1">· pris, alt. {suggest.data.alternatives.join(", ")}</span>
                  }
                </div>
              )}
              {suffixDirty && suggest.data && s.suffix_manuel.toUpperCase() === suggest.data.suffix_suggere && !suggest.data.disponible && (
                <div className="mt-1 flex items-start gap-1 text-[10.5px] text-amber-600 dark:text-amber-400">
                  <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                  <span>Ce suffixe est déjà utilisé par un autre tiers actif.</span>
                </div>
              )}
              {suffixDirty && (
                <button
                  type="button"
                  onClick={() => { setSuffixDirty(false); if (suggest.data) setS(prev => ({ ...prev, suffix_manuel: suggest.data!.suffix_suggere })) }}
                  className="mt-1 text-[10.5px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Re-suggérer automatiquement
                </button>
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* Section 4 — Notes */}
      <Section title="Notes">
        <Field label="Notes libres">
          <textarea
            value={s.notes} onChange={e => setS({ ...s, notes: e.target.value })}
            rows={3} maxLength={4000}
            placeholder="Infos additionnelles, historique relation, etc."
            className={`${inputCls} resize-y min-h-[80px]`}
          />
        </Field>
      </Section>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04] transition disabled:opacity-50">
            Annuler
          </button>
        )}
        <button type="submit" disabled={disabled}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white text-sm font-semibold shadow-md shadow-indigo-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {loading ? "Enregistrement…" : (mode === "create" ? "Créer le tiers" : "Enregistrer")}
        </button>
      </div>
    </form>
  )
}

// ─── Sous-éléments ─────────────────────────────────────────────────────────
const inputCls = "w-full px-3 py-2 rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/60 transition"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-4 space-y-3">
      <h3 className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10.5px] font-bold uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
