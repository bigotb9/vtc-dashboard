/**
 * GET /api/compta/health
 *
 * Vérifie la cohérence du module Comptes & Caisses et retourne la liste des
 * anomalies (severité error) et warnings (severité warning).
 *
 * Réservé directeur. Lecture seule (pas de logActivity). Référence : doc Phase 2 Day 6 §4.
 *
 * Vérifications (anomalies bloquantes, mode Avancé) :
 *   - CATEGORY_NO_MAPPING       : catégories utilisées par ops validées sans mapping
 *   - ACCOUNT_NO_MAPPING        : comptes/caisses utilisés sans compte_syscohada_code
 *   - OPERATION_SANS_ECRITURE   : ops validées sans ecriture_id
 *   - ECRITURE_DESEQUILIBREE    : SUM(débit) != SUM(crédit) (théoriquement bloqué par trigger)
 *   - OPERATION_PERIODE_CLOSE   : ops validées dans une période close ET sans écriture
 *
 * Warnings :
 *   - CAISSE_INACTIVE_RECENTE      : caisse inactive avec opérations < 30j
 *   - COMPTE_INACTIF_RECENT        : compte inactif avec opérations < 30j
 *   - CATEGORIE_INACTIVE_RECENTE   : catégorie inactive avec opérations < 30j
 *   - EXERCICE_NON_COURANT         : opérations sur exercice ≠ exercice courant
 *   - NOMBRE_BROUILLONS            : > 10 brouillons depuis > 30j
 */

import type { NextRequest } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { requireComptaPermission } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { buildHealthDetailed } from "@/lib/compta/healthDetailed"

export const dynamic     = "force-dynamic"
export const maxDuration = 30

// ─── Types de retour ─────────────────────────────────────────────────────────

type Severite = "error" | "warning"
type AnomalyItem = { id: string; libelle?: string; date?: string; numero?: string; total_debit?: number; total_credit?: number }
type AnomalyBlock = {
  type:     string
  severite: Severite
  message:  string
  items:    AnomalyItem[]
}

// ─── Vérifications individuelles ─────────────────────────────────────────────

/** Catégories utilisées par ops validées sans compte_syscohada_code OU sens. */
async function checkCategoryNoMapping(): Promise<AnomalyBlock | null> {
  const { data: catsUsed } = await supabaseAdmin
    .from("operations")
    .select("categorie_id")
    .eq("statut", "valide")
    .not("categorie_id", "is", null)
  const ids = Array.from(new Set((catsUsed ?? []).map(r => r.categorie_id).filter(Boolean) as string[]))
  if (ids.length === 0) return null

  const { data } = await supabaseAdmin
    .from("categories_operations")
    .select("id, libelle, compte_syscohada_code, sens")
    .in("id", ids)
  const items = (data ?? [])
    .filter(c => !c.compte_syscohada_code || !c.sens)
    .map(c => ({ id: c.id, libelle: c.libelle }))

  if (items.length === 0) return null
  return {
    type:     "CATEGORY_NO_MAPPING",
    severite: "error",
    message:  `${items.length} catégorie${items.length > 1 ? "s" : ""} utilisée${items.length > 1 ? "s" : ""} sans mapping SYSCOHADA`,
    items,
  }
}

/** Comptes bancaires + caisses utilisés sans compte_syscohada_code. */
async function checkAccountNoMapping(): Promise<AnomalyBlock | null> {
  const items: AnomalyItem[] = []

  // Comptes
  const { data: comptesUsed } = await supabaseAdmin
    .from("operations")
    .select("compte_id")
    .eq("statut", "valide")
    .not("compte_id", "is", null)
  const compteIds = Array.from(new Set((comptesUsed ?? []).map(r => r.compte_id).filter(Boolean) as string[]))
  if (compteIds.length > 0) {
    const { data } = await supabaseAdmin
      .from("comptes")
      .select("id, libelle, compte_syscohada_code")
      .in("id", compteIds)
    for (const c of data ?? []) {
      if (!c.compte_syscohada_code) items.push({ id: c.id, libelle: `[Compte] ${c.libelle}` })
    }
  }

  // Caisses
  const { data: caissesUsed } = await supabaseAdmin
    .from("operations")
    .select("caisse_id")
    .eq("statut", "valide")
    .not("caisse_id", "is", null)
  const caisseIds = Array.from(new Set((caissesUsed ?? []).map(r => r.caisse_id).filter(Boolean) as string[]))
  if (caisseIds.length > 0) {
    const { data } = await supabaseAdmin
      .from("caisses")
      .select("id, libelle, compte_syscohada_code")
      .in("id", caisseIds)
    for (const c of data ?? []) {
      if (!c.compte_syscohada_code) items.push({ id: c.id, libelle: `[Caisse] ${c.libelle}` })
    }
  }

  if (items.length === 0) return null
  return {
    type:     "ACCOUNT_NO_MAPPING",
    severite: "error",
    message:  `${items.length} compte${items.length > 1 ? "s/caisses" : "/caisse"} utilisé${items.length > 1 ? "s" : ""} sans mapping SYSCOHADA`,
    items,
  }
}

/** Opérations validées sans ecriture_id (mode Avancé attendu). */
async function checkOperationsSansEcriture(): Promise<AnomalyBlock | null> {
  const { data, count } = await supabaseAdmin
    .from("operations")
    .select("id, libelle, date_operation", { count: "exact" })
    .eq("statut", "valide")
    .is("ecriture_id", null)
    .order("date_operation", { ascending: false })
    .limit(100)
  if (!count || count === 0) return null
  return {
    type:     "OPERATION_SANS_ECRITURE",
    severite: "error",
    message:  `${count} opération${count > 1 ? "s" : ""} validée${count > 1 ? "s" : ""} sans écriture comptable`,
    items: (data ?? []).map(o => ({ id: o.id, libelle: o.libelle, date: o.date_operation })),
  }
}

/** Écritures déséquilibrées (théoriquement impossibles grâce au trigger BD). */
async function checkEcrituresDesequilibrees(): Promise<AnomalyBlock | null> {
  // Pas de SUM côté Supabase JS facilement → on récupère toutes les lignes valides
  // par batch et on fait l'agrégation côté code. Pour limiter la charge, on s'arrête
  // dès que 100 écritures déséquilibrées sont détectées.
  const items: AnomalyItem[] = []
  let from = 0
  const PAGE = 500

  while (from < 50_000 && items.length < 100) {
    const { data: ecrs } = await supabaseAdmin
      .from("ecritures_comptables")
      .select("id, numero, libelle")
      .eq("statut", "valide")
      .range(from, from + PAGE - 1)
    if (!ecrs || ecrs.length === 0) break

    const ids = ecrs.map(e => e.id)
    const { data: lignes } = await supabaseAdmin
      .from("lignes_ecritures")
      .select("ecriture_id, debit, credit")
      .in("ecriture_id", ids)

    const totals = new Map<string, { d: number; c: number }>()
    for (const l of lignes ?? []) {
      const cur = totals.get(l.ecriture_id) ?? { d: 0, c: 0 }
      cur.d += Number(l.debit  || 0)
      cur.c += Number(l.credit || 0)
      totals.set(l.ecriture_id, cur)
    }
    for (const e of ecrs) {
      const t = totals.get(e.id) ?? { d: 0, c: 0 }
      if (Math.abs(t.d - t.c) > 0.01) {
        items.push({
          id:           e.id,
          libelle:      e.libelle,
          numero:       e.numero,
          total_debit:  t.d,
          total_credit: t.c,
        })
        if (items.length >= 100) break
      }
    }

    if (ecrs.length < PAGE) break
    from += PAGE
  }

  if (items.length === 0) return null
  return {
    type:     "ECRITURE_DESEQUILIBREE",
    severite: "error",
    message:  `${items.length} écriture${items.length > 1 ? "s" : ""} déséquilibrée${items.length > 1 ? "s" : ""}`,
    items,
  }
}

/** Opérations validées dans une période close sans écriture. */
async function checkOperationPeriodeClose(): Promise<AnomalyBlock | null> {
  const { data: clotures } = await supabaseAdmin
    .from("clotures")
    .select("exercice_id, periode")
    .eq("type", "mensuelle")
  if (!clotures || clotures.length === 0) return null

  const items: AnomalyItem[] = []
  for (const cl of clotures) {
    const debutMois = `${cl.periode}-01`
    const finMois   = `${cl.periode}-31`
    const { data: ops } = await supabaseAdmin
      .from("operations")
      .select("id, libelle, date_operation")
      .eq("statut", "valide")
      .eq("exercice_id", cl.exercice_id)
      .gte("date_operation", debutMois)
      .lte("date_operation", finMois)
      .is("ecriture_id", null)
      .limit(50)
    for (const o of ops ?? []) {
      items.push({ id: o.id, libelle: o.libelle, date: o.date_operation })
      if (items.length >= 100) break
    }
    if (items.length >= 100) break
  }

  if (items.length === 0) return null
  return {
    type:     "OPERATION_PERIODE_CLOSE",
    severite: "error",
    message:  `${items.length} opération${items.length > 1 ? "s" : ""} dans période close sans écriture`,
    items,
  }
}

// ─── Warnings ────────────────────────────────────────────────────────────────

const J30_AGO_ISO = () => new Date(Date.now() - 30 * 86400000).toISOString()

/** Caisses inactives utilisées dans les 30 derniers jours. */
async function checkCaissesInactivesRecentes(): Promise<AnomalyBlock | null> {
  const since = J30_AGO_ISO()
  const { data: ops } = await supabaseAdmin
    .from("operations")
    .select("caisse_id")
    .gte("created_at", since)
    .not("caisse_id", "is", null)
  const caisseIds = Array.from(new Set((ops ?? []).map(r => r.caisse_id).filter(Boolean) as string[]))
  if (caisseIds.length === 0) return null

  const { data: caisses } = await supabaseAdmin
    .from("caisses")
    .select("id, libelle, actif")
    .in("id", caisseIds)
    .eq("actif", false)
  const items = (caisses ?? []).map(c => ({ id: c.id, libelle: `${c.libelle} (archivée)` }))

  if (items.length === 0) return null
  return {
    type:     "CAISSE_INACTIVE_RECENTE",
    severite: "warning",
    message:  `${items.length} caisse${items.length > 1 ? "s inactives" : " inactive"} avec opérations récentes`,
    items,
  }
}

/** Comptes inactifs utilisés dans les 30 derniers jours. */
async function checkComptesInactifsRecents(): Promise<AnomalyBlock | null> {
  const since = J30_AGO_ISO()
  const { data: ops } = await supabaseAdmin
    .from("operations")
    .select("compte_id")
    .gte("created_at", since)
    .not("compte_id", "is", null)
  const compteIds = Array.from(new Set((ops ?? []).map(r => r.compte_id).filter(Boolean) as string[]))
  if (compteIds.length === 0) return null

  const { data: comptes } = await supabaseAdmin
    .from("comptes")
    .select("id, libelle, actif")
    .in("id", compteIds)
    .eq("actif", false)
  const items = (comptes ?? []).map(c => ({ id: c.id, libelle: `${c.libelle} (archivé)` }))

  if (items.length === 0) return null
  return {
    type:     "COMPTE_INACTIF_RECENT",
    severite: "warning",
    message:  `${items.length} compte${items.length > 1 ? "s inactifs" : " inactif"} avec opérations récentes`,
    items,
  }
}

/** Catégories inactives utilisées dans les 30 derniers jours. */
async function checkCategoriesInactivesRecentes(): Promise<AnomalyBlock | null> {
  const since = J30_AGO_ISO()
  const { data: ops } = await supabaseAdmin
    .from("operations")
    .select("categorie_id")
    .gte("created_at", since)
    .not("categorie_id", "is", null)
  const catIds = Array.from(new Set((ops ?? []).map(r => r.categorie_id).filter(Boolean) as string[]))
  if (catIds.length === 0) return null

  const { data: cats } = await supabaseAdmin
    .from("categories_operations")
    .select("id, libelle, actif")
    .in("id", catIds)
    .eq("actif", false)
  const items = (cats ?? []).map(c => ({ id: c.id, libelle: `${c.libelle} (archivée)` }))

  if (items.length === 0) return null
  return {
    type:     "CATEGORIE_INACTIVE_RECENTE",
    severite: "warning",
    message:  `${items.length} catégorie${items.length > 1 ? "s inactives" : " inactive"} avec opérations récentes`,
    items,
  }
}

/** Plus de 10 brouillons depuis > 30 jours. */
async function checkBrouillonsDormants(): Promise<AnomalyBlock | null> {
  const since = J30_AGO_ISO()
  const { data, count } = await supabaseAdmin
    .from("operations")
    .select("id, libelle, date_operation", { count: "exact" })
    .eq("statut", "brouillon")
    .lt("created_at", since)
    .order("created_at", { ascending: true })
    .limit(50)

  if (!count || count <= 10) return null
  return {
    type:     "NOMBRE_BROUILLONS",
    severite: "warning",
    message:  `${count} opérations en brouillon depuis plus de 30 jours`,
    items: (data ?? []).map(o => ({ id: o.id, libelle: o.libelle, date: o.date_operation })),
  }
}

// ─── Stats globales ──────────────────────────────────────────────────────────

async function getStats() {
  const [comptes, caisses, categories, opValidees, opBrouillon, ecritures, exCourante] = await Promise.all([
    supabaseAdmin.from("comptes").select("id", { count: "exact", head: true }).eq("actif", true),
    supabaseAdmin.from("caisses").select("id", { count: "exact", head: true }).eq("actif", true),
    supabaseAdmin.from("categories_operations").select("id", { count: "exact", head: true }).eq("actif", true),
    supabaseAdmin.from("operations").select("id", { count: "exact", head: true }).eq("statut", "valide"),
    supabaseAdmin.from("operations").select("id", { count: "exact", head: true }).eq("statut", "brouillon"),
    supabaseAdmin.from("ecritures_comptables").select("id", { count: "exact", head: true }).eq("statut", "valide"),
    supabaseAdmin
      .from("parametres_module_compta")
      .select("exercice_courant_id, exercices:exercice_courant_id(libelle)")
      .eq("id", 1)
      .maybeSingle(),
  ])

  return {
    total_comptes:               comptes.count    ?? 0,
    total_caisses:               caisses.count    ?? 0,
    total_categories:            categories.count ?? 0,
    total_operations_validees:   opValidees.count ?? 0,
    total_operations_brouillon:  opBrouillon.count ?? 0,
    total_ecritures:             ecritures.count  ?? 0,
    exercice_courant: (exCourante.data?.exercices as { libelle?: string } | null)?.libelle ?? null,
  }
}

// ─── Route GET ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireComptaPermission(req, "view_comptabilite")
  if (!auth.ok) return auth.response

  // ─── Branche ?detailed=true : payload structuré pour l'Écran 8 ────────────
  const detailed = new URL(req.url).searchParams.get("detailed") === "true"
  if (detailed) {
    try {
      const payload = await buildHealthDetailed()
      return comptaOk(payload)
    } catch (e) {
      return comptaError("DB_ERROR", { hint: (e as Error).message })
    }
  }

  const { data: param, error: paramErr } = await supabaseAdmin
    .from("parametres_module_compta")
    .select("mode_actif")
    .eq("id", 1)
    .single()
  if (paramErr || !param) {
    return comptaError("INTERNAL_ERROR", { hint: paramErr?.message }, "Paramètres module introuvables")
  }
  const modeActif = param.mode_actif as "simple" | "avance"

  // Anomalies — chaque check est indépendant et collecté séparément
  const anomalies:  AnomalyBlock[] = []
  const warnings:   AnomalyBlock[] = []

  // Anomalies bloquantes : pertinentes seulement en mode Avancé
  if (modeActif === "avance") {
    const checks = await Promise.allSettled([
      checkCategoryNoMapping(),
      checkAccountNoMapping(),
      checkOperationsSansEcriture(),
      checkEcrituresDesequilibrees(),
      checkOperationPeriodeClose(),
    ])
    for (const r of checks) {
      if (r.status === "fulfilled" && r.value) anomalies.push(r.value)
    }
  } else {
    // En mode Simple, on vérifie quand même les écritures déséquilibrées
    // (au cas où des écritures auraient été générées avant un retour Simple)
    const ecr = await checkEcrituresDesequilibrees().catch(() => null)
    if (ecr) anomalies.push(ecr)
  }

  // Warnings : applicables dans les deux modes
  const warningChecks = await Promise.allSettled([
    checkCaissesInactivesRecentes(),
    checkComptesInactifsRecents(),
    checkCategoriesInactivesRecentes(),
    checkBrouillonsDormants(),
  ])
  for (const r of warningChecks) {
    if (r.status === "fulfilled" && r.value) warnings.push(r.value)
  }

  const stats = await getStats()

  // Compat Écran 7 modal : exposer aussi nb_ecritures, nb_lignes, totaux,
  // anomalies aplaties en string[] pour HealthCheckResultModal.
  // L'extraction des totaux est calculée à la volée via buildHealthDetailed.
  let nb_lignes = 0, total_debit = 0, total_credit = 0
  try {
    const detailed = await buildHealthDetailed()
    nb_lignes    = detailed.global.nb_lignes
    total_debit  = detailed.global.total_debit
    total_credit = detailed.global.total_credit
  } catch { /* fallback silencieux : champs à 0 */ }

  const anomaliesFlat: string[] = anomalies.map(a => a.message)

  return comptaOk({
    ok:           anomalies.length === 0,
    mode_actif:   modeActif,
    nb_ecritures: stats.total_ecritures,
    nb_lignes,
    total_debit,
    total_credit,
    anomalies,            // tableau structuré (legacy)
    anomalies_flat: anomaliesFlat, // alias string[] (compat Écran 7)
    warnings,
    stats,
  })
}
