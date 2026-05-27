"use client"

/**
 * /comptabilite/operations/nouveau — Écran 4 Phase 3.
 *
 * Formulaire de saisie d'une opération comptable manuelle.
 * Orchestre 9 composants : TypeToggle, MontantField, date input, libellé,
 * CaisseSelector, CategorieSelector, LiensMetierFields, NotesField,
 * EcriturePreview, FormFooter.
 *
 * Workflow :
 *  - Enregistrer brouillon : POST /operations (statut='brouillon')
 *  - Valider : POST /operations + POST /operations/[id]/valider
 *  - Navigation post-success → /comptabilite/operations/[id]
 *
 * Référence : doc Phase 3 Écran 4.
 */

export const dynamic = "force-dynamic"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "@/lib/toast"
import { OperationFormHeader } from "@/components/compta/OperationFormHeader"
import { TypeToggle } from "@/components/compta/TypeToggle"
import { MontantField } from "@/components/compta/MontantField"
import { CaisseSelector } from "@/components/compta/CaisseSelector"
import { CategorieSelector } from "@/components/compta/CategorieSelector"
import { TiersSelector } from "@/components/compta/TiersSelector"
import { LiensMetierFields } from "@/components/compta/LiensMetierFields"
import { NotesField } from "@/components/compta/NotesField"
import { EcriturePreview } from "@/components/compta/EcriturePreview"
import { FormFooter } from "@/components/compta/FormFooter"
import { useFormReferences } from "@/hooks/compta/useFormReferences"
import { useCreateOperation } from "@/hooks/compta/useCreateOperation"
import type {
  TypeOperation,
  CaisseRefForm,
  CategorieForm,
  CreateOperationInput,
} from "@/types/compta-ui"

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const PLACEHOLDERS: Record<TypeOperation, string> = {
  entree: "Ex : Apport en compte courant",
  sortie: "Ex : Achat fournitures bureau",
}

export default function NouvelleOperationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Query params :
  //   ?caisse_id=<uuid>&type_cible=caisse|compte → Écran 5 (bouton Ajouter une op)
  //   ?categorie_id=<uuid>                       → Écran 6 (bouton Ajouter une op)
  const prefillCaisseId    = searchParams.get("caisse_id")
  const prefillTypeCible   = searchParams.get("type_cible") // "caisse" | "compte"
  const prefillCategorieId = searchParams.get("categorie_id")

  // ── State formulaire ──────────────────────────────────────────────────────
  const [type,        setType]       = useState<TypeOperation>("sortie")
  const [montant,     setMontant]    = useState<number | null>(null)
  const [date,        setDate]       = useState<string>(todayIso())
  const [libelle,     setLibelle]    = useState<string>("")
  const [caisse,      setCaisse]     = useState<CaisseRefForm | null>(null)
  const [categorie,   setCategorie]  = useState<CategorieForm | null>(null)
  const [vehiculeId,  setVehiculeId] = useState<number | null>(null)
  const [chauffeurId, setChauffeurId] = useState<number | null>(null)
  const [clientId,    setClientId]   = useState<number | null>(null)
  // Phase 4.x Vague 2 — tiers optionnel
  const [tiersId,     setTiersId]    = useState<string | null>(null)
  const [notes,       setNotes]      = useState<string>("")

  // ── Refs (caisses, comptes, catégories, véhicules…) ───────────────────────
  const { refs, loading: refsLoading, error: refsError } = useFormReferences(type)
  const { saveDraft, validate, loading: submitLoading } = useCreateOperation()

  // ── Reset catégorie si type change (cohérence sens) ───────────────────────
  useEffect(() => {
    // Si la catégorie courante n'est plus dans la liste filtrée par sens,
    // on la reset.
    if (categorie && refs) {
      const stillThere = refs.categories.find(c => c.id === categorie.id)
      if (!stillThere) setCategorie(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, refs?.categories])

  // ── Pre-fill caisse depuis URL (?caisse_id=…) une fois les refs chargées ──
  useEffect(() => {
    if (!prefillCaisseId || !refs || caisse) return
    const target = refs.caisses_comptes.find(c =>
      c.id === prefillCaisseId &&
      (prefillTypeCible == null || c.type_cible === prefillTypeCible),
    )
    if (target) setCaisse(target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillCaisseId, prefillTypeCible, refs?.caisses_comptes])

  // ── Pre-fill catégorie depuis URL (?categorie_id=…) ──────────────────────
  // Si la catégorie pré-remplie a un sens incompatible avec le type courant,
  // on bascule aussi le type pour rester cohérent (sortie/credit ou entree/debit
  // serait reset par l'effet précédent).
  useEffect(() => {
    if (!prefillCategorieId || !refs || categorie) return
    const target = refs.categories.find(c => c.id === prefillCategorieId)
    if (target) {
      setCategorie(target)
    } else if (refs.categories.length === 0 && type === "sortie") {
      // Catégorie pas dans la liste filtrée — il faut sans doute basculer le type
      // (peut arriver si l'URL pointe vers une catégorie d'entrée alors qu'on
      // est sur sortie par défaut). On laisse l'utilisateur basculer manuellement
      // si c'est le cas, faute d'avoir le sens de la catégorie ici.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillCategorieId, refs?.categories])

  // ── Bascule auto type sens depuis la catégorie pré-remplie ───────────────
  // Si on connaît categorie_id mais qu'aucune catégorie correspondante n'est
  // dans la liste filtrée par sens, on essaie de basculer le type pour la
  // retrouver. On le fait via un fetch léger (catégorie unique) au mount.
  useEffect(() => {
    if (!prefillCategorieId || categorie) return
    // Fetch pour récupérer le sens et basculer le type si besoin
    fetch(`/api/compta/categories/${prefillCategorieId}`)
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        const senCat = j?.data?.sens
        if (senCat === "credit" && type !== "entree") setType("entree")
        else if (senCat === "debit" && type !== "sortie") setType("sortie")
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillCategorieId])

  // ── Validations ───────────────────────────────────────────────────────────
  const errors = useMemo(() => {
    const e: Partial<Record<string, string>> = {}
    if (montant != null && montant <= 0) e.montant = "Doit être > 0"
    if (libelle.length > 0 && libelle.length < 3) e.libelle = "Min 3 caractères"
    if (libelle.length > 255) e.libelle = "Max 255 caractères"
    if (date) {
      const d = new Date(date + "T00:00:00")
      const today = new Date(); today.setHours(0, 0, 0, 0)
      if (!Number.isFinite(d.getTime())) e.date = "Date invalide"
      // Date future = warning seulement (pas un blocage)
    }
    return e
  }, [montant, libelle, date])

  // Note backend : categorie_id et caisse/compte sont NOT NULL côté BD,
  // donc même un brouillon doit avoir ces champs. Seule différence avec
  // Valider : pour Valider on exige en plus que les mappings SYSCOHADA soient
  // complets (sinon échec à la génération d'écriture).
  const canSaveDraft = useMemo(() =>
    type != null
    && montant != null && montant > 0
    && libelle.trim().length >= 3
    && !!date
    && !!caisse
    && !!categorie
    && !errors.montant && !errors.libelle && !errors.date,
  [type, montant, libelle, date, caisse, categorie, errors])

  // Phase 4.x Vague 3 — Sortie vers tiers → justif obligatoire (workflow brouillon)
  // On bloque la validation directe : il faut passer par brouillon → upload justif → valider depuis Écran 2.
  const needsJustifFirst = useMemo(() =>
    type === "sortie" && !!tiersId,
  [type, tiersId])

  const canValidate = useMemo(() =>
    canSaveDraft
    && !!caisse?.compte_syscohada_code
    && !!categorie?.compte_syscohada_code
    && !needsJustifFirst,
  [canSaveDraft, caisse, categorie, needsJustifFirst])

  /** Liste lisible des champs encore manquants pour le brouillon — affichée
   *  près des boutons quand canSaveDraft = false. */
  const missingForDraft = useMemo(() => {
    const m: string[] = []
    if (!montant || montant <= 0)          m.push("montant")
    if (libelle.trim().length < 3)         m.push("libellé (3 car. min)")
    if (!date)                             m.push("date")
    if (!caisse)                           m.push("caisse")
    if (!categorie)                        m.push("catégorie")
    return m
  }, [montant, libelle, date, caisse, categorie])

  const missingForValidate = useMemo(() => {
    const m: string[] = [...missingForDraft]
    if (caisse && !caisse.compte_syscohada_code)         m.push("mapping caisse")
    if (categorie && !categorie.compte_syscohada_code)   m.push("mapping catégorie")
    // Phase 4.x Vague 3 — message dédié pour le workflow brouillon
    if (needsJustifFirst) m.push("justificatif (sortie vers tiers — enregistre en brouillon puis uploade)")
    return m
  }, [missingForDraft, caisse, categorie, needsJustifFirst])

  // ── Submission ────────────────────────────────────────────────────────────
  function buildInput(): CreateOperationInput {
    return {
      type,
      date_operation: date,
      montant:        montant ?? 0,
      libelle:        libelle.trim(),
      caisse_id:      caisse?.type_cible === "caisse" ? caisse.id : null,
      compte_id:      caisse?.type_cible === "compte" ? caisse.id : null,
      categorie_id:   categorie?.id ?? "",
      vehicule_id:    vehiculeId,
      chauffeur_id:   chauffeurId,
      client_id:      clientId,
      tiers_id:       tiersId,
      notes:          notes.trim() || null,
    }
  }

  async function handleSaveDraft() {
    if (!canSaveDraft) {
      toast.error("Renseignez au minimum le type, le montant et un libellé (3 caractères min).")
      return
    }
    const res = await saveDraft(buildInput())
    if (res.ok) {
      toast.success("Brouillon enregistré")
      router.push(`/comptabilite/operations/${res.operationId}`)
    } else {
      toast.error(res.error || "Échec de l'enregistrement")
    }
  }

  async function handleValidate() {
    if (!canValidate) {
      const missing: string[] = []
      if (!date)        missing.push("date")
      if (!caisse)      missing.push("caisse")
      if (!categorie)   missing.push("catégorie")
      if (caisse && !caisse.compte_syscohada_code)     missing.push("mapping caisse")
      if (categorie && !categorie.compte_syscohada_code) missing.push("mapping catégorie")
      toast.error(`Champs manquants : ${missing.join(", ")}`)
      return
    }
    const res = await validate(buildInput())
    if (res.ok) {
      toast.success("Opération validée · écriture créée")
      router.push(`/comptabilite/operations/${res.operationId}`)
    } else if (res.operationId) {
      toast.error(`Validation impossible : ${res.error}. Brouillon conservé.`)
      router.push(`/comptabilite/operations/${res.operationId}`)
    } else {
      toast.error(res.error || "Échec de la validation")
    }
  }

  function handleCancel() {
    router.push("/comptabilite/operations")
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <OperationFormHeader />

      {refsError && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-700 dark:text-red-300">
          Erreur de chargement des références : {refsError}
        </div>
      )}

      {/* Toggle type */}
      <TypeToggle value={type} onChange={setType} />

      {/* SECTION 1 — Infos principales (liseré vert) */}
      <Section title="Informations principales" accent="emerald">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MontantField
            value={montant}
            onChange={setMontant}
            type={type}
            error={errors.montant}
            required
          />
          <div>
            <label htmlFor="date-op" className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em] mb-1.5">
              Date d&apos;opération <span className="text-red-500">*</span>
            </label>
            <input
              id="date-op"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full h-[44px] rounded-xl border border-gray-200/70 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] px-3 text-sm text-gray-900 dark:text-white transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
            />
            {errors.date && <p className="mt-1.5 text-[11px] font-semibold text-red-500">{errors.date}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="libelle-op" className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em] mb-1.5">
            Libellé <span className="text-red-500">*</span>
          </label>
          <input
            id="libelle-op"
            type="text"
            value={libelle}
            onChange={e => setLibelle(e.target.value)}
            maxLength={255}
            placeholder={PLACEHOLDERS[type]}
            className={`w-full h-[44px] rounded-xl border bg-white dark:bg-white/[0.02] px-3 text-sm text-gray-900 dark:text-white transition focus:outline-none focus:ring-2 ${
              errors.libelle
                ? "border-red-400 dark:border-red-500/50 focus:ring-red-500/30"
                : "border-gray-200/70 dark:border-white/[0.08] focus:ring-emerald-500/30 focus:border-emerald-400"
            }`}
          />
          <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
            {errors.libelle ? <span className="font-semibold text-red-500">{errors.libelle}</span> : "Texte court qui décrit l'opération"}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CaisseSelector
            items={refs?.caisses_comptes ?? []}
            value={caisse}
            onChange={setCaisse}
            loading={refsLoading}
            required
          />
          <CategorieSelector
            items={refs?.categories ?? []}
            value={categorie}
            onChange={setCategorie}
            loading={refsLoading}
            required
          />
        </div>
      </Section>

      {/* SECTION 2 — Liens métier (liseré cyan, optionnel) */}
      <Section title="Liens métier" accent="cyan" hint="Optionnel — pour rattacher l'opération à un véhicule, chauffeur, client ou tiers.">
        <LiensMetierFields
          vehicules={refs?.vehicules ?? []}
          chauffeurs={refs?.chauffeurs ?? []}
          clients={refs?.clients ?? []}
          vehiculeId={vehiculeId}
          chauffeurId={chauffeurId}
          clientId={clientId}
          onVehicule={setVehiculeId}
          onChauffeur={setChauffeurId}
          onClient={setClientId}
          loading={refsLoading}
        />
        {/* Phase 4.x Vague 2 — Sélecteur de tiers (compatible avec le sens) */}
        <div className="mt-4">
          <label className="block text-[10.5px] font-bold uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400 mb-1.5">
            Tiers (optionnel)
          </label>
          <TiersSelector
            value={tiersId}
            onChange={setTiersId}
            allowedTypes={type === "entree" ? ["client", "autre"] : ["fournisseur", "salarie", "autre"]}
            defaultNewType={type === "entree" ? "client" : "fournisseur"}
            hint={type === "entree"
              ? "Pour une entrée : généralement un client (ou autre). Le compte SYSCOHADA 411-xx sera utilisé."
              : "Pour une sortie : fournisseur, salarié ou autre. Le compte SYSCOHADA 401/421/467-xx sera utilisé."}
          />
          {/* Phase 4.x Vague 3 — Banner workflow brouillon pour sortie + tiers */}
          {needsJustifFirst && (
            <div className="mt-2 rounded-xl bg-indigo-500/[0.06] border border-indigo-500/25 p-2.5 flex items-start gap-2 text-[12px]">
              <span className="text-indigo-500 mt-px">📎</span>
              <div className="text-indigo-700 dark:text-indigo-300 leading-snug">
                <strong>Justificatif obligatoire.</strong> Enregistre d&apos;abord en brouillon ;
                tu pourras ensuite uploader la facture/reçu depuis la page détail, puis valider l&apos;opération.
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* SECTION 3 — Notes (liseré ambre, optionnel) */}
      <Section title="Notes" accent="amber">
        <NotesField
          value={notes}
          onChange={setNotes}
          hint="Détails complémentaires sur l'opération (visible dans le détail uniquement)."
        />
      </Section>

      {/* SECTION 4 — Aperçu écriture comptable (liseré violet) */}
      <EcriturePreview
        type={type}
        montant={montant}
        caisse={caisse}
        categorie={categorie}
        libelleOp={libelle.trim() || undefined}
      />

      {/* Footer actions */}
      <FormFooter
        loading={submitLoading}
        canSaveDraft={canSaveDraft}
        canValidate={canValidate}
        missingForDraft={missingForDraft}
        missingForValidate={missingForValidate}
        onCancel={handleCancel}
        onSaveDraft={handleSaveDraft}
        onValidate={handleValidate}
      />
    </div>
  )
}

// ─── Sub-component : Section card avec liseré coloré ───────────────────────────

type Accent = "emerald" | "cyan" | "amber" | "violet"

const ACCENT_BAR: Record<Accent, string> = {
  emerald: "from-transparent via-emerald-500 to-transparent",
  cyan:    "from-transparent via-cyan-500 to-transparent",
  amber:   "from-transparent via-amber-500 to-transparent",
  violet:  "from-transparent via-violet-500 to-transparent",
}
const ACCENT_TITLE: Record<Accent, string> = {
  emerald: "text-emerald-700 dark:text-emerald-300",
  cyan:    "text-cyan-700 dark:text-cyan-300",
  amber:   "text-amber-700 dark:text-amber-300",
  violet:  "text-violet-700 dark:text-violet-300",
}

function Section({
  title, accent, hint, children,
}: {
  title:    string
  accent:   Accent
  hint?:    string
  children: React.ReactNode
}) {
  return (
    <div className="relative rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-5">
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${ACCENT_BAR[accent]}`} />
      <div className="space-y-4">
        <div>
          <h2 className={`text-sm font-bold tracking-tight ${ACCENT_TITLE[accent]}`}>{title}</h2>
          {hint && <p className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-1">{hint}</p>}
        </div>
        {children}
      </div>
    </div>
  )
}
