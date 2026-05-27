# Phase 4.x — Vague 3.5 : Refonte /depenses + /recettes (vues unifiées)

**Statut :** livré, prêt pour smoke test côté Emmanuel
**Date :** 2026-05-14
**Périmètre :** Refonte des pages `/depenses` et `/recettes` en vues unifiées
sur la table `operations` (Phase 4). Routes alternatives `/depenses-v2` et
`/recettes-v2` pendant la phase de validation, sans toucher aux pages
historiques (cf. spec §4.4).

---

## 1. Vue d'ensemble

Avant : `/depenses` lit `vue_dashboard_depenses` (dépenses véhicules
uniquement) et `/recettes` lit `vue_recettes_vehicules` (Wave uniquement).
Tous les autres flux (salaires, fournisseurs, reversements, manuel) sont
saisis via le module compta mais n'apparaissent pas sur ces pages → KPIs
incomplets.

Après : `/depenses-v2` et `/recettes-v2` lisent directement `operations`
(source de vérité Phase 4) et présentent un dashboard opérationnel complet
(KPIs / top 3 / bar chart 6 mois / donut répartition / table paginée /
8 filtres avancés / export PDF).

---

## 2. Fichiers livrés

### Types & lib (4 fichiers)
| Fichier | Rôle |
|--|--|
| `types/compta-ui.ts` | +10 types Vague 3.5 (`FlowKind`, `FlowPeriodKey`, `FlowFilters`, `FlowOperationItem`, `FlowListResponse`, `FlowStatsResponse`, `FlowTopEntry`, `FlowSlice`, `FlowDateRange`, `FlowSource`). |
| `lib/compta/formatMontantCompact.ts` | `formatMontantCompact` ("1,85 M" / "320 k" / "850 F") + `formatMontantFull` + `formatMontantSigne`. |
| `lib/compta/flow/parseFilters.ts` | Parsing des query params (CSV → arrays) + `ensureDateRange` fallback "ce mois" + `kindToOpType`. |
| `lib/compta/flow/queryOperations.ts` | `fetchFlowOperations` — JOIN déclaratif Supabase sur caisse + compte + categorie + tiers + lookups véhicule/chauffeur/client. Exclut `transfert_interne` par défaut. |
| `lib/compta/flow/computeStats.ts` | `computeFlowStats` — KPIs + top 3 catégories/tiers/chauffeurs + évolution 6 mois + répartitions donuts. |

### Routes API (6 endpoints)
| Endpoint | Rôle |
|--|--|
| `GET /api/compta/depenses` | Liste paginée + filtres (CSV) |
| `GET /api/compta/depenses/stats` | KPIs + agrégats |
| `POST /api/compta/depenses/export-pdf` | PDF Puppeteer |
| `GET /api/compta/recettes` | Miroir recettes |
| `GET /api/compta/recettes/stats` | Miroir recettes |
| `POST /api/compta/recettes/export-pdf` | Miroir recettes |

### Hook (1 fichier)
- `hooks/compta/useFlowData.ts` — `useFlowData(kind, filters)` orchestre `liste + stats` en parallèle + gère `loadingMore` doux pour les transitions de filtres.

### Composants UI (8 fichiers + README)
| Fichier | Rôle |
|--|--|
| `components/compta/depenses-recettes/PeriodBar.tsx` | 7 onglets de période + inputs "Personnalisé" |
| `components/compta/depenses-recettes/KpiCard.tsx` | Variants `number` (trend %) et `toplist` (3 lignes), glow blur, icon gradient |
| `components/compta/depenses-recettes/EvolutionChart.tsx` | Bar chart SVG 6 mois, mois courant mis en avant, ticks Y auto |
| `components/compta/depenses-recettes/RepartitionDonut.tsx` | Donut top 4 + "Autres", centre = total, légende dessous |
| `components/compta/depenses-recettes/FiltersBar.tsx` | Barre repliée + panel 8 filtres (Catégorie, Caisse, Véhicule, Chauffeur, Tiers, Source, Min, Max) |
| `components/compta/depenses-recettes/OperationsTable.tsx` | Table paginée + tri colonne (date_op / montant), badges catégorie selon source |
| `components/compta/depenses-recettes/ExportPdfModal.tsx` | Modal export avec période ajustable |
| `components/compta/depenses-recettes/FlowPageClient.tsx` | Orchestrateur partagé depenses/recettes (URL state) |
| `components/compta/pdf/FlowReportTemplate.tsx` | Template HTML PDF (en-tête société + KPIs + table + total) |
| `components/compta/depenses-recettes/README.md` | Doc structure et plan de switch |

### Pages (2 fichiers)
- `app/depenses-v2/page.tsx` — `<FlowPageClient kind="depenses" />`
- `app/recettes-v2/page.tsx` — `<FlowPageClient kind="recettes" />`

**Total : 23 fichiers neufs + 1 modif (`types/compta-ui.ts`). Aucune migration BD.**

---

## 3. Architecture des données

### Pipeline backend
```
URL query params (CSV)
   └──► parseFilters() ─────► FlowFilters (Node)
                                  │
                                  ├──► fetchFlowOperations()
                                  │       SELECT operations
                                  │       JOIN caisse, compte, categorie, tiers
                                  │       + lookups vehicules / chauffeurs / clients (FK INT)
                                  │       FILTERS (cat / caisse / véhicule / chauffeur / tiers / source / min / max / search)
                                  │       EXCLUSION source='transfert_interne' par défaut
                                  │       ORDER BY date_op DESC / LIMIT 20
                                  │
                                  └──► computeFlowStats()
                                         Agrégats Node :
                                          - total_period, count_period
                                          - total_previous_period (même durée juste avant `from`)
                                          - trend_pct
                                          - top 3 catégories / tiers (depenses) / chauffeurs (recettes)
                                          - evolution_monthly (6 derniers mois ISO YYYY-MM)
                                          - repartition_categories (top 4 + Autres)
                                          - repartition_sources (recettes)
```

### Frontend
```
URL state (useSearchParams)
   └── readFilters() → FlowFilters
         │
         └── useFlowData(kind, filters)
              ├── GET /api/compta/[kind]?<filters>     → list
              └── GET /api/compta/[kind]/stats?<filters> → stats
                  Promise.all + loadingMore sur re-fetch
                  (dédup via reqId pour éviter race conditions)
```

---

## 4. Décisions clés

**Exclusion `transfert_interne` par défaut** — Les 2 ops jumelles d'un
transfert (sortie + entrée) sont volontairement exclues des KPIs Dépenses
et Recettes pour ne pas gonfler artificiellement les totaux (l'argent reste
chez Boyah). Le filtre `sources` peut les ré-inclure si l'utilisateur le
demande explicitement.

**Période précédente comparable** — `trend_pct` compare avec une fenêtre
de même durée juste avant `from` (et pas le mois calendaire précédent),
ce qui rend la comparaison sensée même pour les périodes personnalisées.

**JOIN déclaratif Supabase** — Le helper `queryOperations.ts` utilise le
pattern `select("..., caisse:caisse_id (...), tiers:tiers_id (...)")` —
même approche que les builders PDF pour éviter les requêtes en cascade et
le `HeadersOverflowError`.

**Format compact** — `formatMontantCompact()` formate "1 850 000" en "1,85 M"
en français (séparateur virgule + supprime les zéros de fin). Utilisé dans
les KPIs toplist et axes graphiques pour économiser l'espace.

**Filtres dans l'URL** — Tout l'état (filtres + tri + page + période) est
reflété dans les query params. `router.replace(..., { scroll: false })`
évite les sauts de scroll lors des changements de filtre.

**Routes alternatives** — `/depenses-v2` et `/recettes-v2` pour permettre
à Emmanuel de tester sans toucher aux pages historiques. Switch trivial
en remplaçant le contenu de `app/depenses/page.tsx` une fois validé
(cf. README §Plan de switch).

---

## 5. Tests d'acceptation §5 (spec) — couverture

| Cas | Statut |
|--|--|
| Période vide → data:[], total_period:0, top_*:[] | livré (helpers retournent vide) |
| Période avec depenses_vehicules uniquement | livré (apparaît avec source=depense_vehicule) |
| Période avec manuel uniquement | livré |
| Période mixte | livré (tri date desc) |
| Filtre catégorie / tiers / véhicule | livré (.in() Supabase) |
| Tri montant desc | livré (`?sort_by=montant&sort_order=desc`) |
| Pagination | livré (`page` / `page_size`, max 100) |
| Trend mois précédent | livré (fenêtre de même durée avant `from`) |
| Filtres avancés repliés par défaut | livré |
| Badge compteur sur Filtres avancés | livré |
| Réinitialiser | livré (`onReset` → URL avec from/to "ce mois" uniquement) |
| URL bookmarkable | livré (URL state via `router.replace`) |
| Export PDF | livré (Puppeteer + template + filtres propagés) |
| Empty state + CTA | livré |
| Click ligne → /comptabilite/operations/[id] | livré (`router.push`) |
| Montants colorés rouge/vert | livré (`accent` selon `kind`) |

---

## 6. Smoke test recommandé (Emmanuel)

1. Aller sur `/depenses-v2` (et `/recettes-v2`) — onglet "Ce mois" par défaut.
2. Vérifier que le **Total dépenses** inclut bien les opérations manuelles
   (salaires, fournisseurs) en plus des dépenses véhicules.
3. Vérifier que les **Top 3 tiers** affichent les bons noms (ex. Garage Atta,
   Mme Lengue Vanessa selon les tiers rétroactivement liés en Vague 2).
4. Cliquer "Filtres avancés" → vérifier que le panel s'ouvre et que les 8
   filtres chargent leurs listes (catégories, caisses, véhicules, chauffeurs,
   tiers, sources, min, max).
5. Sélectionner un véhicule → la liste doit se filtrer immédiatement.
6. Bookmarker l'URL après filtrage → recharger : les filtres doivent être
   restaurés.
7. Cliquer "PDF" → modal s'ouvre avec la période active préremplie → Générer
   → fichier `depenses-boyah-YYYY-MM-DD_to_YYYY-MM-DD.pdf` téléchargé.
8. Cliquer une ligne → redirection `/comptabilite/operations/[id]`.
9. Comparer `Total dépenses` mois courant avec la réalité Boyah (cf. spec §5.3).

---

## 7. Plan de migration (cf. spec §4.4)

| Étape | Action | Statut |
|--|--|--|
| 1 | Créer routes alternatives `/depenses-v2` + `/recettes-v2` | livré |
| 2 | Emmanuel valide en parallèle de l'ancienne page | à faire |
| 3 | Switch : remplacer `app/depenses/page.tsx` → `<FlowPageClient kind="depenses" />` ; renommer `components/DepensesPageClient.tsx` en `.old.tsx` ; idem recettes | à faire après validation |
| 4 | Supprimer les `.old.tsx` après 2 semaines sans souci | à faire après validation |

---

## 8. Points de vigilance

**Performance** — Pour le volume actuel (< 1 000 ops/mois), les agrégations
Node sont rapides. Si > 10 000 ops/mois, prévoir une vue matérialisée
`mv_operations_monthly` rafraîchie en CRON nightly (cf. spec §3.1.2).

**Coexistence avec `vue_dashboard_depenses`** — Les vues SQL historiques
restent en place et continuent d'alimenter `/depenses` (et `/recettes`)
historiques. Aucune destruction prévue avant la fin de la phase de
validation.

**Exclusion `transfert_interne`** — Pour ré-inclure dans la liste, ajouter
explicitement `?sources=manuel,transfert_interne,...` à l'URL. La spec §7.3
suggère que c'est un choix volontaire (transferts internes = pas un flux
net pour Boyah).

**tsc** — Le mount Linux remonte des faux positifs documentés sur certains
fichiers (snapshots tronqués / NULL bytes). À valider côté Windows.

---

## 9. Récap fichiers (chemins absolus)

Migration BD : **aucune**.

Backend (`lib/compta/`) :
- `formatMontantCompact.ts`
- `flow/parseFilters.ts`
- `flow/queryOperations.ts`
- `flow/computeStats.ts`

Routes API (`app/api/compta/`) :
- `depenses/route.ts` (GET liste)
- `depenses/stats/route.ts`
- `depenses/export-pdf/route.ts`
- `recettes/route.ts`
- `recettes/stats/route.ts`
- `recettes/export-pdf/route.ts`

Hook : `hooks/compta/useFlowData.ts`

Components (`components/compta/`) :
- `depenses-recettes/PeriodBar.tsx`
- `depenses-recettes/KpiCard.tsx`
- `depenses-recettes/EvolutionChart.tsx`
- `depenses-recettes/RepartitionDonut.tsx`
- `depenses-recettes/FiltersBar.tsx`
- `depenses-recettes/OperationsTable.tsx`
- `depenses-recettes/ExportPdfModal.tsx`
- `depenses-recettes/FlowPageClient.tsx`
- `depenses-recettes/README.md`
- `pdf/FlowReportTemplate.tsx`

Pages :
- `app/depenses-v2/page.tsx`
- `app/recettes-v2/page.tsx`

Types : `types/compta-ui.ts` (extension)

**Total : 23 fichiers neufs + 1 modif.** Estimé spec : 24-32h.
