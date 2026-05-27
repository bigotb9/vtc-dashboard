/**
 * POST /api/compta/operations/[id]/valider
 *
 * 4 cas gérés (étendu par correctif Écran 8 Bug 1) :
 *   A. statut='brouillon'                          → bascule en 'valide' + génère écriture
 *   B. statut='valide' ET ecriture_id IS NULL      → génère l'écriture uniquement (régénération
 *                                                    pour les opérations orphelines détectées
 *                                                    par /comptabilite/health)
 *   C. statut='valide' ET ecriture_id IS NOT NULL  → 409 CONFLICT ("déjà liée")
 *   D. statut='annule'                             → 409 CONFLICT ("annulée")
 *
 * En mode Avancé, génère l'écriture comptable. En cas d'échec sur le cas A,
 * rollback (statut remis en brouillon). Sur le cas B, statut reste 'valide'
 * — l'op était déjà validée, seule l'écriture manquait.
 *
 * Réservé directeur.
 *
 * Body : aucun.
 *
 * Réponse 200 :
 *   { data: { id, statut, valide_le, valide_par, ecriture_id, ecriture_numero, action } }
 *   action = "validated" (cas A) | "ecriture_regenerated" (cas B)
 */

import type { NextRequest } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { logActivity } from "@/lib/logActivity"
import { requireDirecteurCompta } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { getModeActif, genererEcritureFromOperation, EcritureError } from "@/lib/compta/ecritures"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  const { id } = await ctx.params

  // 1. Charger l'opération (avec valide_le/valide_par pour le cas B)
  const { data: op, error: loadErr } = await supabaseAdmin
    .from("operations")
    .select("id, statut, ecriture_id, date_operation, exercice_id, libelle, valide_le, valide_par")
    .eq("id", id)
    .maybeSingle()
  if (loadErr) return comptaError("DB_ERROR", { hint: loadErr.message })
  if (!op)     return comptaError("NOT_FOUND")

  // 2. Dispatcher sur les 4 cas
  // ─── Cas D : annulée → refus ────────────────────────────────────────────
  if (op.statut === "annule") {
    return comptaError(
      "CONFLICT",
      { statut_actuel: "annule" },
      "Opération annulée — ne peut être revalidée. Créer une nouvelle opération si besoin.",
    )
  }
  // ─── Cas C : valide déjà liée → refus ────────────────────────────────────
  if (op.statut === "valide" && op.ecriture_id) {
    return comptaError(
      "CONFLICT",
      { statut_actuel: "valide", ecriture_id: op.ecriture_id },
      "Opération déjà liée à une écriture comptable",
    )
  }
  // ─── Cas A ou B : on continue ────────────────────────────────────────────
  if (op.statut !== "brouillon" && op.statut !== "valide") {
    return comptaError(
      "CONFLICT",
      { statut_actuel: op.statut },
      `Statut inattendu : ${op.statut}`,
    )
  }

  const isOrphanFix = op.statut === "valide" && !op.ecriture_id

  // 3. Période mensuelle non clôturée
  const periode = String(op.date_operation).slice(0, 7)
  const { data: cloture } = await supabaseAdmin
    .from("clotures")
    .select("id")
    .eq("exercice_id", op.exercice_id)
    .eq("type", "mensuelle")
    .eq("periode", periode)
    .maybeSingle()
  if (cloture) return comptaError("PERIOD_CLOSED", { periode })

  // 4. Exercice non clôturé
  const { data: ex } = await supabaseAdmin
    .from("exercices")
    .select("cloture")
    .eq("id", op.exercice_id)
    .maybeSingle()
  if (ex?.cloture) return comptaError("EXERCICE_CLOSED", { exercice_id: op.exercice_id })

  // 5. Mode actif
  const mode = await getModeActif()

  // 6. Si cas A (brouillon) : UPDATE statut → valide AVANT la génération
  //    Si cas B (orphan fix) : on ne touche pas au statut.
  const valideLe = isOrphanFix ? (op.valide_le ?? new Date().toISOString()) : new Date().toISOString()
  const validePar = isOrphanFix ? (op.valide_par ?? auth.user.id) : auth.user.id

  if (!isOrphanFix) {
    const { error: updErr } = await supabaseAdmin
      .from("operations")
      .update({
        statut:     "valide",
        valide_le:  valideLe,
        valide_par: validePar,
        updated_at: valideLe,
        updated_by: auth.user.id,
      })
      .eq("id", id)
    if (updErr) return comptaError("DB_ERROR", { hint: updErr.message })
  }

  // 7. Génération écriture (si mode Avancé)
  let ecritureId:     string | null = null
  let ecritureNumero: string | null = null

  if (mode === "avance") {
    try {
      ecritureId = await genererEcritureFromOperation(id)
      const { data: ecr } = await supabaseAdmin
        .from("ecritures_comptables")
        .select("numero")
        .eq("id", ecritureId)
        .maybeSingle()
      ecritureNumero = ecr?.numero ?? null
    } catch (e) {
      // Rollback uniquement pour le cas A — sur le cas B (orphan fix), l'op
      // était déjà valide AVANT l'appel, on ne touche pas au statut.
      if (!isOrphanFix) {
        await supabaseAdmin
          .from("operations")
          .update({
            statut:     "brouillon",
            valide_le:  null,
            valide_par: null,
            updated_at: new Date().toISOString(),
            updated_by: auth.user.id,
          })
          .eq("id", id)
      }

      if (e instanceof EcritureError) {
        const allowed = new Set([
          "CATEGORY_NO_MAPPING",
          "ACCOUNT_NO_MAPPING",
          "ECRITURE_DESEQUILIBREE",
          "PERIOD_CLOSED",
          "EXERCICE_CLOSED",
          "NOT_FOUND",
          "CONFLICT",
        ])
        const code = allowed.has(e.code) ? e.code : "INTERNAL_ERROR"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return comptaError(code as any, e.details, e.message)
      }
      return comptaError("INTERNAL_ERROR", { hint: (e as Error).message })
    }
  }

  // 8. Log activité
  await logActivity({
    token:   auth.token,
    action:  isOrphanFix ? "compta.operation.regenerer_ecriture" : "compta.operation.valider",
    entity:  id,
    details: {
      libelle:     op.libelle,
      mode,
      ecriture_id: ecritureId,
      action:      isOrphanFix ? "ecriture_regenerated" : "validated",
    },
  })

  return comptaOk({
    id,
    statut:          "valide",
    valide_le:       valideLe,
    valide_par:      validePar,
    ecriture_id:     ecritureId,
    ecriture_numero: ecritureNumero,
    action:          isOrphanFix ? "ecriture_regenerated" : "validated",
  })
}
