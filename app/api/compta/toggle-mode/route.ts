/**
 * POST /api/compta/toggle-mode
 *
 * Bascule du mode actif Simple ↔ Avancé.
 * Réservé directeur. Référence : doc Phase 2 Day 6 §3.
 *
 * Simple → Avancé :
 *   - Bootstrap doit avoir été exécuté (412 BOOTSTRAP_NOT_DONE sinon)
 *   - Vérification des mappings : toutes les catégories utilisées par des ops
 *     validées doivent avoir compte_syscohada_code + sens. Tous les comptes/
 *     caisses utilisés doivent avoir compte_syscohada_code. Sinon 412
 *     MAPPING_INCOMPLETE avec liste détaillée.
 *   - Génération rétroactive d'écritures pour toutes les ops validées sans
 *     ecriture_id. Si quelques échecs : non bloquant, retour avec compteurs.
 *   - UPDATE mode_actif='avance'.
 *
 * Avancé → Simple :
 *   - Body doit contenir confirmer=true (sinon 400 INVALID_PAYLOAD).
 *   - Les écritures déjà générées NE sont PAS supprimées (audit trail).
 *   - UPDATE mode_actif='simple'.
 *
 * Idempotence : si mode déjà actif, retourne 200 sans rien faire.
 */

import type { NextRequest } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { logActivity } from "@/lib/logActivity"
import { requireDirecteurCompta } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { toggleModeSchema, safeParse } from "@/lib/compta/validators"
import { genererEcritureFromOperation, EcritureError } from "@/lib/compta/ecritures"

export const dynamic     = "force-dynamic"
export const maxDuration = 60

const CHUNK_FETCH = 1000

// ─── Vérification mappings (Simple → Avancé) ─────────────────────────────────

type MissingItem = { id: string; libelle: string }

async function listerMappingsManquants(): Promise<{
  categories_sans_mapping: MissingItem[]
  comptes_sans_mapping:    MissingItem[]
  caisses_sans_mapping:    MissingItem[]
}> {
  // 1. Catégories utilisées par opérations validées sans mapping complet
  const { data: catsUsed } = await supabaseAdmin
    .from("operations")
    .select("categorie_id")
    .eq("statut", "valide")
    .not("categorie_id", "is", null)
  const catIds = Array.from(new Set((catsUsed ?? []).map(r => r.categorie_id).filter(Boolean) as string[]))
  let categories_sans_mapping: MissingItem[] = []
  if (catIds.length > 0) {
    const { data: cats } = await supabaseAdmin
      .from("categories_operations")
      .select("id, libelle, compte_syscohada_code, sens")
      .in("id", catIds)
    categories_sans_mapping = (cats ?? [])
      .filter(c => !c.compte_syscohada_code || !c.sens)
      .map(c => ({ id: c.id, libelle: c.libelle }))
  }

  // 2. Comptes bancaires utilisés sans mapping
  const { data: comptesUsed } = await supabaseAdmin
    .from("operations")
    .select("compte_id")
    .eq("statut", "valide")
    .not("compte_id", "is", null)
  const compteIds = Array.from(new Set((comptesUsed ?? []).map(r => r.compte_id).filter(Boolean) as string[]))
  let comptes_sans_mapping: MissingItem[] = []
  if (compteIds.length > 0) {
    const { data: comptes } = await supabaseAdmin
      .from("comptes")
      .select("id, libelle, compte_syscohada_code")
      .in("id", compteIds)
    comptes_sans_mapping = (comptes ?? [])
      .filter(c => !c.compte_syscohada_code)
      .map(c => ({ id: c.id, libelle: c.libelle }))
  }

  // 3. Caisses utilisées sans mapping
  const { data: caissesUsed } = await supabaseAdmin
    .from("operations")
    .select("caisse_id")
    .eq("statut", "valide")
    .not("caisse_id", "is", null)
  const caisseIds = Array.from(new Set((caissesUsed ?? []).map(r => r.caisse_id).filter(Boolean) as string[]))
  let caisses_sans_mapping: MissingItem[] = []
  if (caisseIds.length > 0) {
    const { data: caisses } = await supabaseAdmin
      .from("caisses")
      .select("id, libelle, compte_syscohada_code")
      .in("id", caisseIds)
    caisses_sans_mapping = (caisses ?? [])
      .filter(c => !c.compte_syscohada_code)
      .map(c => ({ id: c.id, libelle: c.libelle }))
  }

  return { categories_sans_mapping, comptes_sans_mapping, caisses_sans_mapping }
}

// ─── Génération rétroactive ──────────────────────────────────────────────────

async function genererEcrituresRetroactives(): Promise<{
  totalATraiter: number
  generees:      number
  echouees:      number
  echecs:        { operation_id: string; code: string; message: string }[]
}> {
  const echecs: { operation_id: string; code: string; message: string }[] = []
  let totalATraiter = 0
  let generees      = 0
  let echouees      = 0
  let from          = 0
  let processed     = 0

  // Comptage initial pour suivi progression
  const { count: countToProcess } = await supabaseAdmin
    .from("operations")
    .select("id", { count: "exact", head: true })
    .eq("statut", "valide")
    .is("ecriture_id", null)
  totalATraiter = countToProcess ?? 0
  console.log(`[toggle] retroactive generation: ${totalATraiter} operations to process`)

  while (from < 100_000) {
    const { data, error } = await supabaseAdmin
      .from("operations")
      .select("id")
      .eq("statut", "valide")
      .is("ecriture_id", null)
      .order("date_operation", { ascending: true })
      .range(from, from + CHUNK_FETCH - 1)
    if (error) {
      console.error(`[toggle] fetch operations FAILED:`, error)
      throw error
    }
    if (!data || data.length === 0) break

    for (const op of data) {
      try {
        await genererEcritureFromOperation(op.id)
        generees++
      } catch (e) {
        echouees++
        const code    = e instanceof EcritureError ? e.code : "INTERNAL_ERROR"
        const message = (e as Error).message
        console.error(`[toggle] op ${op.id} FAILED [${code}]: ${message}`)
        if (echecs.length < 50) {
          echecs.push({ operation_id: op.id, code, message })
        }
      }
      processed++

      // Log de progression toutes les 50 ops
      if (processed % 50 === 0) {
        console.log(`[toggle] progress ${processed}/${totalATraiter} (creees=${generees}, erreurs=${echouees})`)
      }
    }

    if (data.length < CHUNK_FETCH) break
    from += CHUNK_FETCH
  }

  console.log(`[toggle] DONE retroactive — traitees=${processed} creees=${generees} erreurs=${echouees}`)
  return { totalATraiter, generees, echouees, echecs }
}

// ─── Route POST ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const t0   = Date.now()
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  // Query param ?force=true (Écran 7 §7.4) : régénère les écritures même
  // si on est déjà dans le mode cible. Utile après un import massif qui
  // aurait échappé au toggle initial.
  const force = new URL(req.url).searchParams.get("force") === "true"

  // 1. Body
  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return comptaError("INVALID_PAYLOAD", { reason: "JSON malformé" })
  }
  const parsed = safeParse(toggleModeSchema, payload)
  if (!parsed.ok) return comptaError("INVALID_PAYLOAD", { issues: parsed.details })
  const { nouveau_mode, confirmer } = parsed.data

  // 2. Charger paramètres
  const { data: param, error: paramErr } = await supabaseAdmin
    .from("parametres_module_compta")
    .select("mode_actif, premier_login_effectue")
    .eq("id", 1)
    .single()
  if (paramErr || !param) {
    return comptaError("INTERNAL_ERROR", { hint: paramErr?.message }, "Paramètres module introuvables")
  }
  const ancien_mode = param.mode_actif as "simple" | "avance"
  console.log(`[toggle] FROM=${ancien_mode} TO=${nouveau_mode}`)

  // 3. Idempotence : si déjà dans le mode demandé, retour 200 sans rien faire
  //    SAUF si ?force=true (Écran 7 §7.4) : on continue pour régénérer
  //    toutes les écritures même si on est déjà en mode Avancé.
  if (ancien_mode === nouveau_mode && !force) {
    console.log(`[toggle] no-op (already in target mode)`)
    return comptaOk({
      ancien_mode,
      nouveau_mode,
      changed: false,
      message: `Déjà en mode ${nouveau_mode === "avance" ? "Avancé" : "Simple"}`,
    })
  }
  if (ancien_mode === nouveau_mode && force) {
    console.log(`[toggle] force=true → régénération forcée des écritures (mode inchangé)`)
  }

  // 4. Bootstrap requis
  if (!param.premier_login_effectue) {
    return comptaError("BOOTSTRAP_NOT_DONE")
  }

  // 5. Avancé → Simple : nécessite confirmer=true
  if (nouveau_mode === "simple") {
    if (confirmer !== true) {
      return comptaError(
        "INVALID_PAYLOAD",
        { field: "confirmer" },
        "Confirmation explicite requise (confirmer: true)",
      )
    }

    const { error: updErr } = await supabaseAdmin
      .from("parametres_module_compta")
      .update({
        mode_actif: "simple",
        updated_at: new Date().toISOString(),
        updated_by: auth.user.id,
      })
      .eq("id", 1)
    if (updErr) return comptaError("INTERNAL_ERROR", { hint: updErr.message })

    // Compter les écritures conservées
    const { count: ecrituresConservees } = await supabaseAdmin
      .from("ecritures_comptables")
      .select("id", { count: "exact", head: true })
      .eq("statut", "valide")

    await logActivity({
      token:   auth.token,
      action:  "compta.mode.basculer_simple",
      entity:  null,
      details: { ancien_mode, nouveau_mode, ecritures_conservees: ecrituresConservees ?? 0 },
    })

    return comptaOk({
      ancien_mode,
      nouveau_mode,
      ecritures_conservees: ecrituresConservees ?? 0,
      duree_ms: Date.now() - t0,
    })
  }

  // 6. Simple → Avancé : check mappings
  const missing = await listerMappingsManquants()
  const hasMissing =
    missing.categories_sans_mapping.length > 0 ||
    missing.comptes_sans_mapping.length    > 0 ||
    missing.caisses_sans_mapping.length    > 0

  if (hasMissing) {
    console.error(`[toggle] mapping incomplete — categories=${missing.categories_sans_mapping.length} comptes=${missing.comptes_sans_mapping.length} caisses=${missing.caisses_sans_mapping.length}`)
    return comptaError(
      "MAPPING_INCOMPLETE",
      missing,
      "Mappings SYSCOHADA incomplets, impossible de basculer en mode Avancé",
    )
  }
  console.log(`[toggle] mappings OK — proceed with retroactive generation`)

  // 7. Génération rétroactive
  let totalATraiter = 0
  let generees = 0
  let echouees = 0
  let echecs:   { operation_id: string; code: string; message: string }[] = []
  try {
    const r = await genererEcrituresRetroactives()
    totalATraiter = r.totalATraiter
    generees      = r.generees
    echouees      = r.echouees
    echecs        = r.echecs
  } catch (e) {
    console.error(`[toggle] retroactive generation THREW:`, e)
    return comptaError("INTERNAL_ERROR", { hint: (e as Error).message }, "Génération rétroactive interrompue")
  }

  // 7bis. DURE FAIL : si une seule écriture a échoué, on NE bascule PAS le mode.
  //       L'idempotence du helper (idempotence via op.ecriture_id non null)
  //       permettra à l'utilisateur de relancer le toggle après correction
  //       sans recréer les écritures déjà générées.
  if (echouees > 0) {
    console.error(`[toggle] PARTIAL_FAILURE — ${echouees}/${totalATraiter} échecs. Mode NOT changed.`)
    return comptaError(
      "INTERNAL_ERROR",
      {
        partial_failure:  true,
        total_a_traiter:  totalATraiter,
        ecritures_creees: generees,
        ecritures_echouees: echouees,
        premieres_erreurs: echecs.slice(0, 10),
      },
      `Génération rétroactive partielle : ${echouees}/${totalATraiter} échecs. Mode non basculé. Voir détails dans la réponse + logs serveur.`,
    )
  }

  // 8. Sanity checks AVANT UPDATE mode_actif
  console.log(`[toggle] running sanity checks before UPDATE mode_actif`)
  const sanityChecks = await runSanityChecks()
  if (!sanityChecks.ok) {
    console.error(`[toggle] SANITY CHECKS FAILED:`, sanityChecks)
    return comptaError(
      "INTERNAL_ERROR",
      sanityChecks,
      `Sanity checks post-génération ont échoué : ${sanityChecks.errors.join(" / ")}. Mode non basculé.`,
    )
  }
  console.log(`[toggle] sanity checks PASSED:`, sanityChecks)

  // 9. UPDATE mode_actif — seulement si tout est OK
  const { error: updErr } = await supabaseAdmin
    .from("parametres_module_compta")
    .update({
      mode_actif: "avance",
      updated_at: new Date().toISOString(),
      updated_by: auth.user.id,
    })
    .eq("id", 1)
  if (updErr) {
    console.error(`[toggle] UPDATE mode_actif FAILED:`, updErr)
    return comptaError("INTERNAL_ERROR", { hint: updErr.message })
  }
  console.log(`[toggle] mode_actif=avance SET`)

  await logActivity({
    token:   auth.token,
    action:  "compta.mode.basculer_avance",
    entity:  null,
    details: {
      ancien_mode, nouveau_mode,
      total_a_traiter:    totalATraiter,
      ecritures_generees: generees,
      ecritures_echouees: echouees,
      sanity:             sanityChecks,
    },
  })

  return comptaOk({
    ancien_mode,
    nouveau_mode,
    changed:            true,
    total_a_traiter:    totalATraiter,
    ecritures_generees: generees,
    ecritures_echouees: echouees,
    echecs_details:     echecs,
    sanity:             sanityChecks,
    duree_ms:           Date.now() - t0,
  })
}

// ─── Sanity checks post-toggle ───────────────────────────────────────────────

type SanityResult = {
  ok:                       boolean
  errors:                   string[]
  nb_ops_valides:           number
  nb_ecritures_valides:     number
  nb_ops_orphanes:          number
  nb_lignes_ecritures:      number
  ratio_lignes_ecritures:   number   // doit être >= 2
}

async function runSanityChecks(): Promise<SanityResult> {
  const errors: string[] = []

  const [opsValides, opsOrphanes, ecrValides, lignes] = await Promise.all([
    supabaseAdmin.from("operations")
      .select("id", { count: "exact", head: true })
      .eq("statut", "valide"),
    supabaseAdmin.from("operations")
      .select("id", { count: "exact", head: true })
      .eq("statut", "valide")
      .is("ecriture_id", null),
    supabaseAdmin.from("ecritures_comptables")
      .select("id", { count: "exact", head: true })
      .eq("statut", "valide"),
    supabaseAdmin.from("lignes_ecritures")
      .select("id", { count: "exact", head: true }),
  ])

  const nb_ops_valides       = opsValides.count   ?? 0
  const nb_ops_orphanes      = opsOrphanes.count  ?? 0
  const nb_ecritures_valides = ecrValides.count   ?? 0
  const nb_lignes_ecritures  = lignes.count       ?? 0
  const ratio = nb_ecritures_valides > 0 ? nb_lignes_ecritures / nb_ecritures_valides : 0

  // Check 1 : 0 op valide sans ecriture_id
  if (nb_ops_orphanes > 0) {
    errors.push(`${nb_ops_orphanes} opération(s) validée(s) sans ecriture_id`)
  }
  // Check 2 : nb écritures >= nb ops valides
  if (nb_ecritures_valides < nb_ops_valides) {
    errors.push(`${nb_ecritures_valides} écritures < ${nb_ops_valides} ops validées`)
  }
  // Check 3 : ratio lignes/écritures >= 2 (partie double minimum)
  if (nb_ecritures_valides > 0 && ratio < 2) {
    errors.push(`ratio lignes/écritures = ${ratio.toFixed(2)} < 2 (partie double incomplète)`)
  }

  return {
    ok: errors.length === 0,
    errors,
    nb_ops_valides,
    nb_ops_orphanes,
    nb_ecritures_valides,
    nb_lignes_ecritures,
    ratio_lignes_ecritures: ratio,
  }
}
