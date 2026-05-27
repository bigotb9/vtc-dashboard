/**
 * POST /api/compta/onboarding/complete
 *
 * Finalise l'onboarding premier login (Écran 9 Phase 3) :
 *   1. Si mode_actif demandé != mode actuel → toggle (Avancé ↔ Simple)
 *      avec la même logique que /api/compta/toggle-mode (mappings checks
 *      + génération/conservation des écritures selon le sens).
 *   2. UPDATE parametres_module_compta :
 *      premier_login_effectue = true, mode_actif, infos société si fournies.
 *
 * Si l'utilisateur a cliqué "Passer" à l'étape société, on ne touche pas aux
 * colonnes société existantes (préserve les valeurs déjà saisies via Écran 7).
 *
 * Réservé directeur. Référence : doc Phase 3 Écran 9 §5.
 */

import type { NextRequest } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { logActivity } from "@/lib/logActivity"
import { requireDirecteurCompta } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"
import { onboardingCompleteSchema, safeParse } from "@/lib/compta/validators"

export const dynamic     = "force-dynamic"
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  // 1. Body
  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return comptaError("INVALID_PAYLOAD", { reason: "JSON malformé" })
  }
  const parsed = safeParse(onboardingCompleteSchema, payload)
  if (!parsed.ok) return comptaError("INVALID_PAYLOAD", { issues: parsed.details })
  const { mode_actif, societe_skipped } = parsed.data
  const societe = parsed.data.societe ?? {}

  // 2. Charger l'état actuel
  const { data: param, error: paramErr } = await supabaseAdmin
    .from("parametres_module_compta")
    .select("mode_actif, premier_login_effectue")
    .eq("id", 1)
    .single()
  if (paramErr || !param) {
    return comptaError("INTERNAL_ERROR", { hint: paramErr?.message }, "Paramètres module introuvables")
  }

  // 3. Si le mode demandé diffère du mode actuel → déclencher le toggle
  //    via un fetch interne sur /toggle-mode (réutilise la logique métier
  //    complète : check mappings, génération/conservation écritures, etc.).
  //
  //    Cas particulier (§5.2 du doc) : l'onboarding sur une BD déjà peuplée
  //    avec changement de mode est rare. La logique du /toggle-mode gère :
  //    - Simple → Avancé : check mappings, génère écritures rétroactives
  //    - Avancé → Simple : conserve les écritures, désactive la génération
  //    En cas d'erreur (mappings manquants), on remonte l'erreur sans
  //    valider le flag — l'utilisateur peut corriger puis refaire le wizard.
  const ancienMode = param.mode_actif as "simple" | "avance"
  if (ancienMode !== mode_actif) {
    // Appel interne au handler /toggle-mode pour préserver toute la logique
    const toggleUrl = new URL("/api/compta/toggle-mode", req.url).toString()
    const toggleRes = await fetch(toggleUrl, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": req.headers.get("Authorization") ?? "",
        "Cookie":        req.headers.get("Cookie") ?? "",
      },
      body: JSON.stringify({ nouveau_mode: mode_actif, confirmer: true }),
    })
    const toggleJson = await toggleRes.json().catch(() => ({}))
    if (!toggleRes.ok) {
      return comptaError(
        "INTERNAL_ERROR",
        { toggle_error: toggleJson?.error ?? "toggle failed", code: toggleJson?.code },
        `Bascule de mode impossible : ${toggleJson?.error ?? "erreur inconnue"}`,
      )
    }
  }

  // 4. UPDATE flag + société (si fournie)
  const updates: Record<string, unknown> = {
    premier_login_effectue: true,
    updated_at: new Date().toISOString(),
    updated_by: auth.user.id,
  }
  // mode_actif est déjà à jour si toggle exécuté. Sinon on l'écrit pour idempotence.
  updates.mode_actif = mode_actif

  if (!societe_skipped) {
    // Skip = on ne touche PAS aux colonnes société.
    // Sinon, on applique chaque champ fourni (null = laisse en l'état).
    if (societe.raison_sociale  !== undefined && societe.raison_sociale  !== null && societe.raison_sociale.trim() !== "") {
      updates.raison_sociale = societe.raison_sociale.trim()
    }
    if (societe.telephone       !== undefined && societe.telephone       !== null && societe.telephone.trim() !== "") {
      updates.telephone = societe.telephone.trim()
    }
    if (societe.email_comptable !== undefined && societe.email_comptable !== null && societe.email_comptable.trim() !== "") {
      updates.email_comptable = societe.email_comptable.trim()
    }
  }

  const { error: updErr } = await supabaseAdmin
    .from("parametres_module_compta")
    .update(updates)
    .eq("id", 1)
  if (updErr) return comptaError("DB_ERROR", { hint: updErr.message })

  await logActivity({
    token:   auth.token,
    action:  "compta.onboarding.complete",
    entity:  "parametres_module_compta",
    details: {
      ancien_mode:    ancienMode,
      nouveau_mode:   mode_actif,
      toggle_executed: ancienMode !== mode_actif,
      societe_skipped,
      societe_champs_renseignes: societe_skipped
        ? []
        : Object.entries({
            raison_sociale:  societe.raison_sociale,
            telephone:       societe.telephone,
            email_comptable: societe.email_comptable,
          }).filter(([_, v]) => v && String(v).trim() !== "").map(([k]) => k),
    },
  })

  return comptaOk({
    ok:                      true,
    mode_actif,
    premier_login_effectue:  true,
    societe_skipped,
  })
}
