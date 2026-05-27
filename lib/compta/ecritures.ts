/**
 * Génération automatique des écritures comptables (mode Avancé).
 *
 * Référence : doc Phase 2 §7 (operations) + §1.5 (helpers).
 *
 * Convention :
 *  - Une opération validée + mode 'avance' génère une écriture en partie double.
 *  - Le numéro d'écriture suit le format `YYYY-JJ-NNNNNN` (année-journal-séquence).
 *  - L'écriture est insérée d'abord avec statut='brouillon', puis ses lignes,
 *    puis un UPDATE statut='valide' qui déclenche le trigger d'équilibre.
 *  - Si le trigger échoue, on supprime l'écriture pour ne pas polluer la base.
 *  - Idempotence : si op.ecriture_id existe déjà, on retourne l'id sans rien
 *    refaire.
 *
 * Utilise supabaseAdmin (clé service role) — bypass RLS, cohérent avec le reste
 * du module.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"

// ─── Types internes ──────────────────────────────────────────────────────────

type ModeActif = "simple" | "avance"

type OperationLite = {
  id:                string
  date_operation:    string
  type:              "entree" | "sortie"
  montant:           number
  libelle:           string
  compte_id:         string | null
  caisse_id:         string | null
  categorie_id:      string
  exercice_id:       string
  vehicule_id:       string | null
  chauffeur_id:      string | null
  client_id:         string | null
  statut:            string
  ecriture_id:       string | null
}

// ─── Erreurs typées (codes alignés avec lib/compta/errors.ts) ────────────────

export class EcritureError extends Error {
  constructor(public code: string, message: string, public details?: Record<string, unknown>) {
    super(message)
    this.name = "EcritureError"
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Lit le mode actif (`simple` ou `avance`) depuis parametres_module_compta. */
export async function getModeActif(): Promise<ModeActif> {
  const { data, error } = await supabaseAdmin
    .from("parametres_module_compta")
    .select("mode_actif")
    .eq("id", 1)
    .single()
  if (error || !data) return "simple"
  return data.mode_actif as ModeActif
}

/**
 * Numéro d'écriture suivant pour un journal et un exercice donnés.
 * Format `YYYY-JJ-NNNNNN`. La séquence est calculée comme MAX(numero) + 1
 * (et non count + 1) pour gérer les trous de séquence dus aux DELETE
 * manuels, rollbacks SQL, extournes orphelines, etc.
 */
export async function prochainNumero(
  journalCode: string,
  exerciceId:  string,
): Promise<string> {
  const { data: ex, error: exErr } = await supabaseAdmin
    .from("exercices")
    .select("date_debut")
    .eq("id", exerciceId)
    .single()
  if (exErr || !ex) {
    throw new EcritureError("INTERNAL_ERROR", `Exercice introuvable : ${exerciceId}`)
  }
  const annee = new Date(ex.date_debut + "T00:00:00Z").getUTCFullYear()

  // Récupère le dernier numéro existant pour ce journal+exercice.
  // ⚠️ Bug historique : `count + 1` plantait dès qu'il y avait un trou dans
  // la séquence (ex: 1,2,3,5 → count=4, mais numéro 5 déjà pris → doublon).
  // On utilise MAX(seq) + 1 via ORDER BY DESC + LIMIT 1.
  // On filtre sur le préfixe `YYYY-JJ-` pour exclure les éventuels formats
  // dérivés (ex: extournes `EXT-YYYY-JJ-NNN`).
  const prefix = `${annee}-${journalCode}-`
  const { data: lastRows, error: cErr } = await supabaseAdmin
    .from("ecritures_comptables")
    .select("numero")
    .eq("journal_code", journalCode)
    .eq("exercice_id",  exerciceId)
    .like("numero", `${prefix}%`)
    .order("numero", { ascending: false })
    .limit(1)
  if (cErr) {
    throw new EcritureError("DB_ERROR", `Lecture dernier numéro impossible : ${cErr.message}`)
  }
  let lastSeq = 0
  if (lastRows && lastRows.length > 0 && lastRows[0].numero) {
    const match = /-(\d+)$/.exec(lastRows[0].numero)
    if (match) lastSeq = parseInt(match[1], 10)
  }
  const seq = String(lastSeq + 1).padStart(6, "0")
  return `${annee}-${journalCode}-${seq}`
}

/**
 * Choix automatique du journal en fonction de la catégorie et de la nature
 * de la localisation (compte vs caisse).
 */
function determinerJournal(
  journalParDefaut: string | null,
  type:             "entree" | "sortie",
  hasCompte:        boolean,
): string {
  if (journalParDefaut) return journalParDefaut
  if (type === "entree") return "VE"   // Journal des ventes
  return hasCompte ? "BQ" : "CA"        // Sortie banque vs sortie caisse
}

// ─── Génération d'écriture depuis une opération ──────────────────────────────

/**
 * Génère l'écriture comptable correspondant à une opération validée.
 *
 * Refacto Lot G (26/05/2026) : wrapper RPC sur le helper SQL
 * `public.generer_ecriture_pour_operation(uuid)`. Ce helper porte la logique
 * de génération côté Postgres pour être appelable directement par les
 * triggers cascade (trg_cascade_recette_wave, trg_cascade_versement_to_operation).
 * Une seule source de vérité TS ↔ SQL.
 *
 * Idempotent : si l'opération a déjà un ecriture_id, le helper le retourne tel quel.
 *
 * Lève une EcritureError avec code dans :
 *   - NOT_FOUND
 *   - OPERATION_VALIDATED  (l'opération n'est pas validée)
 *   - CATEGORY_NO_MAPPING
 *   - ACCOUNT_NO_MAPPING
 *   - ECRITURE_DESEQUILIBREE
 *   - DB_ERROR / INTERNAL_ERROR
 *
 * Note : le helper SQL retourne NULL en cas d'échec (les détails sont
 * logués via RAISE WARNING côté Postgres). On dérive le code d'erreur en
 * inspectant l'état de l'opération après l'appel.
 */
export async function genererEcritureFromOperation(opId: string): Promise<string> {
  // 1. Pré-check pour conserver les codes d'erreur fins attendus par les
  //    appelants (NOT_FOUND, OPERATION_VALIDATED, idempotence).
  const { data: opPre, error: opPreErr } = await supabaseAdmin
    .from("operations")
    .select("id, statut, ecriture_id, categorie_id, caisse_id, compte_id")
    .eq("id", opId)
    .single<Pick<OperationLite, "id" | "statut" | "ecriture_id" | "categorie_id" | "caisse_id" | "compte_id">>()
  if (opPreErr || !opPre) {
    console.error(`[ecriture] op ${opId} not found:`, opPreErr)
    throw new EcritureError("NOT_FOUND", `Opération introuvable : ${opId}`)
  }
  if (opPre.statut !== "valide") {
    throw new EcritureError("OPERATION_VALIDATED", `Opération non validée : ${opId}`)
  }
  if (opPre.ecriture_id) {
    return opPre.ecriture_id   // idempotence (le helper le ferait aussi)
  }

  // 2. Appel du helper SQL — la logique métier (numérotation, partie double,
  //    advisory lock anti-race, trigger d'équilibre) est portée côté Postgres.
  const { data: ecrId, error: rpcErr } = await supabaseAdmin
    .rpc("generer_ecriture_pour_operation", { p_op_id: opId })
  if (rpcErr) {
    console.error(`[ecriture] op ${opId} RPC failed:`, rpcErr)
    throw new EcritureError("DB_ERROR", `Appel RPC échoué : ${rpcErr.message}`, {
      code: rpcErr.code, hint: rpcErr.hint, details: rpcErr.details,
    })
  }
  if (typeof ecrId === "string" && ecrId.length > 0) {
    return ecrId
  }

  // 3. Le helper a retourné NULL → on inspecte pour produire le code d'erreur
  //    le plus précis possible (les détails sont dans les logs Postgres).
  //    On distingue : catégorie sans mapping, compte/caisse sans mapping,
  //    déséquilibre. À défaut, INTERNAL_ERROR générique.
  const { data: cat } = await supabaseAdmin
    .from("categories_operations")
    .select("libelle, compte_syscohada_code, sens")
    .eq("id", opPre.categorie_id)
    .single<{ libelle: string; compte_syscohada_code: string | null; sens: string | null }>()
  if (!cat || !cat.compte_syscohada_code || !cat.sens) {
    throw new EcritureError(
      "CATEGORY_NO_MAPPING",
      `Catégorie sans mapping SYSCOHADA complet : ${opPre.categorie_id}`,
      { categorie_id: opPre.categorie_id, libelle: cat?.libelle },
    )
  }
  if (opPre.caisse_id) {
    const { data: c } = await supabaseAdmin
      .from("caisses").select("compte_syscohada_code, libelle").eq("id", opPre.caisse_id).single()
    if (!c?.compte_syscohada_code) {
      throw new EcritureError("ACCOUNT_NO_MAPPING", `Caisse sans mapping SYSCOHADA`, { caisse_id: opPre.caisse_id })
    }
  } else if (opPre.compte_id) {
    const { data: c } = await supabaseAdmin
      .from("comptes").select("compte_syscohada_code, libelle").eq("id", opPre.compte_id).single()
    if (!c?.compte_syscohada_code) {
      throw new EcritureError("ACCOUNT_NO_MAPPING", `Compte sans mapping SYSCOHADA`, { compte_id: opPre.compte_id })
    }
  }

  // 4. Fallback : le helper a échoué pour une raison non immédiatement diagnostiquable
  //    (déséquilibre, exercice introuvable, erreur trigger d'équilibre, etc.)
  //    Les détails sont dans les logs Postgres (RAISE WARNING).
  throw new EcritureError(
    "INTERNAL_ERROR",
    `Génération de l'écriture échouée pour l'opération ${opId} — voir logs Postgres (RAISE WARNING)`,
    { operation_id: opId },
  )
}

// ─── Génération d'écriture d'extourne (Day 5) ────────────────────────────────

/**
 * Génère l'écriture d'extourne pour une opération validée qui est annulée.
 *
 * Règle SYSCOHADA absolue : on ne supprime jamais une écriture validée. À la
 * place, on enregistre une écriture d'extourne qui inverse débits et crédits
 * pour neutraliser l'effet comptable.
 *
 * Règles métier :
 *  - Journal toujours = OD (Opérations Diverses), peu importe le journal d'origine.
 *  - Date = today (date d'annulation).
 *  - Exercice = celui qui couvre today (peut différer de l'écriture d'origine).
 *  - Numéro = prochaine séquence du journal OD pour l'exercice de today.
 *  - Libellé = "Extourne — " + libellé d'origine.
 *  - Pour chaque ligne d'origine : créer une ligne miroir débit↔crédit inversés,
 *    libellé préfixé "Extourne — ", liens auxiliaires (vehicule/chauffeur/client/
 *    apporteur) recopiés.
 *
 * Idempotence : si une écriture d'extourne existe déjà pour cette opération
 * (même operation_id, libellé commençant par "Extourne — ", statut=valide),
 * on retourne directement son id sans rien recréer.
 *
 * Lève une `EcritureError` (codes) :
 *   - NOT_FOUND               (opération introuvable)
 *   - CONFLICT                (opération sans écriture d'origine)
 *   - PERIOD_CLOSED           (mois de today clôturé)
 *   - EXERCICE_CLOSED         (exercice de today clôturé / inexistant)
 *   - ECRITURE_DESEQUILIBREE  (le trigger BD a refusé)
 *   - DB_ERROR / INTERNAL_ERROR
 */
export async function genererEcritureExtourne(operationId: string): Promise<string> {
  console.log(`[extourne] start operation_id=${operationId}`)

  // 1. Charger l'opération + son écriture d'origine
  const { data: op, error: opErr } = await supabaseAdmin
    .from("operations")
    .select("id, ecriture_id, libelle, statut, vehicule_id, chauffeur_id, client_id")
    .eq("id", operationId)
    .single()
  if (opErr || !op) {
    console.error(`[extourne] load operation FAILED:`, opErr)
    throw new EcritureError("NOT_FOUND", `Opération introuvable : ${operationId}`)
  }
  console.log(`[extourne] operation loaded — statut=${op.statut} ecriture_id=${op.ecriture_id}`)

  if (!op.ecriture_id) {
    console.error(`[extourne] operation has NO ecriture_id (statut=${op.statut}). Cannot extourner.`)
    throw new EcritureError(
      "CONFLICT",
      `Opération sans écriture d'origine, extourne impossible : ${operationId}`,
    )
  }

  // 2. Idempotence : extourne déjà existante pour cette écriture d'origine ?
  //    Lookup via la colonne `extourne_de` (FK ajoutée par la migration
  //    20260511130000_compta_extourne_link.sql).
  const { data: existing, error: existErr } = await supabaseAdmin
    .from("ecritures_comptables")
    .select("id")
    .eq("extourne_de", op.ecriture_id)
    .maybeSingle()
  if (existErr) {
    console.error(`[extourne] idempotence SELECT FAILED:`, existErr)
    throw new EcritureError("DB_ERROR", `Idempotence check failed: ${existErr.message}`)
  }
  if (existing?.id) {
    console.log(`[extourne] idempotent return — existing extourne id=${existing.id}`)
    return existing.id
  }

  // 3. Charger l'écriture d'origine + ses lignes
  const { data: ecrOrigine, error: eErr } = await supabaseAdmin
    .from("ecritures_comptables")
    .select("id, numero, libelle, journal_code, exercice_id")
    .eq("id", op.ecriture_id)
    .single()
  if (eErr || !ecrOrigine) {
    throw new EcritureError(
      "NOT_FOUND",
      `Écriture d'origine introuvable : ${op.ecriture_id}`,
    )
  }

  const { data: lignesOrigine, error: lErr } = await supabaseAdmin
    .from("lignes_ecritures")
    .select("ordre, compte_syscohada_code, libelle, debit, credit, vehicule_id, chauffeur_id, client_id, apporteur_code")
    .eq("ecriture_id", ecrOrigine.id)
    .order("ordre", { ascending: true })
  if (lErr || !lignesOrigine || lignesOrigine.length === 0) {
    throw new EcritureError(
      "INTERNAL_ERROR",
      `Lignes de l'écriture d'origine introuvables : ${ecrOrigine.id}`,
    )
  }

  // 4. Date + exercice de l'extourne (today)
  const today = new Date().toISOString().slice(0, 10)
  let exercice
  try {
    // getExerciceForDate vit dans soldes.ts — import dynamique pour éviter
    // une boucle circulaire avec ecritures.ts.
    const mod = await import("./soldes")
    exercice = await mod.getExerciceForDate(today)
  } catch (e) {
    throw new EcritureError("EXERCICE_CLOSED", `Aucun exercice ouvert ne couvre ${today}`, {
      hint: (e as Error).message,
    })
  }
  if (exercice.cloture) {
    throw new EcritureError("EXERCICE_CLOSED", `Exercice ${exercice.id} clôturé`)
  }

  // 5. Période de today non clôturée
  const periode = today.slice(0, 7)
  const { data: cloture } = await supabaseAdmin
    .from("clotures")
    .select("id")
    .eq("exercice_id", exercice.id)
    .eq("type", "mensuelle")
    .eq("periode", periode)
    .maybeSingle()
  if (cloture) {
    throw new EcritureError("PERIOD_CLOSED", `La période ${periode} est clôturée`)
  }

  // 6. Numéro de la nouvelle écriture — préfixe `EXT-` + numéro origine.
  //    Plus parlant qu'une séquence OD (l'opérateur retrouve directement le
  //    couple origine ↔ extourne). Ex: "2026-VE-000142" → "EXT-2026-VE-000142".
  //    Pas de risque de collision puisque les écritures origines n'utilisent
  //    jamais ce préfixe (numérotation via `prochainNumero` au format YYYY-JJ-NNNNNN).
  const numero = `EXT-${ecrOrigine.numero}`

  // 7. Insertion écriture d'extourne (statut=brouillon)
  //    Lien fort avec l'origine via `extourne_de` (FK Phase 3 correctif).
  const libelleExtourne = `Extourne — ${ecrOrigine.libelle}`
  console.log(`[extourne] INSERT ecriture numero=${numero} libelle="${libelleExtourne}" extourne_de=${ecrOrigine.id}`)
  const { data: ecrExt, error: ecrErr } = await supabaseAdmin
    .from("ecritures_comptables")
    .insert({
      numero,
      date_ecriture:   today,
      journal_code:    "OD",
      libelle:         libelleExtourne,
      exercice_id:     exercice.id,
      operation_id:    op.id,
      extourne_de:     ecrOrigine.id,
      source_manuelle: false,
      statut:          "brouillon",
    })
    .select("id")
    .single()
  if (ecrErr) {
    console.error(`[extourne] INSERT ecriture FAILED:`, {
      code:    ecrErr.code,
      message: ecrErr.message,
      details: ecrErr.details,
      hint:    ecrErr.hint,
    })
    throw new EcritureError("DB_ERROR", `Création écriture extourne échouée : ${ecrErr.message}`, {
      code: ecrErr.code, details: ecrErr.details, hint: ecrErr.hint,
    })
  }
  if (!ecrExt) {
    console.error(`[extourne] INSERT ecriture returned NO DATA (mais pas d'erreur)`)
    throw new EcritureError("DB_ERROR", `Création écriture extourne : aucune donnée retournée`)
  }
  console.log(`[extourne] ecriture inserted id=${ecrExt.id}`)

  // 8. Lignes miroir — débit ↔ crédit inversés
  const lignesExtourne = lignesOrigine.map((l, idx) => ({
    ecriture_id:            ecrExt.id,
    ordre:                  idx + 1,
    compte_syscohada_code:  l.compte_syscohada_code,
    libelle:                `Extourne — ${l.libelle ?? ""}`.trim(),
    debit:                  Number(l.credit),  // INVERSION
    credit:                 Number(l.debit),   // INVERSION
    vehicule_id:            l.vehicule_id,
    chauffeur_id:           l.chauffeur_id,
    client_id:              l.client_id,
    apporteur_code:         l.apporteur_code,
  }))

  console.log(`[extourne] INSERT ${lignesExtourne.length} lignes miroir`)
  const { error: lExtErr } = await supabaseAdmin
    .from("lignes_ecritures")
    .insert(lignesExtourne)
  if (lExtErr) {
    console.error(`[extourne] INSERT lignes FAILED:`, {
      code: lExtErr.code, message: lExtErr.message, details: lExtErr.details, hint: lExtErr.hint,
    })
    // Rollback : supprimer l'écriture orpheline pour ne pas polluer
    const { error: rbErr } = await supabaseAdmin.from("ecritures_comptables").delete().eq("id", ecrExt.id)
    if (rbErr) console.error(`[extourne] rollback delete FAILED:`, rbErr)
    else        console.log (`[extourne] rolled back orphan ecriture ${ecrExt.id}`)
    throw new EcritureError("DB_ERROR", `Insertion lignes extourneéchouée : ${lExtErr.message}`)
  }

  // 9. Validation (le trigger d'équilibre BD vérifie partie double)
  console.log(`[extourne] UPDATE statut=valide`)
  const { error: vErr } = await supabaseAdmin
    .from("ecritures_comptables")
    .update({ statut: "valide", valide_le: new Date().toISOString() })
    .eq("id", ecrExt.id)
  if (vErr) {
    console.error(`[extourne] UPDATE statut FAILED:`, vErr)
    const code = vErr.code === "23514" ? "ECRITURE_DESEQUILIBREE" : "DB_ERROR"
    throw new EcritureError(code, `Validation extourne échouée : ${vErr.message}`)
  }

  console.log(`[extourne] done -> ${ecrExt.id}`)
  return ecrExt.id
}
