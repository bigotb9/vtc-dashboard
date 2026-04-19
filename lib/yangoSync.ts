/**
 * Logique centralisée pour la synchronisation Yango.
 * Évite la duplication entre BoyahDashboard et CommandesPage.
 */

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

/** Lance une sync incrémentale (dernières commandes) et retourne le nombre de courses importées. */
export async function runQuickSync(): Promise<{ synced: number; error?: string }> {
  try {
    const r = await fetch("/api/yango/sync-orders", { method: "POST" })
    const d = await r.json()
    markSynced()
    return { synced: d.synced ?? 0 }
  } catch {
    return { synced: 0, error: "Erreur de synchronisation" }
  }
}

/** Lance une sync complète depuis une date donnée, page par page. */
export async function runFullSync(
  fromDate: string,
  onProgress: (total: number) => void
): Promise<{ total: number; error?: string }> {
  let total   = 0
  let hasMore = true
  try {
    while (hasMore) {
      const r = await fetch("/api/yango/sync-orders", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ from_date: fromDate }),
      })
      const d = await r.json()
      total  += d.synced ?? 0
      hasMore = d.has_more === true
      onProgress(total)
      if (hasMore) await new Promise(res => setTimeout(res, 500))
    }
    markSynced()
    return { total }
  } catch {
    return { total, error: "Erreur lors du sync complet" }
  }
}
