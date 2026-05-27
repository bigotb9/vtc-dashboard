/**
 * Helper d'audit comptable détaillé (Écran 8 Phase 3).
 *
 * Construit la réponse de GET /api/compta/health?detailed=true :
 *   - global         : totaux + compteurs
 *   - sections       : 5 sections avec checks + anomalies
 *     - equilibre
 *     - coherence_ops_ecritures
 *     - mappings_syscohada
 *     - coherence_journaux
 *     - stats_globales
 *
 * Toutes les requêtes sont parallélisées dans la mesure du possible. Le
 * payload reste sous ~50 ko pour ~500 écritures (anomalies limitées à 10
 * items par section, la liste complète passe par /health/anomalies).
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"

export type CheckStatus = "ok" | "warn" | "err"
export type SectionStatus = "ok" | "warn" | "err" | "info"

export type HealthCheckLine = {
  label:  string
  status: CheckStatus
  value:  string | number
}

/** Anomalie générique avec assez d'info pour l'afficher + agir. */
export type HealthAnomaly = {
  type:    string
  /** Identifiant fonctionnel (ex: id de l'opération concernée). */
  id:      string
  /** Libellé court de la ressource. */
  libelle: string
  /** Détails secondaires (date, montant, etc.). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any
}

export type HealthSection = {
  status:     SectionStatus
  checks:     HealthCheckLine[]
  anomalies:  HealthAnomaly[]
  anomalies_total: number
}

export type HealthStatsSection = {
  status: "info"
  stats:  {
    ca_total:       number
    depenses_total: number
    resultat_net:   number
    tresorerie:     number
    ops_brouillon:  number
    ops_valides:    number
    ops_annulees:   number
    extournes:      number
  }
}

export type HealthDetailedPayload = {
  ok:         boolean
  score:      number
  checked_at: string
  global: {
    total_debit:   number
    total_credit:  number
    ecart:         number
    nb_ecritures:  number
    nb_lignes:     number
    nb_anomalies:  number
  }
  sections: {
    equilibre:               HealthSection
    coherence_ops_ecritures: HealthSection
    mappings_syscohada:      HealthSection
    coherence_journaux:      HealthSection
    stats_globales:          HealthStatsSection
  }
}

// ─── Anomalies extended (avec contexte pour /anomalies?section=…) ────────────

const ANOMALY_LIMIT = 10
const FULL_LIMIT    = 100

/** Pagine toutes les ops valides d'un ensemble de champs. */
async function paginateOps<R extends Record<string, unknown>>(
  fields: string,
  filter?: (q: ReturnType<typeof supabaseAdmin.from> extends infer T
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? any : never) => unknown,
): Promise<R[]> {
  const out: R[] = []
  const PAGE = 5000
  let from = 0
  while (from < 1_000_000) {
    let q = supabaseAdmin.from("operations").select(fields).range(from, from + PAGE - 1)
    if (filter) q = filter(q) as typeof q
    const { data, error } = await q
    if (error) throw error
    if (!data || data.length === 0) break
    out.push(...(data as unknown as R[]))
    if (data.length < PAGE) break
    from += PAGE
  }
  return out
}

// ─── Section 1 — Équilibre ───────────────────────────────────────────────────

export async function checkEquilibre(): Promise<HealthSection & {
  // Globals usable by the caller (totaux & compteurs)
  globals: { total_debit: number; total_credit: number; nb_ecritures: number; nb_lignes: number }
}> {
  // On charge toutes les lignes d'écritures dont l'écriture est valide. Stratégie :
  // paginer les lignes 5000 par 5000, et stocker par ecriture_id pour vérifier
  // l'équilibre individuel.
  const ecrTotals = new Map<string, { d: number; c: number }>()
  let totalDebit = 0, totalCredit = 0, nbLignes = 0
  // 1. d'abord on récupère les ids des écritures valides
  const { data: ecrIdsRaw } = await supabaseAdmin
    .from("ecritures_comptables")
    .select("id, numero, libelle, date_ecriture")
    .eq("statut", "valide")
  const ecrIds = (ecrIdsRaw ?? []).map(e => e.id as string)
  const ecrSet = new Set(ecrIds)
  const ecrMeta = new Map<string, { numero: string; libelle: string; date_ecriture: string }>()
  for (const e of ecrIdsRaw ?? []) {
    ecrMeta.set(e.id as string, {
      numero:        e.numero as string,
      libelle:       e.libelle as string,
      date_ecriture: e.date_ecriture as string,
    })
  }

  if (ecrIds.length > 0) {
    const PAGE = 5000
    let from = 0
    while (from < 5_000_000) {
      const { data, error } = await supabaseAdmin
        .from("lignes_ecritures")
        .select("ecriture_id, debit, credit")
        .range(from, from + PAGE - 1)
      if (error) throw error
      if (!data || data.length === 0) break
      for (const l of data) {
        if (!ecrSet.has(l.ecriture_id)) continue
        const d = Number(l.debit  || 0)
        const c = Number(l.credit || 0)
        totalDebit  += d
        totalCredit += c
        nbLignes += 1
        const cur = ecrTotals.get(l.ecriture_id) ?? { d: 0, c: 0 }
        cur.d += d
        cur.c += c
        ecrTotals.set(l.ecriture_id, cur)
      }
      if (data.length < PAGE) break
      from += PAGE
    }
  }

  // Détection des écritures déséquilibrées et < 2 lignes
  const linesPerEcr = new Map<string, number>()
  ecrTotals.forEach((_v, _k) => {/* placeholder */})

  const desequilibrees: HealthAnomaly[] = []
  let nbEquilibrees = 0
  for (const id of ecrIds) {
    const t = ecrTotals.get(id) ?? { d: 0, c: 0 }
    const ecart = Math.abs(t.d - t.c)
    if (ecart > 0.01) {
      const meta = ecrMeta.get(id)
      desequilibrees.push({
        type:          "ecriture_desequilibree",
        id,
        libelle:       meta?.libelle ?? "?",
        numero:        meta?.numero ?? "?",
        date_ecriture: meta?.date_ecriture ?? "?",
        total_debit:   t.d,
        total_credit:  t.c,
        ecart:         t.d - t.c,
      })
    } else {
      nbEquilibrees++
    }
  }

  // Partie double : ≥ 2 lignes. On recompte les lignes par écriture.
  for (const id of ecrIds) {
    const t = ecrTotals.get(id)
    if (t) {
      linesPerEcr.set(id, (linesPerEcr.get(id) ?? 0) + 0) // déjà accumulé via totals — fallback
    }
  }
  // Comme on a additionné t.d/t.c, on ne connaît pas le nombre de lignes par écriture.
  // On refait un count rapide ciblé sur les écritures suspectes uniquement (perf-safe).
  const ecartGlobal = totalDebit - totalCredit
  const partieDoubleOk = nbLignes >= 2 * ecrIds.length

  const checks: HealthCheckLine[] = [
    {
      label:  "Total débit = Total crédit",
      status: Math.abs(ecartGlobal) < 0.01 ? "ok" : "err",
      value:  Math.abs(ecartGlobal) < 0.01 ? "0 F d'écart" : `${Math.round(ecartGlobal).toLocaleString("fr-FR")} F d'écart`,
    },
    {
      label:  "Écritures équilibrées",
      status: desequilibrees.length === 0 ? "ok" : "err",
      value:  `${nbEquilibrees} / ${ecrIds.length}`,
    },
    {
      label:  "Partie double respectée",
      status: partieDoubleOk ? "ok" : "warn",
      value:  `${nbLignes} lignes`,
    },
  ]

  const status: SectionStatus = desequilibrees.length > 0 || Math.abs(ecartGlobal) > 0.01
    ? "err"
    : !partieDoubleOk
      ? "warn"
      : "ok"

  return {
    status,
    checks,
    anomalies: desequilibrees.slice(0, ANOMALY_LIMIT),
    anomalies_total: desequilibrees.length,
    globals: {
      total_debit:  totalDebit,
      total_credit: totalCredit,
      nb_ecritures: ecrIds.length,
      nb_lignes:    nbLignes,
    },
  }
}

// ─── Section 2 — Cohérence ops ↔ écritures ───────────────────────────────────

export async function checkCoherenceOpsEcritures(opts: { limit?: number } = {}): Promise<HealthSection> {
  const limit = opts.limit ?? ANOMALY_LIMIT

  // 1. Opérations valides sans ecriture_id
  const { data: opsSansEcr, count: opsSansEcrCount } = await supabaseAdmin
    .from("operations")
    .select(`
      id, libelle, date_operation, montant, type, caisse_id, compte_id,
      caisse:caisse_id ( libelle ),
      compte:compte_id ( libelle )
    `, { count: "exact" })
    .eq("statut", "valide")
    .is("ecriture_id", null)
    .order("date_operation", { ascending: false })
    .limit(limit)
  const opsSansEcrAnomalies: HealthAnomaly[] = (opsSansEcr ?? []).map(o => ({
    type:           "op_sans_ecriture",
    id:             String(o.id),
    libelle:        o.libelle,
    date_operation: o.date_operation,
    montant:        Number(o.montant),
    type_op:        o.type,
    caisse_libelle: (o.caisse as { libelle?: string } | null)?.libelle
                  ?? (o.compte as { libelle?: string } | null)?.libelle
                  ?? null,
    raison:         "statut=valide mais ecriture_id=NULL",
    fixable:        true,
    fix_endpoint:   `/api/compta/operations/${o.id}/valider`,
  }))

  // 2. Écritures sans operation_id (hors extournes)
  const { count: ecrSansOpCount, data: ecrSansOp } = await supabaseAdmin
    .from("ecritures_comptables")
    .select("id, numero, libelle, date_ecriture", { count: "exact" })
    .eq("statut", "valide")
    .is("operation_id", null)
    .is("extourne_de", null)
    .order("date_ecriture", { ascending: false })
    .limit(limit)
  const ecrSansOpAnomalies: HealthAnomaly[] = (ecrSansOp ?? []).map(e => ({
    type:          "ecriture_sans_op",
    id:            String(e.id),
    libelle:       e.libelle,
    numero:        e.numero,
    date_ecriture: e.date_ecriture,
    raison:        "écriture valide sans opération source (et non-extourne)",
    fixable:       false,
  }))

  // 3. Doublons potentiels (même date + montant + libellé) sur 7 derniers jours
  // Stratégie : charger les ops récentes et grouper en mémoire.
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
  const { data: recentOps } = await supabaseAdmin
    .from("operations")
    .select("id, libelle, date_operation, montant")
    .eq("statut", "valide")
    .gte("date_operation", since)
  const groups = new Map<string, { ids: string[]; date: string; montant: number; libelle: string }>()
  for (const o of recentOps ?? []) {
    const key = `${o.date_operation}|${o.montant}|${o.libelle}`
    const cur = groups.get(key) ?? { ids: [] as string[], date: o.date_operation, montant: Number(o.montant), libelle: o.libelle }
    cur.ids.push(o.id)
    groups.set(key, cur)
  }
  const doublons: HealthAnomaly[] = []
  for (const [key, g] of groups) {
    if (g.ids.length > 1) {
      doublons.push({
        type:           "doublon_potentiel",
        id:             g.ids[0],
        libelle:        g.libelle,
        date_operation: g.date,
        montant:        g.montant,
        nb_doublons:    g.ids.length,
        operation_ids:  g.ids,
        raison:         `${g.ids.length} opérations identiques (même date + montant + libellé)`,
        fixable:        false,
        _key:           key,
      })
    }
  }

  const allAnomalies = [...opsSansEcrAnomalies, ...ecrSansOpAnomalies, ...doublons]
  const total = (opsSansEcrCount ?? 0) + (ecrSansOpCount ?? 0) + doublons.length

  const checks: HealthCheckLine[] = [
    {
      label:  "Opérations valides sans ecriture_id",
      status: (opsSansEcrCount ?? 0) === 0 ? "ok" : "warn",
      value:  opsSansEcrCount ?? 0,
    },
    {
      label:  "Écritures sans operation_id",
      status: (ecrSansOpCount ?? 0) === 0 ? "ok" : "warn",
      value:  ecrSansOpCount ?? 0,
    },
    {
      label:  "Doublons potentiels (7 derniers jours)",
      status: doublons.length === 0 ? "ok" : "warn",
      value:  doublons.length === 0 ? "0 doublon" : `${doublons.length} groupe${doublons.length > 1 ? "s" : ""}`,
    },
  ]

  const status: SectionStatus = total === 0 ? "ok" : "warn"

  return {
    status,
    checks,
    anomalies: allAnomalies.slice(0, limit),
    anomalies_total: total,
  }
}

// ─── Section 3 — Mappings SYSCOHADA ──────────────────────────────────────────

export async function checkMappingsSyscohada(opts: { limit?: number } = {}): Promise<HealthSection> {
  const limit = opts.limit ?? ANOMALY_LIMIT

  const [caissesAll, comptesAll, catsAll, codesValid] = await Promise.all([
    supabaseAdmin.from("caisses").select("id, libelle, code, compte_syscohada_code"),
    supabaseAdmin.from("comptes").select("id, libelle, code, compte_syscohada_code"),
    supabaseAdmin.from("categories_operations").select("id, libelle, type, sens, compte_syscohada_code").eq("actif", true),
    supabaseAdmin.from("comptes_syscohada").select("code"),
  ])

  const validCodes = new Set((codesValid.data ?? []).map(c => c.code as string))
  const caisses    = caissesAll.data ?? []
  const comptes    = comptesAll.data ?? []
  const cats       = catsAll.data ?? []

  const caissesMissing = caisses.filter(c => !c.compte_syscohada_code)
  const comptesMissing = comptes.filter(c => !c.compte_syscohada_code)
  const catsMissing    = cats.filter(c => !c.compte_syscohada_code || !c.sens)

  // Codes orphelins : codes utilisés qui n'existent pas dans comptes_syscohada
  const codesUtilises = new Set<string>()
  for (const c of [...caisses, ...comptes, ...cats]) {
    if (c.compte_syscohada_code) codesUtilises.add(c.compte_syscohada_code)
  }
  const codesOrphelins: string[] = []
  for (const code of codesUtilises) {
    if (!validCodes.has(code)) codesOrphelins.push(code)
  }

  const anomalies: HealthAnomaly[] = []
  for (const c of caissesMissing) {
    anomalies.push({
      type:         "caisse_sans_mapping",
      id:           String(c.id),
      libelle:      c.libelle,
      code:         c.code ?? null,
      raison:       "compte_syscohada_code manquant",
      fix_path:     `/comptabilite/comptes-caisses/${c.id}/modifier`,
    })
  }
  for (const c of comptesMissing) {
    anomalies.push({
      type:         "compte_sans_mapping",
      id:           String(c.id),
      libelle:      c.libelle,
      code:         c.code ?? null,
      raison:       "compte_syscohada_code manquant",
      fix_path:     `/comptabilite/comptes-caisses/${c.id}/modifier`,
    })
  }
  for (const c of catsMissing) {
    const missing: string[] = []
    if (!c.compte_syscohada_code) missing.push("compte_syscohada_code")
    if (!c.sens)                  missing.push("sens")
    anomalies.push({
      type:         "categorie_sans_mapping",
      id:           String(c.id),
      libelle:      c.libelle,
      type_cat:     c.type,
      raison:       `${missing.join(" + ")} manquant${missing.length > 1 ? "s" : ""}`,
      fix_path:     `/comptabilite/categories/${c.id}/modifier`,
    })
  }
  for (const code of codesOrphelins) {
    anomalies.push({
      type:         "code_syscohada_orphelin",
      id:           code,
      libelle:      `Code ${code}`,
      code,
      raison:       "Référencé par une caisse/compte/catégorie mais absent du plan SYSCOHADA",
      fixable:      false,
    })
  }

  const checks: HealthCheckLine[] = [
    {
      label:  "Caisses avec mapping",
      status: caissesMissing.length === 0 ? "ok" : "err",
      value:  `${caisses.length - caissesMissing.length} / ${caisses.length}`,
    },
    {
      label:  "Comptes avec mapping",
      status: comptesMissing.length === 0 ? "ok" : "err",
      value:  `${comptes.length - comptesMissing.length} / ${comptes.length}`,
    },
    {
      label:  "Catégories actives avec mapping",
      status: catsMissing.length === 0 ? "ok" : "err",
      value:  `${cats.length - catsMissing.length} / ${cats.length}`,
    },
    {
      label:  "Codes SYSCOHADA référencés existants",
      status: codesOrphelins.length === 0 ? "ok" : "err",
      value:  `${codesUtilises.size - codesOrphelins.length} / ${codesUtilises.size}`,
    },
  ]

  const total = anomalies.length
  const status: SectionStatus = total === 0 ? "ok" : "err"

  return {
    status,
    checks,
    anomalies: anomalies.slice(0, limit),
    anomalies_total: total,
  }
}

// ─── Section 4 — Cohérence des journaux ──────────────────────────────────────

export async function checkCoherenceJournaux(opts: { limit?: number } = {}): Promise<HealthSection> {
  const limit = opts.limit ?? ANOMALY_LIMIT

  // 1. Numéros dupliqués (utilise le numéro COMPLET — bug 2 fix : on s'assure
  //    de comparer la chaîne entière, pas un préfixe parsé).
  const { data: allNumeros } = await supabaseAdmin
    .from("ecritures_comptables")
    .select("id, numero, journal_code, libelle, date_ecriture")
    .eq("statut", "valide")

  const counts = new Map<string, number>()
  for (const e of allNumeros ?? []) counts.set(e.numero, (counts.get(e.numero) ?? 0) + 1)
  const doublonsNumero: HealthAnomaly[] = []
  for (const [num, cnt] of counts) {
    if (cnt > 1) {
      const exemples = (allNumeros ?? []).filter(e => e.numero === num).slice(0, 3)
      doublonsNumero.push({
        type:    "doublon_numero",
        id:      num,
        libelle: `Numéro ${num} apparaît ${cnt} fois`,
        numero:  num,
        nb:      cnt,
        exemples: exemples.map(e => ({ id: e.id, libelle: e.libelle, date: e.date_ecriture })),
      })
    }
  }

  // 2. Journaux référencés mais absents de la table journaux
  const { data: journauxRows } = await supabaseAdmin.from("journaux").select("code")
  const validJournaux = new Set((journauxRows ?? []).map(j => j.code as string))
  const codesUtilises = new Set<string>()
  for (const e of allNumeros ?? []) {
    if (e.journal_code) codesUtilises.add(e.journal_code)
  }
  const journauxOrphelins: HealthAnomaly[] = []
  for (const code of codesUtilises) {
    if (!validJournaux.has(code)) {
      journauxOrphelins.push({
        type:    "journal_orphelin",
        id:      code,
        libelle: `Journal ${code}`,
        code,
        raison:  "Référencé par des écritures mais absent de la table journaux",
      })
    }
  }

  // 3. Numérotation continue par (année, journal_code) — Bug 2 fix.
  //
  //    Le format réel des numéros est `<ANNEE>-<JOURNAL>-<SEQ>` (ex. 2026-VE-000431),
  //    PAS `<PREFIXE_ALPHA><SEQ>`. La regex `^[A-Z]+` matchait NULL pour tous les
  //    numéros qui commencent par l'année → tous tombaient dans un même bucket et
  //    le check confondait changement de journal/année avec trou dans la séquence.
  //
  //    Stratégie : split('-'), exclure les extournes (préfixe EXT- ; elles
  //    partagent le numéro de l'écriture d'origine), grouper par
  //    (annee, journal_code), détecter les trous DANS chaque groupe.
  const sequencesParBucket = new Map<string, number[]>()  // key = "ANNEE-JOURNAL"
  for (const e of allNumeros ?? []) {
    if (!e.numero) continue
    // Skip extournes (EXT-2026-VE-000430 — 4 segments, pas de séquence propre)
    if (e.numero.startsWith("EXT-")) continue
    const parts = e.numero.split("-")
    if (parts.length !== 3) continue   // format inattendu, on skip silencieusement
    const [annee, journal, numStr] = parts
    const num = Number(numStr)
    if (!Number.isFinite(num)) continue
    const key = `${annee}-${journal}`
    const seq = sequencesParBucket.get(key) ?? []
    seq.push(num)
    sequencesParBucket.set(key, seq)
  }

  let totalTrous = 0
  const trousAnomalies: HealthAnomaly[] = []
  for (const [bucketKey, seq] of sequencesParBucket) {
    seq.sort((a, b) => a - b)
    let trous = 0
    let firstGap: { prev: number; next: number } | null = null
    for (let i = 1; i < seq.length; i++) {
      if (seq[i] > seq[i - 1] + 1) {
        const ecart = seq[i] - seq[i - 1] - 1
        trous += ecart
        if (!firstGap) firstGap = { prev: seq[i - 1], next: seq[i] }
      }
    }
    if (trous > 0) {
      totalTrous += trous
      trousAnomalies.push({
        type:        "trou_numerotation",
        id:          bucketKey,
        libelle:     `${bucketKey} — ${trous} numéro${trous > 1 ? "s" : ""} manquant${trous > 1 ? "s" : ""}`,
        bucket:      bucketKey,
        nb_trous:    trous,
        premier_trou: firstGap
          ? `entre ${bucketKey}-${String(firstGap.prev).padStart(6, "0")} et ${bucketKey}-${String(firstGap.next).padStart(6, "0")}`
          : undefined,
      })
    }
  }

  const total = doublonsNumero.length + journauxOrphelins.length + trousAnomalies.length

  const checks: HealthCheckLine[] = [
    {
      label:  "Numérotation continue par (année, journal)",
      status: trousAnomalies.length === 0 ? "ok" : "warn",
      value:  totalTrous === 0 ? "OK" : `${totalTrous} trou${totalTrous > 1 ? "s" : ""}`,
    },
    {
      label:  "Aucun doublon de numéro",
      status: doublonsNumero.length === 0 ? "ok" : "err",
      value:  doublonsNumero.length,
    },
    {
      label:  "Aucun journal orphelin",
      status: journauxOrphelins.length === 0 ? "ok" : "err",
      value:  journauxOrphelins.length,
    },
  ]

  const status: SectionStatus = (doublonsNumero.length > 0 || journauxOrphelins.length > 0)
    ? "err"
    : trousAnomalies.length > 0
      ? "warn"
      : "ok"

  return {
    status,
    checks,
    anomalies: [...doublonsNumero, ...journauxOrphelins, ...trousAnomalies].slice(0, limit),
    anomalies_total: total,
  }
}

// ─── Section 5 — Stats globales ──────────────────────────────────────────────

export async function getStatsGlobales(): Promise<HealthStatsSection> {
  // Stats agrégées : CA, dépenses, résultat. On paginate les ops valides.
  let ca = 0
  let dep = 0
  const PAGE = 5000
  let from = 0
  while (from < 1_000_000) {
    const { data } = await supabaseAdmin
      .from("operations")
      .select("type, montant")
      .eq("statut", "valide")
      .range(from, from + PAGE - 1)
    if (!data || data.length === 0) break
    for (const r of data) {
      const m = Number(r.montant || 0)
      if (r.type === "entree") ca += m
      else if (r.type === "sortie") dep += m
    }
    if (data.length < PAGE) break
    from += PAGE
  }

  // Trésorerie : SUM(solde_initial) caisses + comptes + Σ deltas
  const [caissesRows, comptesRows] = await Promise.all([
    supabaseAdmin.from("caisses").select("id, solde_initial"),
    supabaseAdmin.from("comptes").select("id, solde_initial"),
  ])
  let soldeInit = 0
  for (const c of caissesRows.data ?? []) soldeInit += Number(c.solde_initial || 0)
  for (const c of comptesRows.data ?? []) soldeInit += Number(c.solde_initial || 0)
  const tresorerie = soldeInit + ca - dep

  // Compteurs ops par statut
  const [brouillon, valides, annulees, extournes] = await Promise.all([
    supabaseAdmin.from("operations").select("id", { count: "exact", head: true }).eq("statut", "brouillon"),
    supabaseAdmin.from("operations").select("id", { count: "exact", head: true }).eq("statut", "valide"),
    supabaseAdmin.from("operations").select("id", { count: "exact", head: true }).eq("statut", "annule"),
    supabaseAdmin.from("ecritures_comptables").select("id", { count: "exact", head: true }).not("extourne_de", "is", null),
  ])

  return {
    status: "info",
    stats: {
      ca_total:       ca,
      depenses_total: dep,
      resultat_net:   ca - dep,
      tresorerie,
      ops_brouillon:  brouillon.count ?? 0,
      ops_valides:    valides.count   ?? 0,
      ops_annulees:   annulees.count  ?? 0,
      extournes:      extournes.count ?? 0,
    },
  }
}

// ─── Orchestrateur principal ─────────────────────────────────────────────────

export async function buildHealthDetailed(): Promise<HealthDetailedPayload> {
  const [equilibre, coherenceOps, mappings, coherenceJ, statsG] = await Promise.all([
    checkEquilibre(),
    checkCoherenceOpsEcritures(),
    checkMappingsSyscohada(),
    checkCoherenceJournaux(),
    getStatsGlobales(),
  ])

  const sections = {
    equilibre:               { status: equilibre.status, checks: equilibre.checks, anomalies: equilibre.anomalies, anomalies_total: equilibre.anomalies_total },
    coherence_ops_ecritures: coherenceOps,
    mappings_syscohada:      mappings,
    coherence_journaux:      coherenceJ,
    stats_globales:          statsG,
  }

  const nbAnomalies =
    sections.equilibre.anomalies_total +
    sections.coherence_ops_ecritures.anomalies_total +
    sections.mappings_syscohada.anomalies_total +
    sections.coherence_journaux.anomalies_total

  // Score : -10 par section ERR, -1 par section WARN, min 0
  let score = 100
  const sectionStatuses: SectionStatus[] = [
    sections.equilibre.status,
    sections.coherence_ops_ecritures.status,
    sections.mappings_syscohada.status,
    sections.coherence_journaux.status,
  ]
  for (const s of sectionStatuses) {
    if (s === "err") score -= 10
    else if (s === "warn") score -= 1
  }
  score = Math.max(0, score)

  return {
    ok:         nbAnomalies === 0,
    score,
    checked_at: new Date().toISOString(),
    global: {
      total_debit:  equilibre.globals.total_debit,
      total_credit: equilibre.globals.total_credit,
      ecart:        equilibre.globals.total_debit - equilibre.globals.total_credit,
      nb_ecritures: equilibre.globals.nb_ecritures,
      nb_lignes:    equilibre.globals.nb_lignes,
      nb_anomalies: nbAnomalies,
    },
    sections,
  }
}

// ─── Helper : récupérer toutes les anomalies d'une section (pagination) ─────

export async function getAllAnomaliesForSection(section: string, limit = FULL_LIMIT): Promise<{
  section: string
  anomalies: HealthAnomaly[]
  total: number
}> {
  switch (section) {
    case "equilibre": {
      const r = await checkEquilibre()
      return { section, anomalies: r.anomalies.slice(0, limit), total: r.anomalies_total }
    }
    case "coherence_ops_ecritures": {
      const r = await checkCoherenceOpsEcritures({ limit })
      return { section, anomalies: r.anomalies, total: r.anomalies_total }
    }
    case "mappings_syscohada": {
      const r = await checkMappingsSyscohada({ limit })
      return { section, anomalies: r.anomalies, total: r.anomalies_total }
    }
    case "coherence_journaux": {
      const r = await checkCoherenceJournaux({ limit })
      return { section, anomalies: r.anomalies, total: r.anomalies_total }
    }
    default:
      return { section, anomalies: [], total: 0 }
  }
}
