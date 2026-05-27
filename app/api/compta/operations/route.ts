/**
 * GET  /api/compta/operations
 * POST /api/compta/operations
 *
 * Réservé directeur. Référence : doc Phase 2 §7.1 / §7.2.
 *
 * GET  : pagination, filtres date_from/to, type, statut (multi),
 *        compte_id, caisse_id, categorie_id, source, vehicule_id, chauffeur_id,
 *        client_id, recherche (sur libelle), tri.
 * POST : création avec validation Zod + cohérences métier + génération
 *        d'écriture si mode='avance' et statut final='valide'.
 */

import type { NextRequest } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { logActivity } from "@/lib/logActivity"
import { requireDirecteurCompta } from "@/lib/compta/auth"
import { comptaError, comptaOk, comptaOkList } from "@/lib/compta/errors"
import { operationSchema, safeParse } from "@/lib/compta/validators"
import { getExerciceForDate } from "@/lib/compta/soldes"
import {
  getModeActif,
  genererEcritureFromOperation,
  EcritureError,
} from "@/lib/compta/ecritures"

export const dynamic = "force-dynamic"

const ALLOWED_STATUTS = new Set(["brouillon", "valide", "annule"])
const ALLOWED_TYPES   = new Set(["entree", "sortie"])
const ALLOWED_SOURCES = new Set([
  "manuel", "recette_wave", "depense_vehicule", "versement_client",
  "import_csv", "transfert_interne", "dotation_amort",
])

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  const url = new URL(req.url)

  // Pagination
  const page      = Math.max(1, Number(url.searchParams.get("page") ?? "1"))
  const pageSize  = Math.min(200, Math.max(1, Number(url.searchParams.get("page_size") ?? "50")))
  const from      = (page - 1) * pageSize
  const to        = from + pageSize - 1

  // Filtres
  const dateFrom    = url.searchParams.get("date_from")
  const dateTo      = url.searchParams.get("date_to")
  const typeFilter  = url.searchParams.get("type")
  const statutsRaw  = url.searchParams.get("statut")
  const compteId    = url.searchParams.get("compte_id")
  const caisseId    = url.searchParams.get("caisse_id")
  const categorieId = url.searchParams.get("categorie_id")
  const sourceRaw   = url.searchParams.get("source")
  const vehiculeId  = url.searchParams.get("vehicule_id")
  const chauffeurId = url.searchParams.get("chauffeur_id")
  const clientId    = url.searchParams.get("client_id")
  // Phase 4.x Vague 2 correctif §2.2 — filtre multi-tiers (CSV ou single)
  const tiersIdsRaw = url.searchParams.get("tiers_ids") ?? url.searchParams.get("tiers_id")
  const tiersIds    = tiersIdsRaw ? tiersIdsRaw.split(",").map(s => s.trim()).filter(Boolean) : null
  // Phase 4.x Vague 3 — filtre Health "sortie vers tiers sans justif"
  const missingProof = url.searchParams.get("missing_proof") === "true"
  const recherche   = url.searchParams.get("recherche")?.trim()

  // Tri
  const sortRaw = url.searchParams.get("sort") ?? "date_operation:desc"
  const [sortCol, sortDir] = sortRaw.split(":")
  const validSortCols = new Set(["date_operation", "created_at", "montant"])
  const col = validSortCols.has(sortCol) ? sortCol : "date_operation"
  const asc = sortDir === "asc"

  // Validations légères
  if (typeFilter && !ALLOWED_TYPES.has(typeFilter)) {
    return comptaError("INVALID_PAYLOAD", { field: "type" })
  }
  if (sourceRaw && !ALLOWED_SOURCES.has(sourceRaw)) {
    return comptaError("INVALID_PAYLOAD", { field: "source" })
  }

  let q = supabaseAdmin
    .from("operations")
    .select(`
      id, date_operation, type, montant, libelle, reference_externe,
      compte_id, caisse_id, categorie_id, tiers_id,
      vehicule_id, chauffeur_id, client_id,
      source, source_ref, statut,
      valide_le, valide_par,
      ecriture_id, exercice_id,
      created_at, created_by, updated_at, updated_by, notes,
      compte:compte_id ( id, libelle, code ),
      caisse:caisse_id ( id, libelle, type, code ),
      categorie:categorie_id ( id, libelle, type ),
      ecriture:ecriture_id ( numero, journal_code ),
      tiers:tiers_id ( id, nom, type, compte_syscohada_code, actif )
    `, { count: "exact" })
    .order(col, { ascending: asc })
    .range(from, to)

  if (dateFrom)    q = q.gte("date_operation", dateFrom)
  if (dateTo)      q = q.lte("date_operation", dateTo)
  if (typeFilter)  q = q.eq("type", typeFilter)
  if (compteId)    q = q.eq("compte_id", compteId)
  if (caisseId)    q = q.eq("caisse_id", caisseId)
  if (categorieId) q = q.eq("categorie_id", categorieId)
  if (sourceRaw)   q = q.eq("source", sourceRaw)
  if (vehiculeId)  q = q.eq("vehicule_id", vehiculeId)
  if (chauffeurId) q = q.eq("chauffeur_id", chauffeurId)
  if (clientId)    q = q.eq("client_id", clientId)
  // Phase 4.x Vague 2 correctif §2.2 — filtre multi-tiers
  if (tiersIds && tiersIds.length > 0) q = q.in("tiers_id", tiersIds)

  if (statutsRaw) {
    const statuts = statutsRaw.split(",").map(s => s.trim()).filter(s => ALLOWED_STATUTS.has(s))
    if (statuts.length > 0) q = q.in("statut", statuts)
  }

  if (recherche) {
    const pattern = `%${recherche.replace(/[%_]/g, m => `\\${m}`)}%`
    q = q.ilike("libelle", pattern)
  }

  // Phase 4.x Vague 3 — filtre Health "sortie vers tiers sans justif"
  // Pré-filtrage : on force les critères candidats. La filtration finale
  // (NOT EXISTS justif actif) est appliquée en Node après lookup count.
  if (missingProof) {
    q = q.eq("type", "sortie").not("tiers_id", "is", null).eq("statut", "valide")
  }

  const { data, count, error } = await q
  if (error) return comptaError("DB_ERROR", { hint: error.message })

  // Enrichissement véhicule/chauffeur (pas de FK formelle côté operations.vehicule_id
  // ni operations.chauffeur_id → on fait 2 SELECT séparés + jointure en mémoire).
  let rows = data ?? []

  // Phase 4.x Vague 3 — appliquer le filtre missing_proof en Node
  // (les ops avec ≥ 1 justif actif sont retirées).
  if (missingProof && rows.length > 0) {
    const candidateIds = rows.map(r => r.id as string)
    const { data: withProof } = await supabaseAdmin
      .from("justificatifs")
      .select("operation_id")
      .in("operation_id", candidateIds)
      .is("deleted_at", null)
    const setWithProof = new Set((withProof ?? []).map(r => (r as { operation_id: string }).operation_id))
    rows = rows.filter(r => !setWithProof.has(r.id as string))
  }
  const idsVehicule = Array.from(new Set(rows.map(r => r.vehicule_id).filter((x): x is number => x != null)))
  const idsChauffeur = Array.from(new Set(rows.map(r => r.chauffeur_id).filter((x): x is number => x != null)))

  const [vehiculesRes, chauffeursRes] = await Promise.all([
    idsVehicule.length > 0
      ? supabaseAdmin.from("vehicules").select("id_vehicule, immatriculation").in("id_vehicule", idsVehicule)
      : Promise.resolve({ data: [] }),
    idsChauffeur.length > 0
      ? supabaseAdmin.from("chauffeurs").select("id_chauffeur, nom").in("id_chauffeur", idsChauffeur)
      : Promise.resolve({ data: [] }),
  ])

  const vMap = new Map<number, { id: number; immatriculation: string | null }>()
  for (const v of vehiculesRes.data ?? []) {
    if (v.id_vehicule != null) vMap.set(v.id_vehicule, { id: v.id_vehicule, immatriculation: v.immatriculation })
  }
  const cMap = new Map<number, { id: number; nom: string | null }>()
  for (const c of chauffeursRes.data ?? []) {
    if (c.id_chauffeur != null) cMap.set(c.id_chauffeur, { id: c.id_chauffeur, nom: c.nom })
  }

  // Phase 4.x Vague 3 — compter les justificatifs actifs par opération (bulk)
  const allOpIds = rows.map(r => r.id as string)
  const justifCount = new Map<string, number>()
  if (allOpIds.length > 0) {
    const { data: js } = await supabaseAdmin
      .from("justificatifs")
      .select("operation_id")
      .in("operation_id", allOpIds)
      .is("deleted_at", null)
    for (const r of (js ?? []) as Array<{ operation_id: string }>) {
      justifCount.set(r.operation_id, (justifCount.get(r.operation_id) ?? 0) + 1)
    }
  }

  const enriched = rows.map(r => ({
    ...r,
    vehicule:  r.vehicule_id  != null ? vMap.get(r.vehicule_id)  ?? null : null,
    chauffeur: r.chauffeur_id != null ? cMap.get(r.chauffeur_id) ?? null : null,
    // Phase 4.x Vague 3 — compteur de justificatifs actifs
    justificatifs_count: justifCount.get(r.id as string) ?? 0,
  }))

  // Note : `count` reflète le total AVANT le post-filtrage missing_proof.
  // Pour V3 simple on accepte cette imprécision (le total affiché côté UI
  // restera cohérent avec la page courante grâce à `enriched.length`).
  return comptaOkList(enriched, {
    total: missingProof ? enriched.length : (count ?? 0),
    page,
    page_size: pageSize,
  })
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return comptaError("INVALID_PAYLOAD", { reason: "JSON malformé" })
  }

  const parsed = safeParse(operationSchema, payload)
  if (!parsed.ok) return comptaError("INVALID_PAYLOAD", { issues: parsed.details })

  const input = parsed.data

  // 1. Vérifier l'existence et l'activité du compte/caisse
  //    FK invalide (id structurellement OK mais absent en BD) → 422
  //    RESOURCE_INVALID. NOT_FOUND (404) est réservé au cas où la ressource
  //    demandée explicitement par l'URL n'existe pas.
  if (input.compte_id) {
    const { data: c } = await supabaseAdmin
      .from("comptes")
      .select("id, actif")
      .eq("id", input.compte_id)
      .maybeSingle()
    if (!c)         return comptaError("RESOURCE_INVALID", { field: "compte_id" }, "Compte bancaire introuvable")
    if (!c.actif)   return comptaError("ACCOUNT_INACTIVE", { compte_id: c.id })
  }
  if (input.caisse_id) {
    const { data: c } = await supabaseAdmin
      .from("caisses")
      .select("id, actif")
      .eq("id", input.caisse_id)
      .maybeSingle()
    if (!c)         return comptaError("RESOURCE_INVALID", { field: "caisse_id" }, "Caisse introuvable")
    if (!c.actif)   return comptaError("ACCOUNT_INACTIVE", { caisse_id: c.id })
  }

  // 2. Catégorie : existence, activité, cohérence avec type opération
  const { data: cat } = await supabaseAdmin
    .from("categories_operations")
    .select("id, type, actif")
    .eq("id", input.categorie_id)
    .maybeSingle()
  if (!cat)        return comptaError("RESOURCE_INVALID", { field: "categorie_id" }, "Catégorie introuvable")
  if (!cat.actif)  return comptaError("CATEGORY_INACTIVE", { categorie_id: cat.id })

  const ENTREE_OK = new Set(["recette", "apport", "autre"])
  const SORTIE_OK = new Set(["depense", "reversement", "avance", "investissement", "remboursement", "dotation", "autre"])
  if (input.type === "entree" && !ENTREE_OK.has(cat.type)) {
    return comptaError(
      "INVALID_PAYLOAD",
      { field: "categorie_id", categorie_type: cat.type, attendu: [...ENTREE_OK] },
      "Type d'opération 'entree' incompatible avec la catégorie",
    )
  }
  if (input.type === "sortie" && !SORTIE_OK.has(cat.type)) {
    return comptaError(
      "INVALID_PAYLOAD",
      { field: "categorie_id", categorie_type: cat.type, attendu: [...SORTIE_OK] },
      "Type d'opération 'sortie' incompatible avec la catégorie",
    )
  }

  // 3. Exercice à partir de la date
  let exercice
  try {
    exercice = await getExerciceForDate(input.date_operation)
  } catch (e) {
    return comptaError("INVALID_PAYLOAD", { hint: (e as Error).message }, "Aucun exercice pour cette date")
  }
  if (exercice.cloture) {
    return comptaError("EXERCICE_CLOSED", { exercice_id: exercice.id })
  }

  // 4. Vérifier qu'aucune clôture mensuelle ne couvre la date
  const periodeMois = input.date_operation.slice(0, 7)
  const { data: cloture } = await supabaseAdmin
    .from("clotures")
    .select("id")
    .eq("exercice_id", exercice.id)
    .eq("type", "mensuelle")
    .eq("periode", periodeMois)
    .maybeSingle()
  if (cloture) {
    return comptaError("PERIOD_CLOSED", { periode: periodeMois })
  }

  // 5. Statut effectif
  const { data: param } = await supabaseAdmin
    .from("parametres_module_compta")
    .select("workflow_validation_actif")
    .eq("id", 1)
    .single()
  const workflow = param?.workflow_validation_actif === true

  let statutEffectif: "brouillon" | "valide"
  if (input.statut === "brouillon") {
    statutEffectif = "brouillon"
  } else {
    // statut='valide' ou absent
    statutEffectif = workflow ? "brouillon" : "valide"
  }

  // 6. INSERT
  const nowIso = new Date().toISOString()
  const { data: opCreated, error: insErr } = await supabaseAdmin
    .from("operations")
    .insert({
      date_operation:    input.date_operation,
      type:              input.type,
      montant:           input.montant,
      libelle:           input.libelle,
      reference_externe: input.reference_externe ?? null,
      compte_id:         input.compte_id  ?? null,
      caisse_id:         input.caisse_id  ?? null,
      categorie_id:      input.categorie_id,
      vehicule_id:       input.vehicule_id ?? null,
      chauffeur_id:      input.chauffeur_id ?? null,
      client_id:         input.client_id ?? null,
      source:            "manuel",
      statut:            statutEffectif,
      valide_le:         statutEffectif === "valide" ? nowIso        : null,
      valide_par:        statutEffectif === "valide" ? auth.user.id  : null,
      exercice_id:       exercice.id,
      created_by:        auth.user.id,
      updated_by:        auth.user.id,
      notes:             input.notes ?? null,
    })
    .select()
    .single()
  if (insErr || !opCreated) return comptaError("DB_ERROR", { hint: insErr?.message })

  // 7. Génération de l'écriture si mode='avance' et statut final='valide'
  let ecritureId: string | null = null
  const mode = await getModeActif()
  if (statutEffectif === "valide" && mode === "avance") {
    try {
      ecritureId = await genererEcritureFromOperation(opCreated.id)
    } catch (e) {
      // Rollback : supprimer l'opération créée pour éviter incohérence
      await supabaseAdmin.from("operations").delete().eq("id", opCreated.id)
      if (e instanceof EcritureError) {
        // Map les codes EcritureError → comptaError
        const code = (e.code === "CATEGORY_NO_MAPPING" || e.code === "ACCOUNT_NO_MAPPING" ||
                      e.code === "ECRITURE_DESEQUILIBREE")
          ? e.code
          : "INTERNAL_ERROR"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return comptaError(code as any, e.details, e.message)
      }
      return comptaError("INTERNAL_ERROR", { hint: (e as Error).message })
    }
  }

  await logActivity({
    token:   auth.token,
    action:  "compta.operation.create",
    entity:  opCreated.id,
    details: {
      type:    opCreated.type,
      montant: opCreated.montant,
      statut:  statutEffectif,
      mode,
      ecriture_generee: !!ecritureId,
    },
  })

  return comptaOk({ ...opCreated, ecriture_id: ecritureId ?? opCreated.ecriture_id }, { status: 201 })
}
