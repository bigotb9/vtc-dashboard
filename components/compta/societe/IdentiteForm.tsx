"use client"

/**
 * Formulaire complet de paramètres société (Phase 4.2 Module 1 §2.1).
 *
 * 3 sections : Identité, Informations légales, Exercice par défaut.
 * Le logo est géré par <LogoUploader> en parallèle.
 *
 * Convention V2/V3 :
 *   - Pas d'overflow-hidden
 *   - XxxInput = local Zod, XxxPayload = API
 */

import { useState, useEffect } from "react"
import { Loader2, Check, Building2, FileText, Calendar, BookOpen, ShieldCheck } from "lucide-react"
import type {
  SocieteParametres, SocieteParametresPayload,
  SocieteFormeJuridique, SocieteRegimeFiscal,
} from "@/types/compta-ui"

type Props = {
  initial:    SocieteParametres | null
  loading:    boolean
  onSubmit:   (payload: SocieteParametresPayload) => Promise<void>
}

const FORMES: { value: SocieteFormeJuridique; label: string }[] = [
  { value: "SARL", label: "SARL" },
  { value: "SA",   label: "SA"   },
  { value: "SAS",  label: "SAS"  },
  { value: "SASU", label: "SASU" },
  { value: "EI",   label: "Entreprise individuelle" },
  { value: "SCI",  label: "SCI" },
  { value: "SCS",  label: "SCS" },
  { value: "SNC",  label: "SNC" },
  { value: "GIE",  label: "GIE" },
  { value: "autre",label: "Autre" },
]

const REGIMES: { value: SocieteRegimeFiscal; label: string }[] = [
  { value: "tva_assujetti", label: "TVA assujetti" },
  { value: "non_assujetti", label: "Non assujetti" },
]

export function IdentiteForm({ initial, loading, onSubmit }: Props) {
  const [s, setS] = useState<SocieteParametresPayload>(toState(initial))
  useEffect(() => { setS(toState(initial)) }, [initial?.id, initial?.updated_at]) // eslint-disable-line react-hooks/exhaustive-deps

  const disabled = loading || !(s.nom_commercial?.trim() && s.raison_sociale?.trim())

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (disabled) return
    // Normaliser : chaînes vides → null, capital_social en number
    const payload: SocieteParametresPayload = {
      ...s,
      nom_commercial: s.nom_commercial?.trim() || "",
      raison_sociale: s.raison_sociale?.trim() || "",
      adresse:        s.adresse?.trim()   || null,
      telephone:      s.telephone?.trim() || null,
      email:          s.email?.trim()     || null,
      site_web:       s.site_web?.trim()  || null,
      rccm:           s.rccm?.trim()      || null,
      numero_cc:      s.numero_cc?.trim() || null,
      nif:            s.nif?.trim()       || null,
      code_naf:       s.code_naf?.trim()  || null,
      capital_social: s.capital_social ?? null,
      forme_juridique: s.forme_juridique ?? null,
      regime_fiscal:   s.regime_fiscal ?? null,
      // PHASE 4.3
      methodes_comptables:    s.methodes_comptables?.trim()    || null,
      engagements_hors_bilan: s.engagements_hors_bilan?.trim() || null,
      methode_amortissement:  s.methode_amortissement ?? "lineaire",
      methode_stocks:         s.methode_stocks        ?? "fifo",
    }
    await onSubmit(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      <Section title="Identité commerciale" Icon={Building2}>
        <Field label="Nom commercial" required>
          <input
            type="text" value={s.nom_commercial ?? ""}
            onChange={e => setS({ ...s, nom_commercial: e.target.value })}
            placeholder="Ex: Boyah Group"
            className={inputCls} required minLength={2} maxLength={200}
          />
        </Field>
        <Field label="Raison sociale officielle" required>
          <input
            type="text" value={s.raison_sociale ?? ""}
            onChange={e => setS({ ...s, raison_sociale: e.target.value })}
            placeholder="Ex: BOYAH GROUP SARL"
            className={inputCls} required minLength={2} maxLength={200}
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Forme juridique">
            <select
              value={s.forme_juridique ?? ""}
              onChange={e => setS({ ...s, forme_juridique: (e.target.value || null) as SocieteFormeJuridique | null })}
              className={inputCls}
            >
              <option value="">—</option>
              {FORMES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </Field>
          <Field label="Téléphone">
            <input type="tel" value={s.telephone ?? ""} onChange={e => setS({ ...s, telephone: e.target.value })} placeholder="+225 07 12 34 56 78" className={inputCls} maxLength={30} />
          </Field>
        </div>
        <Field label="Adresse">
          <input type="text" value={s.adresse ?? ""} onChange={e => setS({ ...s, adresse: e.target.value })} placeholder="Riviera 2, Cocody, Abidjan, Côte d'Ivoire" className={inputCls} maxLength={500} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Email">
            <input type="email" value={s.email ?? ""} onChange={e => setS({ ...s, email: e.target.value })} placeholder="contact@boyahgroup.com" className={inputCls} maxLength={200} />
          </Field>
          <Field label="Site web">
            <input type="text" value={s.site_web ?? ""} onChange={e => setS({ ...s, site_web: e.target.value })} placeholder="https://boyahgroup.com" className={inputCls} maxLength={200} />
          </Field>
        </div>
      </Section>

      <Section title="Informations légales" Icon={FileText} hint="Obligatoires pour les PDF officiels (Bilan, CR, Grand Livre…).">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="N° RCCM"><input type="text" value={s.rccm ?? ""} onChange={e => setS({ ...s, rccm: e.target.value })} placeholder="CI-ABJ-2023-B-12345" className={`${inputCls} font-mono`} maxLength={60} /></Field>
          <Field label="N° CC (Compte Contribuable)"><input type="text" value={s.numero_cc ?? ""} onChange={e => setS({ ...s, numero_cc: e.target.value })} placeholder="12345 X" className={`${inputCls} font-mono`} maxLength={60} /></Field>
          <Field label="Capital social (F CFA)">
            <input type="number" min={0} step={1000} value={s.capital_social ?? ""}
              onChange={e => setS({ ...s, capital_social: e.target.value === "" ? null : Number(e.target.value) })}
              placeholder="1 000 000" className={`${inputCls} font-mono tabular-nums`} />
          </Field>
          <Field label="Régime fiscal">
            <select value={s.regime_fiscal ?? ""}
              onChange={e => setS({ ...s, regime_fiscal: (e.target.value || null) as SocieteRegimeFiscal | null })}
              className={inputCls}>
              <option value="">—</option>
              {REGIMES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>
          <Field label="NIF"><input type="text" value={s.nif ?? ""} onChange={e => setS({ ...s, nif: e.target.value })} placeholder="(optionnel)" className={`${inputCls} font-mono`} maxLength={60} /></Field>
          <Field label="Code NAF / APE"><input type="text" value={s.code_naf ?? ""} onChange={e => setS({ ...s, code_naf: e.target.value })} placeholder="4932Z - Transport par taxis" className={inputCls} maxLength={30} /></Field>
        </div>
      </Section>

      <Section title="Exercice par défaut" Icon={Calendar} hint="Format JJ-MM. Par défaut : 01-01 → 12-31 (année civile).">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Début (JJ-MM)">
            <input type="text" pattern="\d{2}-\d{2}" value={s.exercice_debut_jj_mm ?? "01-01"}
              onChange={e => setS({ ...s, exercice_debut_jj_mm: e.target.value })}
              className={`${inputCls} font-mono`} />
          </Field>
          <Field label="Fin (JJ-MM)">
            <input type="text" pattern="\d{2}-\d{2}" value={s.exercice_fin_jj_mm ?? "12-31"}
              onChange={e => setS({ ...s, exercice_fin_jj_mm: e.target.value })}
              className={`${inputCls} font-mono`} />
          </Field>
        </div>
      </Section>

      {/* ─── PHASE 4.3 — Notes annexes ─────────────────────────────────────── */}
      <Section title="Notes annexes — Méthodes comptables (Note 1)" Icon={BookOpen}
               hint="Texte affiché en Note 1 des annexes (modifiable, multilignes).">
        <Field label="Texte de la Note 1">
          <textarea value={s.methodes_comptables ?? ""}
            onChange={e => setS({ ...s, methodes_comptables: e.target.value })}
            placeholder="• Référentiel : SYSCOHADA révisé&#10;• Devise : XOF&#10;• ..."
            className={`${inputCls} font-mono text-[12px] leading-relaxed`}
            rows={8} maxLength={5000} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Méthode d'amortissement">
            <select value={s.methode_amortissement ?? "lineaire"}
              onChange={e => setS({ ...s, methode_amortissement: e.target.value as "lineaire" | "degressif" })}
              className={inputCls}>
              <option value="lineaire">Linéaire</option>
              <option value="degressif">Dégressif</option>
            </select>
          </Field>
          <Field label="Valorisation stocks">
            <select value={s.methode_stocks ?? "fifo"}
              onChange={e => setS({ ...s, methode_stocks: e.target.value as "fifo" | "cmp" | "lifo" })}
              className={inputCls}>
              <option value="fifo">FIFO (Premier Entré, Premier Sorti)</option>
              <option value="cmp">CMP (Coût Moyen Pondéré)</option>
              <option value="lifo">LIFO (Dernier Entré, Premier Sorti)</option>
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Notes annexes — Engagements hors bilan (Note 6)" Icon={ShieldCheck}
               hint="Cautions, avals, crédit-bail, litiges. Affiché tel quel en Note 6 du PDF.">
        <Field label="Texte de la Note 6">
          <textarea value={s.engagements_hors_bilan ?? ""}
            onChange={e => setS({ ...s, engagements_hors_bilan: e.target.value })}
            placeholder="Aucun engagement hors bilan déclaré pour l'exercice."
            className={`${inputCls} font-mono text-[12px] leading-relaxed`}
            rows={6} maxLength={5000} />
        </Field>
      </Section>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2">
        <button type="submit" disabled={disabled}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white text-sm font-semibold shadow-md shadow-indigo-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {loading ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls = "w-full px-3 py-2 rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/60 transition"

function Section({ title, Icon, hint, children }: { title: string; Icon: React.ElementType; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-indigo-500/12 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
          <Icon size={13} />
        </div>
        <h3 className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">{title}</h3>
      </div>
      {hint && <p className="text-[11px] text-gray-500 dark:text-gray-400 -mt-1">{hint}</p>}
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

function toState(p: SocieteParametres | null): SocieteParametresPayload {
  if (!p) return { exercice_debut_jj_mm: "01-01", exercice_fin_jj_mm: "12-31", nom_commercial: "", raison_sociale: "" }
  return {
    nom_commercial:       p.nom_commercial,
    raison_sociale:       p.raison_sociale,
    forme_juridique:      p.forme_juridique,
    adresse:              p.adresse,
    telephone:            p.telephone,
    email:                p.email,
    site_web:             p.site_web,
    rccm:                 p.rccm,
    numero_cc:            p.numero_cc,
    capital_social:       p.capital_social,
    regime_fiscal:        p.regime_fiscal,
    nif:                  p.nif,
    code_naf:             p.code_naf,
    exercice_debut_jj_mm: p.exercice_debut_jj_mm,
    exercice_fin_jj_mm:   p.exercice_fin_jj_mm,
    methodes_comptables:    p.methodes_comptables,
    engagements_hors_bilan: p.engagements_hors_bilan,
    methode_amortissement:  p.methode_amortissement,
    methode_stocks:         p.methode_stocks,
  }
}
