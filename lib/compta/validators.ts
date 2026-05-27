/**
 * Schémas Zod pour la validation des payloads du module Comptes & Caisses.
 *
 * Convention :
 *  - Tous les payloads JSON entrants sont validés AVANT toute écriture en base.
 *  - Les schémas Update sont les Partial des schémas Create (sauf opérations
 *    qui retirent la contrainte XOR via .partial()).
 *  - Les types inférés (z.infer) servent de Source-Of-Truth dans les routes.
 *
 * Référence : doc Phase 2 §2.2.
 */

import { z } from "zod"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const dateISO   = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD attendu")
const uuid      = z.string().uuid("UUID invalide")
const codeSyscohada = z.string().min(1).max(20)


// ─── Bootstrap (Day 6) ───────────────────────────────────────────────────────

export const bootstrapSchema = z.object({
  mode: z.enum(["simple", "avance"]),
})
export type BootstrapInput = z.infer<typeof bootstrapSchema>


// ─── Toggle mode (Day 6) ─────────────────────────────────────────────────────

export const toggleModeSchema = z.object({
  nouveau_mode: z.enum(["simple", "avance"]),
  confirmer:    z.boolean().default(false),
})
export type ToggleModeInput = z.infer<typeof toggleModeSchema>


// ─── Onboarding complete (Écran 9 Phase 3) ───────────────────────────────────
//
// Le wizard envoie : mode obligatoire + infos société optionnelles.
// Les champs société sont les mêmes que ceux acceptés par PATCH /parametres.
export const onboardingCompleteSchema = z.object({
  mode_actif: z.enum(["simple", "avance"]),
  societe: z.object({
    raison_sociale:  z.string().min(3).max(120).nullable().optional(),
    telephone:       z.string().max(30).nullable().optional(),
    email_comptable: z.string().email("Format email invalide").nullable().optional(),
  }).default({}),
  societe_skipped: z.boolean().default(false),
})
export type OnboardingCompleteInput = z.infer<typeof onboardingCompleteSchema>


// ─── Paramètres module (Day 2) ───────────────────────────────────────────────
// Seuls trois champs sont mutables via PATCH /api/compta/parametres :
//   workflow_validation_actif, exercice_courant_id, date_demarrage_module.
// mode_actif → /toggle-mode  ;  premier_login_effectue → /bootstrap.

export const parametresUpdateSchema = z.object({
  workflow_validation_actif: z.boolean().optional(),
  exercice_courant_id:       uuid.nullable().optional(),
  date_demarrage_module:     dateISO.optional(),
  // Écran 7 (Phase 3) — workflow + numérotation
  numerotation_auto:         z.boolean().optional(),
  journal_par_defaut:        z.enum(["BQ", "CA", "AC", "VE", "PA", "OD"]).nullable().optional(),
  // Réinitialisation du premier login (zone dangereuse Écran 7)
  premier_login_effectue:    z.boolean().optional(),
  // Infos société (Écran 7)
  raison_sociale:            z.string().min(3).max(120).nullable().optional(),
  numero_rccm:               z.string().max(50).nullable().optional(),
  numero_contribuable:       z.string().max(50).nullable().optional(),
  adresse_fiscale:           z.string().max(500).nullable().optional(),
  telephone:                 z.string().max(30).nullable().optional(),
  email_comptable:           z.string().email("Format email invalide").nullable().optional(),
})
export type ParametresUpdateInput = z.infer<typeof parametresUpdateSchema>


// ─── Comptes bancaires (Day 2) ───────────────────────────────────────────────

export const compteSchema = z.object({
  libelle:                z.string().min(2).max(120),
  code:                   z.string().regex(/^[a-z0-9_]+$/, "snake_case attendu").max(40).nullable().optional(),
  banque:                 z.string().max(120).nullable().optional(),
  numero_compte:          z.string().max(60).nullable().optional(),
  devise:                 z.string().length(3).default("XOF"),
  solde_initial:          z.number().default(0),
  date_solde_initial:     dateISO.optional(),
  compte_syscohada_code:  codeSyscohada.nullable().optional(),
  description:            z.string().max(500).nullable().optional(),
  actif:                  z.boolean().default(true),
})
export const compteUpdateSchema = compteSchema.partial()
export type CompteInput        = z.infer<typeof compteSchema>
export type CompteUpdateInput  = z.infer<typeof compteUpdateSchema>


// ─── Caisses (Day 3) ─────────────────────────────────────────────────────────

export const caisseSchema = z.object({
  libelle:                z.string().min(2).max(120),
  code:                   z.string().regex(/^[a-z0-9_]+$/, "snake_case attendu").max(40).nullable().optional(),
  type:                   z.enum(["cash", "mobile_money"]),
  operateur:              z.string().max(60).nullable().optional(),
  numero:                 z.string().max(60).nullable().optional(),
  solde_initial:          z.number().default(0),
  date_solde_initial:     dateISO.optional(),
  plafond:                z.number().nullable().optional(),
  compte_syscohada_code:  codeSyscohada.nullable().optional(),
  responsable_id:         uuid.nullable().optional(),
  description:            z.string().max(500).nullable().optional(),
  actif:                  z.boolean().default(true),
})
  // Cohérence type ↔ operateur (doc §5.2)
  .refine(
    d => d.type === "cash" ? !d.operateur : true,
    { message: "Une caisse de type 'cash' ne doit pas avoir d'opérateur", path: ["operateur"] },
  )
  .refine(
    d => d.type === "mobile_money" ? !!d.operateur : true,
    { message: "Une caisse de type 'mobile_money' doit avoir un opérateur", path: ["operateur"] },
  )

// Pour PATCH on ne peut pas chaîner .partial() après .refine() — on définit un
// schéma distinct sans contrainte XOR (la cohérence est revérifiée côté route).
export const caisseUpdateSchema = z.object({
  libelle:                z.string().min(2).max(120).optional(),
  code:                   z.string().regex(/^[a-z0-9_]+$/, "snake_case attendu").max(40).nullable().optional(),
  type:                   z.enum(["cash", "mobile_money"]).optional(),
  operateur:              z.string().max(60).nullable().optional(),
  numero:                 z.string().max(60).nullable().optional(),
  solde_initial:          z.number().optional(),
  date_solde_initial:     dateISO.optional(),
  plafond:                z.number().nullable().optional(),
  compte_syscohada_code:  codeSyscohada.nullable().optional(),
  responsable_id:         uuid.nullable().optional(),
  description:            z.string().max(500).nullable().optional(),
  actif:                  z.boolean().optional(),
})
export type CaisseInput        = z.infer<typeof caisseSchema>
export type CaisseUpdateInput  = z.infer<typeof caisseUpdateSchema>


// ─── Catégories d'opérations (Day 3) ─────────────────────────────────────────

export const categorieSchema = z.object({
  libelle:                z.string().min(3).max(100),
  type:                   z.enum([
                            "recette", "depense", "apport", "reversement", "avance",
                            "investissement", "remboursement", "dotation", "transfert", "autre",
                          ]),
  compte_syscohada_code:  codeSyscohada.nullable().optional(),
  sens:                   z.enum(["debit", "credit"]).nullable().optional(),
  journal_par_defaut:     z.string().max(5).nullable().optional(),
  description:            z.string().max(500).nullable().optional(),
  actif:                  z.boolean().default(true),
  ordre:                  z.number().int().default(0),
})
export const categorieUpdateSchema = categorieSchema.partial()
export type CategorieInput        = z.infer<typeof categorieSchema>
export type CategorieUpdateInput  = z.infer<typeof categorieUpdateSchema>


// ─── Reprise incrémentale (Day 7) ────────────────────────────────────────────

export const repriseSchema = z.object({
  date_from:          dateISO.optional(),
  date_to:            dateISO.optional(),
  generer_ecritures:  z.boolean().optional(),
})
export type RepriseInput = z.infer<typeof repriseSchema>


// ─── Opérations (Day 4) ──────────────────────────────────────────────────────

const operationBase = z.object({
  date_operation:     dateISO,
  type:               z.enum(["entree", "sortie"]),
  montant:            z.number().positive(),
  libelle:            z.string().min(2).max(255),
  reference_externe:  z.string().max(120).nullable().optional(),
  compte_id:          uuid.nullable().optional(),
  caisse_id:          uuid.nullable().optional(),
  categorie_id:       uuid,
  // ⚠ vehicule_id / chauffeur_id / client_id sont des INTEGER (id_vehicule,
  //   id_chauffeur, clients.id) — pas des UUID. La reprise insère directement
  //   sans passer par Zod, mais le formulaire UI (Écran 4) passe par ce schéma.
  vehicule_id:        z.number().int().nullable().optional(),
  chauffeur_id:       z.number().int().nullable().optional(),
  client_id:          z.number().int().nullable().optional(),
  // Phase 4.x Vague 2 — lien optionnel vers un tiers (rétroaction supportée)
  tiers_id:           uuid.nullable().optional(),
  notes:              z.string().max(2000).nullable().optional(),
  // Si non fourni, le serveur applique workflow_validation_actif → 'brouillon' ou 'valide'.
  // 'annule' n'est pas autorisé via POST/PATCH (passe par /annuler).
  statut:             z.enum(["brouillon", "valide"]).optional(),
})

// XOR compte_id/caisse_id (doc §7.2 step 41)
export const operationSchema = operationBase.refine(
  d => (d.compte_id && !d.caisse_id) || (!d.compte_id && d.caisse_id),
  { message: "Doit fournir EXACTEMENT un de compte_id OU caisse_id", path: ["compte_id"] },
)

// Update : tous les champs optionnels, mais si compte_id ou caisse_id changent
// la cohérence XOR est revérifiée côté route.
export const operationUpdateSchema = operationBase.partial()

export type OperationInput        = z.infer<typeof operationSchema>
export type OperationUpdateInput  = z.infer<typeof operationUpdateSchema>


// ─── Transferts internes (Phase 4.x Vague 1) ─────────────────────────────────
//
// Source XOR (caisse OU compte, pas les deux, pas les zéro).
// Destination XOR idem.
// Source ≠ destination (côté ID — testé après parse).
// Montant > 0.

export const transfertSchema = z.object({
  date_transfert:    dateISO,
  montant:           z.number().positive(),
  libelle:           z.string().max(255).nullable().optional(),
  notes:             z.string().max(2000).nullable().optional(),
  source_caisse_id:  uuid.nullable().optional(),
  source_compte_id:  uuid.nullable().optional(),
  dest_caisse_id:    uuid.nullable().optional(),
  dest_compte_id:    uuid.nullable().optional(),
})
  .refine(
    d => (d.source_caisse_id && !d.source_compte_id) || (!d.source_caisse_id && d.source_compte_id),
    { message: "Source : exactement un de source_caisse_id OU source_compte_id", path: ["source_caisse_id"] },
  )
  .refine(
    d => (d.dest_caisse_id && !d.dest_compte_id) || (!d.dest_caisse_id && d.dest_compte_id),
    { message: "Destination : exactement un de dest_caisse_id OU dest_compte_id", path: ["dest_caisse_id"] },
  )
  .refine(
    d => !(d.source_caisse_id && d.source_caisse_id === d.dest_caisse_id),
    { message: "Source et destination ne peuvent pas être la même caisse", path: ["dest_caisse_id"] },
  )
  .refine(
    d => !(d.source_compte_id && d.source_compte_id === d.dest_compte_id),
    { message: "Source et destination ne peuvent pas être le même compte", path: ["dest_compte_id"] },
  )

export type TransfertInput = z.infer<typeof transfertSchema>


// ─── Tiers (Phase 4.x Vague 2) ────────────────────────────────────────────────

const emailOpt    = z.string().email("Format email invalide").max(120).nullable().optional()
const phoneOpt    = z.string().max(30).nullable().optional()
const longTextOpt = (max: number) => z.string().max(max).nullable().optional()

export const tiersSchema = z.object({
  nom:                  z.string().min(2, "Nom trop court (min 2 caractères)").max(200),
  type:                 z.enum(["client", "fournisseur", "salarie", "autre"]),
  telephone:            phoneOpt,
  email:                emailOpt,
  adresse:              longTextOpt(500),
  raison_sociale:       longTextOpt(200),
  numero_rccm:          longTextOpt(60),
  numero_contribuable:  longTextOpt(60),
  suffix_manuel:        z.string().regex(/^[A-Za-z0-9]{1,8}$/, "Suffixe : 1-8 alphanumériques").nullable().optional(),
  notes:                longTextOpt(4000),
})
export type TiersInput = z.infer<typeof tiersSchema>

export const tiersUpdateSchema = z.object({
  nom:                  z.string().min(2).max(200).optional(),
  type:                 z.enum(["client", "fournisseur", "salarie", "autre"]).optional(),
  telephone:            phoneOpt,
  email:                emailOpt,
  adresse:              longTextOpt(500),
  raison_sociale:       longTextOpt(200),
  numero_rccm:          longTextOpt(60),
  numero_contribuable:  longTextOpt(60),
  suffix_manuel:        z.string().regex(/^[A-Za-z0-9]{1,8}$/).nullable().optional(),
  notes:                longTextOpt(4000),
  actif:                z.boolean().optional(),
})
export type TiersUpdateInput = z.infer<typeof tiersUpdateSchema>


// ─── Société paramètres (Phase 4.2) ───────────────────────────────────────────

export const societeParametresSchema = z.object({
  nom_commercial:       z.string().min(2).max(200),
  raison_sociale:       z.string().min(2).max(200),
  forme_juridique:      z.enum(["SARL","SA","SAS","SASU","EI","SCI","SCS","SNC","GIE","autre"]).nullable().optional(),
  adresse:              z.string().max(500).nullable().optional(),
  telephone:            z.string().max(30).nullable().optional(),
  email:                z.string().email("Format email invalide").max(200).nullable().optional(),
  site_web:             z.string().max(200).nullable().optional(),
  rccm:                 z.string().max(60).nullable().optional(),
  numero_cc:            z.string().max(60).nullable().optional(),
  capital_social:       z.number().int().min(0).nullable().optional(),
  regime_fiscal:        z.enum(["tva_assujetti","non_assujetti"]).nullable().optional(),
  nif:                  z.string().max(60).nullable().optional(),
  code_naf:             z.string().max(30).nullable().optional(),
  exercice_debut_jj_mm: z.string().regex(/^\d{2}-\d{2}$/, "Format JJ-MM attendu").optional(),
  exercice_fin_jj_mm:   z.string().regex(/^\d{2}-\d{2}$/, "Format JJ-MM attendu").optional(),
  // ─── PHASE 4.3 — Notes annexes (Note 1 + Note 6) + méthodes
  methodes_comptables:    z.string().max(5000).nullable().optional(),
  engagements_hors_bilan: z.string().max(5000).nullable().optional(),
  methode_amortissement:  z.enum(["lineaire", "degressif"]).optional(),
  methode_stocks:         z.enum(["fifo", "cmp", "lifo"]).optional(),
})
export type SocieteParametresInput = z.infer<typeof societeParametresSchema>


// ─── Exercices (Phase 4.2) ────────────────────────────────────────────────────

export const exerciceCreateSchema = z.object({
  annee:      z.number().int().min(2000).max(2100),
  date_debut: dateISO.optional(),
  date_fin:   dateISO.optional(),
})
export type ExerciceCreateInput = z.infer<typeof exerciceCreateSchema>


// ─── Helpers de parsing pour les routes ──────────────────────────────────────

/**
 * Parse un body Zod et retourne un résultat discriminé adapté aux routes.
 * Évite la duplication try/catch dans chaque handler.
 */
export type ZodParseResult<T> =
  | { ok: true;  data: T }
  | { ok: false; details: { path: string[]; message: string }[] }

export function safeParse<T>(
  schema: z.ZodType<T>,
  payload: unknown,
): ZodParseResult<T> {
  const r = schema.safeParse(payload)
  if (r.success) return { ok: true, data: r.data }
  return {
    ok: false,
    details: r.error.issues.map(i => ({
      path:    i.path.map(String),
      message: i.message,
    })),
  }
}
