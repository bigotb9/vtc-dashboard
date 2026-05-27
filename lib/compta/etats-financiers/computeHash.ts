/**
 * Hash SHA-256 de traçabilité des états financiers (Phase 4.2 §6.3).
 *
 * Le hash est calculé sur la version canonique JSON du payload (clés
 * triées). Stocké dans `etats_financiers_archives` à chaque export PDF.
 */

import { createHash, randomUUID } from "crypto"

/** Canonicalise un objet (clés triées) avant hash, pour reproductibilité. */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v)
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`
  const obj = v as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map(k => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`
}

export function computeHashSha256(payload: unknown): string {
  return createHash("sha256").update(canonicalJson(payload), "utf8").digest("hex")
}

export function newTraceabilityUuid(): string {
  return randomUUID()
}
