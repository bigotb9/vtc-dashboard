/**
 * Constantes du module Justificatifs (Phase 4.x Vague 3 §7.2).
 *
 * Source de vérité partagée par lib, routes API et composants UI.
 */

export const JUSTIFICATIF_MAX_FILE_SIZE  = 5  * 1024 * 1024   // 5 Mo par fichier
export const JUSTIFICATIF_MAX_TOTAL_SIZE = 15 * 1024 * 1024   // 15 Mo par opération
export const JUSTIFICATIF_MAX_FILES      = 5
export const JUSTIFICATIF_BUCKET         = "justificatifs"
export const SIGNED_URL_TTL_SECONDS      = 60

export const JUSTIFICATIF_ALLOWED_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const

export type JustificatifMimeType = (typeof JUSTIFICATIF_ALLOWED_MIMES)[number]

/** Extensions acceptées par l'input file (côté UI uniquement). */
export const JUSTIFICATIF_ACCEPT_ATTR = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"

/** Slug-ify a filename for safe storage. */
export function slugifyFilename(name: string): string {
  // Sépare nom + extension
  const dot = name.lastIndexOf(".")
  const base = dot > 0 ? name.slice(0, dot) : name
  const ext  = dot > 0 ? name.slice(dot + 1).toLowerCase() : ""
  const slugged = base
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")            // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "fichier"
  return ext ? `${slugged}.${ext}` : slugged
}

/** Build storage path : `{operation_id}/{justificatif_id}-{slug}` */
export function buildStoragePath(operationId: string, justificatifId: string, filename: string): string {
  return `${operationId}/${justificatifId}-${slugifyFilename(filename)}`
}
