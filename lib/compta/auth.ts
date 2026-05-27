/**
 * Auth wrapper pour le module Comptes & Caisses.
 *
 * Réutilise le client supabaseAdmin existant (lib/supabaseAdmin.ts) — ne crée
 * PAS de nouveau client Supabase. Reproduit la même logique que `requirePermission`
 * (lib/requirePermission.ts) mais retourne dans le format Phase 2 §1.6 (error/code).
 *
 * v1 du module : directeur uniquement (admin et dispatcher → 403).
 *
 * Usage typique dans une route :
 *   const auth = await requireDirecteurCompta(req)
 *   if (!auth.ok) return auth.response
 *   const userId = auth.user.id
 */

import type { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { comptaError } from "./errors"

export type ComptaAuthUser = {
  id:    string
  email: string | undefined
  role:  "directeur"
}

export type ComptaAuthResult =
  | { ok: true;  user: ComptaAuthUser; token: string }
  | { ok: false; response: NextResponse }

/**
 * Vérifie que le porteur du Bearer token est connecté ET directeur.
 * Retourne soit { ok: true, user, token } soit { ok: false, response }.
 */
export async function requireDirecteurCompta(req: NextRequest): Promise<ComptaAuthResult> {
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

  if (!profile || profile.role !== "directeur") {
    return { ok: false, response: comptaError("FORBIDDEN") }
  }

  return {
    ok: true,
    user: { id: user.id, email: user.email, role: "directeur" },
    token,
  }
}
