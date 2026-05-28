/**
 * Auth wrapper pour le module Comptes & Caisses.
 *
 * Réutilise le client supabaseAdmin existant (lib/supabaseAdmin.ts) — ne crée
 * PAS de nouveau client Supabase. Reproduit la même logique que `requirePermission`
 * (lib/requirePermission.ts) mais retourne dans le format Phase 2 §1.6 (error/code).
 *
 * Migré le 27/05/2026 d'un check "directeur uniquement" vers le système de
 * permissions granulaires :
 *   - view_comptabilite     : lecture seule (dashboard, listings, états, exports)
 *   - manage_comptabilite   : mutations sur opérations / référentiels
 *   - manage_exercices      : création / clôture d'exercice (irréversible)
 *   - manage_societe        : modification paramètres société (RCCM, logo, etc.)
 *
 * Le directeur bypass automatiquement (cf. profile.role === "directeur").
 *
 * Usage typique dans une route :
 *   const auth = await requireComptaPermission(req, "view_comptabilite")
 *   if (!auth.ok) return auth.response
 *   const userId = auth.user.id
 */

import type { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { comptaError } from "./errors"

export type ComptaPermission =
  | "view_comptabilite"
  | "manage_comptabilite"
  | "manage_exercices"
  | "manage_societe"

export type ComptaAuthUser = {
  id:    string
  email: string | undefined
  /** Élargi le 27/05/2026 : "directeur" | "admin" | "dispatcher" (typé string pour souplesse). */
  role:  string
}

export type ComptaAuthResult =
  | { ok: true;  user: ComptaAuthUser; token: string }
  | { ok: false; response: NextResponse }

/**
 * Vérifie que le porteur du Bearer token est connecté ET dispose de la
 * permission `action` côté matrice role_permissions.
 *
 * Le directeur bypass tout (cf. lib/requirePermission.ts:40 — même logique).
 */
export async function requireComptaPermission(
  req: NextRequest,
  action: ComptaPermission,
): Promise<ComptaAuthResult> {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")
  if (!token) {
    return { ok: false, response: comptaError("UNAUTHORIZED") }
  }

  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) {
    return { ok: false, response: comptaError("UNAUTHORIZED", undefined, "Session invalide") }
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile) {
    return { ok: false, response: comptaError("FORBIDDEN", undefined, "Profil introuvable") }
  }

  // Le directeur a accès à tout
  if (profile.role === "directeur") {
    return {
      ok: true,
      user:  { id: user.id, email: user.email, role: profile.role },
      token,
    }
  }

  // Sinon on consulte la matrice role_permissions
  const { data: perm } = await supabaseAdmin
    .from("role_permissions")
    .select("allowed")
    .eq("role", profile.role)
    .eq("action", action)
    .single()

  if (!perm?.allowed) {
    return {
      ok: false,
      response: comptaError("FORBIDDEN", undefined, `Permission refusée : ${action}`),
    }
  }

  return {
    ok: true,
    user:  { id: user.id, email: user.email, role: profile.role },
    token,
  }
}

/**
 * @deprecated Utiliser `requireComptaPermission(req, action)` à la place.
 * Conservé temporairement pour ne rien casser si un call-site n'a pas
 * été migré. Mappe sur "manage_comptabilite" par défaut (verrou strict).
 */
export async function requireDirecteurCompta(req: NextRequest): Promise<ComptaAuthResult> {
  return requireComptaPermission(req, "manage_comptabilite")
}
