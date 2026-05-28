/**
 * Catalogue d'erreurs normalisées du module Comptes & Caisses.
 *
 * Format de réponse standard (doc Phase 2 §1.6) :
 *   { "error": "<message lisible>", "code": "<CODE_NORMALISE>", "details"?: ... }
 *
 * Convention : ne JAMAIS inventer un nouveau code en dehors de ce dictionnaire.
 * Si un cas n'est pas couvert, l'ajouter ici puis l'utiliser via comptaError().
 */

import { NextResponse } from "next/server"

export const COMPTA_ERRORS = {
  // ─── Auth ──────────────────────────────────────────────────────────────────
  UNAUTHORIZED:           { code: "UNAUTHORIZED",           status: 401, message: "Non authentifié" },
  FORBIDDEN:              { code: "FORBIDDEN",              status: 403, message: "Permission refusée" },

  // ─── Validation ────────────────────────────────────────────────────────────
  INVALID_PAYLOAD:        { code: "INVALID_PAYLOAD",        status: 400, message: "Données invalides" },
  MISSING_FIELD:          { code: "MISSING_FIELD",          status: 400, message: "Champ obligatoire manquant" },

  // ─── Ressources ────────────────────────────────────────────────────────────
  NOT_FOUND:              { code: "NOT_FOUND",              status: 404, message: "Ressource introuvable" },
  ALREADY_EXISTS:         { code: "ALREADY_EXISTS",         status: 409, message: "Ressource existe déjà" },
  CONFLICT:               { code: "CONFLICT",               status: 409, message: "Conflit avec l'état actuel" },
  // Pour les FK qui pointent vers un id valide structurellement (UUID) mais
  // inexistant en BD : payload syntaxiquement correct mais sémantiquement
  // invalide → 422 Unprocessable Entity (cas type "categorie_id inconnu").
  RESOURCE_INVALID:       { code: "RESOURCE_INVALID",       status: 422, message: "Référence inconnue en base" },

  // ─── Métier ────────────────────────────────────────────────────────────────
  ACCOUNT_INACTIVE:       { code: "ACCOUNT_INACTIVE",       status: 400, message: "Compte/caisse inactif" },
  CATEGORY_INACTIVE:      { code: "CATEGORY_INACTIVE",      status: 400, message: "Catégorie inactive" },
  PERIOD_CLOSED:          { code: "PERIOD_CLOSED",          status: 400, message: "Période clôturée" },
  EXERCICE_CLOSED:        { code: "EXERCICE_CLOSED",        status: 400, message: "Exercice clôturé" },
  OPERATION_VALIDATED:    { code: "OPERATION_VALIDATED",    status: 400, message: "Opération déjà validée, modification interdite" },
  OPERATION_CANCELLED:    { code: "OPERATION_CANCELLED",    status: 400, message: "Opération annulée" },

  // ─── Bootstrap / mode (Day 6) ─────────────────────────────────────────────
  BOOTSTRAP_ALREADY_DONE: { code: "BOOTSTRAP_ALREADY_DONE", status: 409, message: "Bootstrap déjà effectué" },
  BOOTSTRAP_NOT_DONE:     { code: "BOOTSTRAP_NOT_DONE",     status: 412, message: "Bootstrap requis avant cette action" },
  MAPPING_INCOMPLETE:     { code: "MAPPING_INCOMPLETE",     status: 412, message: "Mappings SYSCOHADA incomplets, impossible de basculer en mode Avancé" },
  INVALID_MODE:           { code: "INVALID_MODE",           status: 400, message: "Mode inconnu" },

  // ─── Comptable ─────────────────────────────────────────────────────────────
  CATEGORY_NO_MAPPING:    { code: "CATEGORY_NO_MAPPING",    status: 400, message: "Catégorie sans mapping SYSCOHADA" },
  ACCOUNT_NO_MAPPING:     { code: "ACCOUNT_NO_MAPPING",     status: 400, message: "Compte/caisse sans mapping SYSCOHADA" },
  ECRITURE_DESEQUILIBREE: { code: "ECRITURE_DESEQUILIBREE", status: 400, message: "Écriture déséquilibrée" },

  // ─── Système ───────────────────────────────────────────────────────────────
  INTERNAL_ERROR:         { code: "INTERNAL_ERROR",         status: 500, message: "Erreur interne" },
  DB_ERROR:               { code: "DB_ERROR",               status: 500, message: "Erreur base de données" },
} as const

export type ComptaErrorKey = keyof typeof COMPTA_ERRORS

/**
 * Construit une NextResponse JSON normalisée pour le module compta.
 * On peut surcharger le message lisible avec `messageOverride`.
 */
export function comptaError(
  key: ComptaErrorKey,
  details?: Record<string, unknown>,
  messageOverride?: string,
): NextResponse {
  const e = COMPTA_ERRORS[key]
  return NextResponse.json(
    {
      error: messageOverride ?? e.message,
      code:  e.code,
      ...(details !== undefined ? { details } : {}),
    },
    { status: e.status },
  )
}

/** Réponse succès standard (objet unique). */
export function comptaOk<T>(data: T, init?: { status?: number; meta?: Record<string, unknown> }): NextResponse {
  return NextResponse.json(
    { data, ...(init?.meta ? { meta: init.meta } : {}) },
    { status: init?.status ?? 200 },
  )
}

/** Réponse succès paginée (liste). */
export function comptaOkList<T>(
  data: T[],
  pagination: { total: number; page: number; page_size: number },
): NextResponse {
  return NextResponse.json({ data, ...pagination }, { status: 200 })
}
