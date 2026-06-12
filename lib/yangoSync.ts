/**
 * Logique centralisée pour la synchronisation Yango.
 * Évite la duplication entre BoyahDashboard et CommandesPage.
 */

import { authFetch } from "@/lib/authFetch"

const SYNC_KEY     = "yango_last_sync"
const SYNC_DELAY   = 5 * 60 * 1000 // 5 minutes

/** Retourne true si une sync auto est nécessaire (> 5 min depuis la dernière). */
export function shouldAutoSync(): boolean {
  if (typeof window === "undefined") return false
  const last = parseInt(localStorage.getItem(SYNC_KEY) || "0")
  return Date.now() - last > SYNC_DELAY
}

/** Marque l'instant de la dernière sync. */
export function markSynced() {
  if (typeof window !== "undefined")
    localStorage.setItem(SYNC_KEY, Date.now().toString())
}

/** Lance une sync incrémentale (dernières commandes) et retourne le nombre de courses importées.
 *
 * Patch 24/05/2026 : propage le vrai message d'erreur (status HTTP + message
 * serveur) au lieu d'un libelle generique. Permet de diagnostiquer rapidement
 * (vars d'env manquantes, API Yango KO, etc.).
 */
export async function runQuickSync(): Promise<{ synced: number; error?: string }> {
  try {
    const r = await authFetch("/api/yango/sync-orders", { method: "POST" })
    const d = await r.json()
    if (!r.ok) {
      return { synced: 0, error: `HTTP ${r.status} : ${d.error || JSON.stringify(d).slice(0, 200)}` }
    }
    if (d.error) {
      return { synced: 0, error: d.error }
    }
    markSynced()
    return { synced: d.synced ?? 0 }
  } catch (e) {
    return { synced: 0, error: `Erreur réseau : ${(e as Error).message || String(e)}` }
  }
}

/** Lance une sync complète depuis une date donnée, page par page.
 *
 * Patch 24/05/2026 : propage le vrai message d'erreur HTTP / serveur.
 */
export async function runFullSync(
  fromDate: string,
  onProgress: (total: number) => void
): Promise<{ total: number; error?: string }> {
  let total   = 0
  let hasMore = true
  try {
    while (hasMore) {
      const r = await authFetch("/api/yango/sync-orders", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ from_date: fromDate }),
      })
      const d = await r.json()
      if (!r.ok) {
        return { total, error: `HTTP ${r.status} : ${d.error || JSON.stringify(d).slice(0, 200)}` }
      }
      if (d.error) {
        return { total, error: d.error }
      }
      total  += d.synced ?? 0
      hasMore = d.has_more === true
      onProgress(total)
      if (hasMore) await new Promise(res => setTimeout(res, 500))
    }
    markSynced()
    return { total }
  } catch (e) {
    return { total, error: `Erreur réseau : ${(e as Error).message || String(e)}` }
  }
}
