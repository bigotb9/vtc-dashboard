# Phase 4 — Vague 2 : Journaux + Relevés + Rapport mensuel + Boutons rapides

**Statut :** livrée et activée
**Date :** 2026-05-13
**Stack :** Next.js 16 · Supabase · Puppeteer serverless (`puppeteer-core` + `@sparticuz/chromium`)

---

## Vue d'ensemble

La Vague 2 ferme Phase 4 PDF & Exports comptables. Elle ajoute **3 rapports PDF**
(Journaux, Relevés de trésorerie, Rapport mensuel premium), **2 sélecteurs UI
multi-pastilles** (filtre journaux, filtre caisses), et **2 boutons rapides**
(Dashboard et Liste opérations).

Les 5 cards de la page `/comptabilite/exports` sont désormais toutes actives —
aucune n'est plus marquée "À venir".

---

## Fichiers livrés (Vague 2)

### Builders (côté lib)
| Fichier | Rôle |
|--|--|
| `lib/compta/exports/buildJournaux.ts` | Agrège les écritures par préfixe (VE, OD, CA, BQ, AC, PA) avec filtre multi-sélection. Réutilise le pattern JOIN Supabase déclaratif. |
| `lib/compta/exports/buildReleves.ts` | Construit les relevés de trésorerie caisse/compte par caisse/compte, avec solde initial calculé (deltas pré-période) et solde cumulé par mouvement. |
| `lib/compta/exports/buildRapportMensuel.ts` | Agrégateur 7 sections : KPIs (CA, dépenses, résultat net, trésorerie + précédents), évolution 6 mois, top catégories, top véhicules, soldes, health, top 20 opérations, commentaire exécutif auto-généré. |

### Templates HTML (côté composants)
| Fichier | Rôle |
|--|--|
| `components/compta/pdf/JournauxTemplate.tsx` | Sections par journal + tableau chronologique + sous-totaux + bandeau totaux. |
| `components/compta/pdf/RelevesTemplate.tsx` | Synthèse globale + 1 section page-break par caisse/compte (header + bloc soldes + table mouvements + solde cumulé). |
| `components/compta/pdf/RapportMensuelTemplate.tsx` | 7 sections : couverture, résumé exécutif, évolution (SVG line chart 700×280), top catégories (table + bar), top véhicules, soldes (bar horizontal), health + annexes top 20. |

### UI : sélecteurs Phase 4
| Fichier | Rôle |
|--|--|
| `components/compta/ExportsJournauxSelector.tsx` | Pastilles multi-sélection (Tous + VE, OD, CA, BQ, AC, PA). État sentinel `["all"]`. |
| `components/compta/ExportsCaissesSelector.tsx` | Pastilles avec `CaisseLogo` (chargées via parallel fetch `/caisses` + `/comptes`), tags "C" (caisse) / "B" (bancaire). |

### Routes API (mises à jour)
| Fichier | Modification |
|--|--|
| `app/api/compta/exports/[type]/route.ts` | `IMPLEMENTED` couvre désormais les 5 types. Dispatcher passe `body.journaux` à `buildJournaux` et `body.caisses_ids` à `buildReleves`. Format `A4-landscape` réservé à la balance. |
| `app/api/compta/exports/[type]/preview/route.ts` | Même dispatcher 5-types, retourne HTML wrappé dans `<div style="max-width: 210mm;…">`. |

### Page Exports (réécrite)
`app/comptabilite/exports/page.tsx` :
- État `journauxSelected` et `caissesSelected` (défaut `["all"]`).
- `buildBody(type)` ajoute `journaux` pour `"journaux"`, `caisses_ids` pour `"releves-caisses"`.
- 5 cards actives (GL, BL, JR, RC, RM) — plus aucun flag `upcoming`.
- Cards Journaux et Relevés portent leurs sélecteurs via le slot `extras`.

### Boutons rapides (Phase 4 §3.6)
| Fichier | Bouton ajouté |
|--|--|
| `components/compta/DashboardHeader.tsx` | **"Exporter ce mois"** (violet). POST `/api/compta/exports/rapport-mensuel` avec le mois civil courant. Affiche `Loader2` pendant la génération. |
| `app/comptabilite/operations/page.tsx` | **"Exporter en PDF"** (violet). POST `/api/compta/exports/grand-livre` avec `filters.date_from` / `filters.date_to`. Fallback "année courante" si `period === "tout"`. |

---

## Récapitulatif des 5 types d'export

| Code | Type | Format | Filtre | Pages typiques |
|--|--|--|--|--|
| GL | Grand Livre | A4 portrait | — | ~10-30 |
| BL | Balance | A4 paysage | — | ~2-4 |
| JR | Journaux | A4 portrait | `journaux[]` | ~5-15 |
| RC | Relevés de trésorerie | A4 portrait | `caisses_ids[]` | ~3-8 |
| RM | Rapport mensuel premium | A4 portrait | — | 8-12 |

---

## Points techniques notables

**Pattern JOIN Supabase déclaratif** — Tous les builders qui chargent des
écritures avec leurs lignes utilisent `select("..., lignes_ecritures (id, ordre,
compte_syscohada_code, libelle, debit, credit)")`. Un seul aller-retour HTTP,
JOIN exécuté en PostgreSQL, scalable au-delà de 10 000 écritures. Élimine
définitivement le risque `HeadersOverflowError` rencontré en Vague 1.

**Charts SVG inline** — Le Rapport mensuel embarque ses charts directement en
SVG dans le HTML (pas de Chart.js, pas d'images bitmap). Garantit une qualité
vectorielle parfaite à l'impression et zéro dépendance runtime côté navigateur
Puppeteer.

**Commentaire auto-généré (`generateCommentaire`)** — Le Rapport mensuel produit
un paragraphe en français basé sur les tendances détectées (CA en hausse/baisse,
résultat, top catégorie, alertes santé). Pas de modèle IA — pure logique de seuils
sur les KPIs précédents.

**Multi-select state machine** — Les sélecteurs Journaux et Caisses utilisent
le sentinel `["all"]`. Toute sélection partielle se convertit automatiquement,
et passer à zéro sélection rebascule sur `["all"]`. Robuste contre l'état vide.

---

## Spec Phase 4 §3.6 — couverture

> "Dashboard `/comptabilite` : Ajouter un bouton 'Exporter ce mois' en haut à
> droite. Direct → POST `/api/compta/exports/rapport-mensuel` avec période
> courante. Liste opérations `/comptabilite/operations` : Bouton 'Exporter en
> PDF' à côté du filtre actuel. Export du Grand Livre filtré sur les critères
> actuels (caisse, catégorie, période)."

| Exigence | Statut |
|--|--|
| Bouton "Exporter ce mois" sur Dashboard | livré (DashboardHeader) |
| POST rapport-mensuel avec mois civil courant | livré (`currentMonthRange()`) |
| Bouton "Exporter en PDF" sur Liste opérations | livré (page operations) |
| Réutilise les filtres actuels (`date_from`, `date_to`) | livré (via `filters`) |
| Fallback `period === "tout"` → année courante | livré + toast info |

> Note : le filtre `caisse_id` / `categorie_id` ne se propage pas encore au
> Grand Livre (le builder actuel produit un GL global). Si requis ultérieurement,
> ajouter un paramètre optionnel `caisses_ids` / `categories_ids` à
> `buildGrandLivre` et le passer depuis `handleExportPdf`.

---

## tsc — état

Une exécution `npx tsc --noEmit` dans le sandbox Linux retourne des erreurs
généralisées (`TS1127 Invalid character`, `TS17008 JSX has no closing tag`,
`TS1002 Unterminated string literal`) sur des dizaines de fichiers — y compris
des fichiers que la Vague 2 n'a pas touchés (ex. `app/api/compta/bootstrap/route.ts`
ligne 310, `app/chauffeurs/[id]/page.tsx` ligne 317).

Cause identifiée : le montage `/sessions/.../mnt/vtc-dashboard/` voit des
snapshots tronqués / avec NULL bytes en queue, là où la vue Windows
authoritative (outil `Read`) montre des fichiers complets et syntaxiquement
corrects. Exemple :

```
$ wc -lc components/compta/DashboardHeader.tsx
   91  3448 components/compta/DashboardHeader.tsx
```

…alors que la vue Read renvoie un fichier de 130 lignes structurellement valide.

**Recommandation :** relancer `npx tsc --noEmit` côté Windows (PowerShell ou
terminal IDE) après cette livraison. La vue Windows est la source de vérité ;
les builds Vercel / Next dev server lisent depuis cette vue, pas depuis le
mount Linux.

---

## Récap Phase 4 complète (Vagues 1 + 2)

**Vague 1** (livrée + correctifs validés) :
- Infrastructure Puppeteer serverless (`generatePdf.ts`, `pdfStyles.ts`,
  `formatters.ts`, `next.config.ts` avec `serverExternalPackages`)
- Auto-détection Chrome local (Windows/Mac/Linux) + fallback `@sparticuz/chromium`
- 2 PDF : Grand Livre, Balance
- Routes API dispatcher + preview + metadata
- UI : `ExportsPage`, `ExportsHeader`, `ExportsPeriodBar`, `ExportsReportCard`,
  `ExportProgressModal`
- Correctif HeadersOverflowError → JOIN Supabase déclaratif

**Vague 2** (cette livraison) :
- 3 PDF : Journaux, Relevés, Rapport mensuel premium
- 2 sélecteurs multi-pastilles
- 2 boutons rapides Dashboard + Liste opérations
- Activation complète des 5 cards exports

**Total Phase 4 : ~20 fichiers neufs + ~6 fichiers modifiés.**
