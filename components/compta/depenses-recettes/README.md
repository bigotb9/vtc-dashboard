# Module `depenses-recettes` — Phase 4.x Vague 3.5

Vue unifiée des flux financiers Boyah lisant directement depuis la table
`operations` (Phase 4). Remplace progressivement les pages `/depenses` et
`/recettes` historiques basées sur `depenses_vehicules` / `vue_recettes_vehicules`.

## Routes pendant le dev

- `/depenses-v2` — vue dépenses (refonte)
- `/recettes-v2` — vue recettes (refonte)

Les routes historiques `/depenses` et `/recettes` restent inchangées jusqu'à
validation. Switch final via `app/depenses/page.tsx` qui appellera
`<FlowPageClient kind="depenses" />` au lieu du composant `.old`.

## Structure

```
components/compta/depenses-recettes/
├── PeriodBar.tsx              7 onglets de période (réutilisable)
├── KpiCard.tsx                variantes "number" / "toplist" avec glow
├── EvolutionChart.tsx         bar chart SVG 6 mois
├── RepartitionDonut.tsx       donut top 4 + Autres
├── FiltersBar.tsx             barre repliée + panel 8 filtres
├── OperationsTable.tsx        table paginée + tri colonne
├── ExportPdfModal.tsx         modal export PDF avec période
├── FlowPageClient.tsx         orchestrateur partagé depenses/recettes
└── README.md                  ce fichier
```

## Endpoints backend

- `GET /api/compta/depenses` — liste paginée + filtres
- `GET /api/compta/depenses/stats` — KPIs + top + évolution + répartitions
- `POST /api/compta/depenses/export-pdf` — PDF Puppeteer
- `GET /api/compta/recettes`, `/stats`, `POST /export-pdf` — miroir

Tous lisent depuis `operations` avec `type=sortie` (resp. `entree`),
`statut='valide'`, et **excluent par défaut `source='transfert_interne'`**
(évite la double-comptabilisation des transferts internes — les 2 jambes
apparaîtraient sinon).

## Lib partagée

- `lib/compta/flow/parseFilters.ts` — parsing query params + fallback "ce mois"
- `lib/compta/flow/queryOperations.ts` — fetch liste avec JOIN déclaratif
- `lib/compta/flow/computeStats.ts` — calcul KPIs / top / évolution / donuts
- `lib/compta/formatMontantCompact.ts` — format "1,85 M" / "320 k" / "850 F"

## Hooks

- `hooks/compta/useFlowData.ts` — `useFlowData(kind, filters)` orchestre les 2 fetch
  parallèles (liste + stats) avec dédup par `reqId` et `loadingMore` doux sur les
  re-fetch.

## Persistance URL

Tous les filtres sont reflétés dans l'URL (`useSearchParams` + `router.replace`
avec `scroll: false`). La page est bookmarkable / partageable. Le bouton retour
du navigateur fonctionne.

## Plan de switch (cf. spec §4.4)

1. **Étape 1 (livré)** — créer `/depenses-v2` et `/recettes-v2`.
2. **Étape 2** — Emmanuel teste en parallèle de l'ancienne page.
3. **Étape 3** — switch :
   - Remplacer le contenu de `app/depenses/page.tsx` par `<FlowPageClient kind="depenses" />`
   - Idem pour `app/recettes/page.tsx`
   - Renommer `components/DepensesPageClient.tsx` → `.old.tsx` (rollback possible)
4. **Étape 4** — supprimer les `.old.tsx` après 2 semaines sans souci.
