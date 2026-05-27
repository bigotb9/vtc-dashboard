/**
 * components/LoadingSkeleton.tsx
 *
 * Skeleton de page utilise par les fichiers `loading.tsx` Next.js.
 * Affiche pendant que le HTML/JS de la page se charge (avant React mount).
 *
 * Style coherent avec le reste de Fleet :
 *   - card grise pulsante pour le header
 *   - 4 cards KPI pulsantes
 *   - 1 bloc large pulsant pour le contenu principal
 *
 * Cree au Lot Q (26/05/2026 audit) pour les pages lourdes :
 *   - /comptabilite, /clients, /depenses-v2, /recettes-v2, /verify
 *   - /comptabilite/etats-financiers/{bilan, compte-resultat, notes-annexes, tft}
 */

export default function LoadingSkeleton({
  title = "Chargement…",
  showKpis = true,
}: {
  title?:    string
  showKpis?: boolean
}) {
  return (
    <div className="space-y-6 animate-in pb-10">
      {/* HEADER skeleton */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-gray-200 dark:bg-white/5 animate-pulse" />
        <div className="h-6 w-48 rounded-lg bg-gray-200 dark:bg-white/5 animate-pulse" />
      </div>

      {/* KPIs skeleton (4 cards) */}
      {showKpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-2xl border border-gray-100 dark:border-[#1E2D45] bg-white dark:bg-[#0D1424] p-4"
            >
              <div className="h-3 w-20 rounded bg-gray-200 dark:bg-white/5 animate-pulse mb-3" />
              <div className="h-7 w-32 rounded bg-gray-200 dark:bg-white/5 animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* Contenu principal skeleton */}
      <div className="rounded-2xl border border-gray-100 dark:border-[#1E2D45] bg-white dark:bg-[#0D1424] p-6">
        <div className="h-4 w-40 rounded bg-gray-200 dark:bg-white/5 animate-pulse mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-12 rounded-xl bg-gray-100 dark:bg-white/[0.03] animate-pulse"
              style={{ opacity: 1 - i * 0.12 }}
            />
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center" aria-live="polite">
        {title}
      </p>
    </div>
  )
}
