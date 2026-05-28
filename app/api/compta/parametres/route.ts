/**
 * GET    /api/compta/parametres
 * PATCH  /api/compta/parametres
 *
 * Réservé directeur. Référence : doc Phase 2 §3.1 / §3.2.
 *
 * GET → renvoie la ligne unique (id=1) de parametres_module_compta enrichie
 *       du libellé de l'exercice courant.
 *
 * PATCH → modifie uniquement workflow_validation_actif, exercice_courant_id
 *         et date_demarrage_module. mode_actif passe par /toggle-mode (Day 6),
 *         premier_login_effectue passe par /bootstrap (Day 6).
 */

import type { NextRequest } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { logActivity } from "@/lib/logActivity"
import { requireComptaPermission } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { parametresUpdateSchema, safeParse } from "@/lib/compta/validators"

export const dynamic = "force-dynamic"

// ─── GET ──────────────────────────────────────────────────────────────────────
// Renvoie les paramètres enrichis pour l'Écran 7 Phase 3 :
//   - flags : mode_actif, premier_login_effectue, workflow, numérotation
//   - exercice courant (libelle, dates, statut)
//   - infos société (raison sociale, RCCM, etc.)
//   - stats globales (nb_operations, nb_ecritures, nb_lignes)
export async function GET(req: NextRequest) {
  const auth = await requireComptaPermission(req, "view_comptabilite")
  if (!auth.ok) return auth.response

  const { data: p, error } = await supabaseAdmin
    .from("parametres_module_compta")
    .select("*")
    .eq("id", 1)
    .single()

  if (error || !p) {
    return comptaError("INTERNAL_ERROR", { hint: error?.message }, "Paramètres module introuvables")
  }

  // ─── Exercice courant : essai BD, fallback hardcodé année courante ────────
  let exercice_courant: {
    id:          string | null
    libelle:     string
    date_debut:  string
    date_fin:    string
    statut:      "ouvert" | "cloture"
  } = (() => {
    const y = new Date().getFullYear()
    return {
      id:         null,
      libelle:    `Année ${y}`,
      date_debut: `${y}-01-01`,
      date_fin:   `${y}-12-31`,
      statut:     "ouvert",
    }
  })()
  if (p.exercice_courant_id) {
    const { data: ex } = await supabaseAdmin
      .from("exercices")
      .select("id, libelle, date_debut, date_fin, cloture")
      .eq("id", p.exercice_courant_id)
      .maybeSingle()
    if (ex) {
      exercice_courant = {
        id:         String(ex.id),
        libelle:    ex.libelle,
        date_debut: ex.date_debut,
        date_fin:   ex.date_fin,
        statut:     ex.cloture ? "cloture" : "ouvert",
      }
    }
  }

  // ─── Stats globales en parallèle ──────────────────────────────────────────
  const [opsCount, ecrCount, lignesCount] = await Promise.all([
    supabaseAdmin.from("operations").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("ecritures_comptables").select("id", { count: "exact", head: true }).eq("statut", "valide"),
    supabaseAdmin.from("lignes_ecritures").select("id", { count: "exact", head: true }),
  ])

  return comptaOk({
    mode_actif:                p.mode_actif,
    premier_login_effectue:    p.premier_login_effectue,
    workflow_validation_actif: p.workflow_validation_actif,
    numerotation_auto:         p.numerotation_auto ?? true,
    journal_par_defaut:        p.journal_par_defaut ?? "OD",
    date_demarrage_module:     p.date_demarrage_module,
    updated_at:                p.updated_at,
    updated_by:                p.updated_by,
    exercice_courant,
    societe: {
      raison_sociale:      p.raison_sociale      ?? null,
      numero_rccm:         p.numero_rccm         ?? null,
      numero_contribuable: p.numero_contribuable ?? null,
      adresse_fiscale:     p.adresse_fiscale     ?? null,
      telephone:           p.telephone           ?? null,
      email_comptable:     p.email_comptable     ?? null,
    },
    stats: {
      nb_operations: opsCount.count    ?? 0,
      nb_ecritures:  ecrCount.count    ?? 0,
      nb_lignes:     lignesCount.count ?? 0,
    },
  })
}

// ─── PATCH ────────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const auth = await requireComptaPermission(req, "manage_comptabilite")
  if (!auth.ok) return auth.response

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return comptaError("INVALID_PAYLOAD", { reason: "JSON malformé" })
  }

  const parsed = safeParse(parametresUpdateSchema, payload)
  if (!parsed.ok) return comptaError("INVALID_PAYLOAD", { issues: parsed.details })

  const updates = parsed.data
  if (Object.keys(updates).length === 0) {
    return comptaError("INVALID_PAYLOAD", undefined, "Aucun champ à mettre à jour")
  }

  // Si exercice_courant_id fourni : vérifier l'existence
  if (updates.exercice_courant_id) {
    const { data: ex } = await supabaseAdmin
      .from("exercices")
      .select("id")
      .eq("id", updates.exercice_courant_id)
      .maybeSingle()
    if (!ex) return comptaError("NOT_FOUND", undefined, "Exercice introuvable")
  }

  const { data, error } = await supabaseAdmin
    .from("parametres_module_compta")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
      updated_by: auth.user.id,
    })
    .eq("id", 1)
    .select()
    .single()

  if (error || !data) {
    return comptaError("DB_ERROR", { hint: error?.message })
  }

  await logActivity({
    token:   auth.token,
    action:  "compta.parametres.update",
    entity:  "parametres_module_compta",
    details: { champs_modifies: Object.keys(updates) },
  })

  return comptaOk(data)
}
