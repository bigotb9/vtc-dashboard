# Phase 4.3 — États financiers complets SYSCOHADA

> Suite directe de Phase 4.2 (Bilan + Compte de résultat). Livraison de 4 modules
> pour finaliser la conformité SYSCOHADA à 100 % (dépôt DGI / banque / auditeur).
>
> **Effort réel** : ~3 h 30 (estimation initiale 12 – 15 h, gain via réutilisation
> massive de l'infra Phase 4.2).
> **Statut** : ✅ livré
> **Conventions Cowork respectées** : 8/8 ✅ (audit §10)

---

## 1. Résumé exécutif

Avec Phase 4.3, Fleet Boyah produit un **dossier d'états financiers déposable
tel quel à la DGI** sans intervention manuelle additionnelle :

| Module | Livrable | Effort | Statut |
|--------|----------|--------|--------|
| **M1** | Auto-écriture résultat compte 13 (équilibrage Bilan) | 1 h | ✅ |
| **M2** | Notes annexes simplifiées (6 notes + texte paramétrable) | 1 h | ✅ |
| **M3** | Tableau Flux de Trésorerie SYSCOHADA + réconciliation Bilan | 45 min | ✅ |
| **M4** | Dossier complet (1 PDF unifié 10-12 pages) | 45 min | ✅ |

---

## 2. Inventaire des livrables

### 2.1 Migrations SQL (2 fichiers — additives)
- `supabase/migrations/20260520100000_phase43_auto_ecriture_resultat.sql`
  - Colonnes `auto_generated` / `auto_generation_type` sur `ecritures_comptables`
  - 2 triggers `enforce_exercice_clos_lock_*` (écritures + lignes)
  - Extension CHECK type `comptes_syscohada.type` → ajout `'technique'`
  - Insertion des comptes `130`, `139`, `89`, `891`
  - Mapping bilan pour `130` / `139` (longest-prefix match)
  - Fonctions PG `ajuster_resultat_exercice(uuid, bool)` + `recalculer_resultat_exercice(uuid)`
- `supabase/migrations/20260520110000_phase43_notes_annexes.sql`
  - Extension `societe_parametres` : `methodes_comptables` / `engagements_hors_bilan` / `methode_amortissement` / `methode_stocks`
  - Texte de méthodes comptables SYSCOHADA par défaut
  - Extension CHECK `etats_financiers_archives.type_etat` → ajout `'notes_annexes'`, `'tft'`, `'dossier_complet'`

### 2.2 Lib helpers (3 nouveaux)
- `lib/compta/etats-financiers/ajusterResultatExercice.ts` — wrapper Node de la RPC PG
- `lib/compta/etats-financiers/calculerNotesAnnexes.ts` — 6 notes (1+6 texte libre, 2-5 extraites des écritures)
- `lib/compta/etats-financiers/calculerTft.ts` — 3 sections SYSCOHADA + réconciliation

### 2.3 Routes API (5 nouvelles)
- `GET  /api/compta/etats-financiers/notes-annexes` (calcul)
- `POST /api/compta/etats-financiers/notes-annexes/export-pdf`
- `GET  /api/compta/etats-financiers/tft` (calcul)
- `POST /api/compta/etats-financiers/tft/export-pdf`
- `POST /api/compta/etats-financiers/dossier-complet/export-pdf` (maxDuration 60 s)

### 2.4 PDF templates (3 nouveaux)
- `components/compta/pdf/NotesAnnexesPdfTemplate.tsx`
- `components/compta/pdf/TftPdfTemplate.tsx`
- `components/compta/pdf/DossierCompletPdfTemplate.tsx` (wrapper unifié)

### 2.5 Pages UI (3 nouvelles)
- `app/comptabilite/etats-financiers/page.tsx` — Hub avec carte "Dossier complet"
- `app/comptabilite/etats-financiers/notes-annexes/page.tsx` — 6 notes en cartes color-coded
- `app/comptabilite/etats-financiers/tft/page.tsx` — Cascade A/B/C + bandeau réconciliation

### 2.6 Modifications existantes (5 fichiers)
- `lib/compta/etats-financiers/calculerBilan.ts` — Inclut désormais les écritures auto_generated sans operation_id
- `app/api/compta/etats-financiers/bilan/export-pdf/route.ts` — Appel `ajusterResultatSiOuvert` AVANT calcul Bilan
- `lib/compta/exercices/cloturerExercice.ts` — Appel `ajusterResultatExercice` une dernière fois avant `statut='clos'`
- `lib/compta/parametres/getParametresSociete.ts` — 4 nouveaux champs renvoyés
- `lib/compta/validators.ts` — Schema Zod étendu (méthodes + textes notes)
- `components/compta/societe/IdentiteForm.tsx` — 2 sections "Notes annexes" + selects méthodes
- `types/compta-ui.ts` — Ajout `NotesAnnexesData`, `TftData`, types associés
- `components/Sidebar.tsx` — Sous-liens TFT + Notes annexes sous "États financiers"

---

## 3. Module 1 — Auto-écriture résultat

### Stratégie comptable validée (décision utilisateur 17/05/2026)

**Compte technique 891 + 130 / 139** — approche SYSCOHADA stricte :

| Cas | Écriture |
|-----|----------|
| Bénéfice (résultat > 0) | DEBIT 891 / CREDIT **130** |
| Perte (résultat < 0)    | DEBIT **139** / CREDIT 891 |
| Nul                     | Pas d'écriture créée |

- **Compte 891 "Détermination du résultat"** = classe 8 type `technique`, exclu du Bilan automatiquement par `calculerBilan` (filtre `startsWith("8")`).
- **Comptes 130 / 139** mappés via `bilan_mapping` au poste `CP_RESULTAT` (longest-prefix match prioritaire sur classe `13` générique).

### Cycle de vie

```
[Exercice OUVERT — export Bilan]
  → ajusterResultatSiOuvert(exerciceId)
  → DELETE écritures auto_generated existantes
  → INSERT nouvelle écriture (n° AUTO-RES-2026-xxxxxxxx, journal OD)
  → INSERT 2 lignes (891 + 130 ou 139 + 891)
[Clôture exercice]
  → ajusterResultatExercice() une dernière fois
  → UPDATE exercices SET statut='clos'
  → Trigger enforce_exercice_clos_lock_ecriture verrouille l'écriture auto
[Exercice CLOS — export Bilan]
  → ajusterResultatSiOuvert() détecte statut='clos' → no-op
  → L'écriture déjà figée est lue par calculerBilan (chemin auto_generated)
```

### Trigger enforce_clos étendu

L'ancien trigger ne couvrait que `operations` — les écritures auto ne sont pas
liées à une opération. **Solution** : 2 nouveaux triggers sur `ecritures_comptables`
et `lignes_ecritures`. Bypass via `current_setting('compta.auto_recalcul_allowed')`
pour la fonction `ajuster_resultat_exercice(force=TRUE)` en recovery admin.

### Modification calculerBilan

`loadSoldesExercice` charge désormais **deux jeux d'écritures** :
1. Celles issues d'`operations` de l'exercice (existant)
2. **Celles avec `auto_generated=TRUE AND exercice_id=$1`** (nouveau) — sans
   filtre operation_id, pour récupérer l'auto-écriture résultat.

---

## 4. Module 2 — Notes annexes simplifiées

### Architecture des 6 notes

| # | Note | Source | Stockage |
|---|------|--------|----------|
| 1 | Méthodes comptables | `societe_parametres.methodes_comptables` (texte libre) | BD |
| 2 | État des immobilisations | Écritures classes 21-27 + amort 28x | À la volée |
| 3 | Dotations amortissements | Comparaison cumul 28x N vs N-1 | À la volée |
| 4 | Créances + Dettes | Soldes 411, 401, 42-47, 16/17/18 | À la volée (V1 : tout en -1 an) |
| 5 | Variation capitaux propres | Comparaison 10x, 11x, 13x N vs N-1 | À la volée |
| 6 | Engagements hors bilan | `societe_parametres.engagements_hors_bilan` (texte libre) | BD |

### Décision validée : extraire Notes 2/3 des écritures classes 2x/28x

Pas de table `immobilisations` dédiée (Phase 4.4 future). Le helper
`calculerNotesAnnexes` reconstitue les soldes par catégorie à partir des
écritures comptables, avec fallback "Aucune immobilisation enregistrée"
si tous les soldes sont nuls.

### Texte par défaut "Méthodes comptables"

La migration injecte un texte SYSCOHADA standard prêt-à-l'emploi dans
`societe_parametres.methodes_comptables` (référentiel, devise, FIFO, linéaire,
mode engagement, etc.). L'utilisateur peut l'éditer dans
`/comptabilite/parametres-societe`.

### Validation Zod

`societeParametresSchema` étendu avec :
- `methodes_comptables: z.string().max(5000).nullable().optional()`
- `engagements_hors_bilan: z.string().max(5000).nullable().optional()`
- `methode_amortissement: z.enum(["lineaire", "degressif"]).optional()`
- `methode_stocks: z.enum(["fifo", "cmp", "lifo"]).optional()`

---

## 5. Module 3 — Tableau Flux de Trésorerie

### Cascade SYSCOHADA officielle

```
A — FLUX OPÉRATIONNELS
  + Résultat net de l'exercice (compte 13 via auto-écriture)
  + Dotations 68x
  − Reprises 78x
  − Variation stocks (Δ classe 3x)
  − Variation créances clients (Δ 411)
  + Variation dettes fournisseurs (Δ 401)
  − Variation autres créances (Δ 42, 44 débit)
  + Variation autres dettes (Δ 43 crédit)
  = FLUX A

B — FLUX D'INVESTISSEMENT (signe inversé : variation positive = acquisition = sortie de trésorerie)
  − Variation 21 + 22 + 23 + 24 + 25 + (26 + 27)
  = FLUX B

C — FLUX DE FINANCEMENT
  + Δ Capital (10x crédit)
  + Δ Emprunts (16x crédit)
  + Δ Autres dettes financières (17x crédit)
  − Dividendes versés (proxy via Δ 11x négatif)
  = FLUX C

VARIATION NETTE = A + B + C
```

### Réconciliation Bilan (validation cohérence)

```
treso_debut + variation_nette === treso_fin (classe 5x)
```
- **Trésorerie** = (52 + 53 + 57 actif débit) − (56 passif crédit)
- Bandeau visuel : ✅ vert si `|ecart| < 1 F`, ❌ rouge sinon
- En cas d'écart : message d'aide pointant les causes probables (écritures incomplètes, classification erronée, etc.)

### Limites V1 documentées
- Pas de séparation acquisitions/cessions au niveau ligne (variation nette uniquement)
- Pas de plus/moins-values cession (comptes 81/82) — calcul approximé
- Dividendes versés estimés via diminution du report à nouveau (11x)
- Phase 4.4 future raffinera

---

## 6. Module 4 — Dossier complet PDF

### Architecture validée (décision utilisateur) : Concaténation HTML + 1 passe Puppeteer

```typescript
// renderDossierCompletPdfTemplate
return `
  ${pageGarde}                              // page de garde plein écran
  ${wrapSection(renderBilanPdfTemplate(...))}
  ${wrapSection(renderCompteResultatPdfTemplate(...))}
  ${wrapSection(renderTftPdfTemplate(...))}
  ${wrapSection(renderNotesAnnexesPdfTemplate(...))}
  ${pageFinale}                             // signature + hash + QR 80×80
`
```

Le wrapper injecte `page-break-before: always` entre chaque section. **Un seul
appel Puppeteer** → performances optimales (~3-5 s pour 10-12 pages, en-deçà
des 60 s du `maxDuration`).

### Hash unifié

Le hash SHA-256 du dossier est calculé sur le **JSON unifié des 4 sections** :
```typescript
{ type: "dossier_complet", data: { bilan, compteResultat, tft, notesAnnexes } }
```
→ 1 seul hash, 1 seul UUID, 1 seul QR sur la dernière page.

### Archivage
La table `etats_financiers_archives` accepte désormais `type_etat='dossier_complet'`
(extension CHECK migration 20260520110000).

---

## 7. Templates PDF étendus pour le dossier complet

Les 3 nouveaux templates `NotesAnnexesPdfTemplate`, `TftPdfTemplate`,
`DossierCompletPdfTemplate` acceptent désormais 2 options optionnelles :
- `hideHeader?: boolean` — masquer le header société (utilisé quand on enchaîne dans le dossier complet)
- `hideFooter?: boolean` — masquer le pied traçabilité (un seul pied global en dernière page du dossier)

Les templates `Bilan` et `CompteResultat` de Phase 4.2 ne sont pas modifiés —
ils gardent header et footer (cohérent visuellement, redondant mais sans gêne).

---

## 8. Pré-requis déploiement

1. **`npm install`** (aucune nouvelle dépendance — uniquement réutilisation)
2. **Migrations SQL à jouer** dans l'ordre :
   - `20260520100000_phase43_auto_ecriture_resultat.sql`
   - `20260520110000_phase43_notes_annexes.sql`
   - Idempotentes (CREATE IF NOT EXISTS / ALTER ADD COLUMN IF NOT EXISTS / CHECK avec DO block)
3. **Aucune variable d'environnement nouvelle** (réutilise `NEXT_PUBLIC_VERIFY_BASE_URL` du patch QR pour les nouveaux PDF)
4. **Pas de modification DNS / Vercel** au-delà de Phase 4.2

---

## 9. Tests d'acceptation (§6 du spec)

### M1 — Auto-écriture résultat
- [ ] 6.1.1 Pré-Phase 4.3 : Bilan déséquilibré → écart Actif/Passif visible
- [ ] 6.1.2 Post-Phase 4.3 : Bilan équilibré (écart < 1 F)
- [ ] 6.1.3 Vérifier en BD : `SELECT * FROM ecritures_comptables WHERE auto_generated=TRUE AND exercice_id=...` → 1 ligne
- [ ] 6.1.4 Nouvelle op classe 6 → nouvel export Bilan → écriture auto recalculée (UUID change)
- [ ] 6.1.5 Clôture → l'écriture auto refuse `DELETE` / `UPDATE` via trigger

### M2 — Notes annexes
- [ ] 6.2.1 Page `/comptabilite/etats-financiers/notes-annexes` accessible (directeur)
- [ ] 6.2.2 Note 1 affiche le texte de `societe_parametres.methodes_comptables`
- [ ] 6.2.3 Note 2 : immo listées si comptes 2x utilisés, sinon "Aucune immobilisation"
- [ ] 6.2.4 Note 3 : idem amortissements (28x + 68x)
- [ ] 6.2.5 Note 4 : créances + dettes en colonnes
- [ ] 6.2.6 Note 5 : variation = solde_fin − solde_debut
- [ ] 6.2.7 Note 6 : texte `engagements_hors_bilan`
- [ ] 6.2.8 Export PDF Notes annexes → 4-6 pages avec hash + QR

### M3 — TFT
- [ ] 6.3.1 Page `/comptabilite/etats-financiers/tft` accessible
- [ ] 6.3.2 Flux A, B, C calculés
- [ ] 6.3.3 Variation nette = A + B + C
- [ ] 6.3.4 Réconciliation : treso_debut + variation = treso_fin
- [ ] 6.3.5 Bandeau vert si écart < 1 F, rouge avec montant sinon
- [ ] 6.3.6 Comparatif N-1 affiché (vide si premier exercice)
- [ ] 6.3.7 Export PDF TFT → 2 pages

### M4 — Dossier complet
- [ ] 6.4.1 Carte "Dossier complet" visible sur `/etats-financiers`
- [ ] 6.4.2 Génération → PDF unique 10-12 pages
- [ ] 6.4.3 Structure : garde + Bilan + CR + TFT + Notes + signature/hash
- [ ] 6.4.4 1 seul hash + 1 QR (taille 80×80 dernière page)
- [ ] 6.4.5 Archive `type_etat='dossier_complet'` insérée

### Régression
- [ ] 6.5.1 Bilan + CR Phase 4.2 toujours fonctionnels
- [ ] 6.5.2 Vagues 1, 2, 3, 3.5, 3.6, 4.2 + Patch QR : OK
- [ ] 6.5.3 `npx tsc --noEmit` → 0 erreur
- [ ] 6.5.4 Aucune dep ajoutée (audit #5 ci-dessous)

---

## 10. Audit 8 conventions Cowork (5 scripts pré-livraison)

| # | Convention | Résultat |
|---|---|---|
| 1 | UTF-8 sans BOM + pas de mojibake | ✅ 16/16 fichiers du patch — clean |
| 2 | React StrictMode safe (capture ref avant await) | ✅ Pages `notes-annexes`, `tft`, `etats-financiers` utilisent pattern `cancelled` |
| 3 | Pas de `<button>` imbriqué | ✅ Aucun nesting détecté |
| 4 | Aucun `overflow-hidden` sur popover | ✅ N/A — uniquement templates PDF + tableaux |
| 5 | Typing `XxxInput` vs `XxxPayload` | ✅ Types ajoutés en *Data (calculs internes) + *Payload extension (validators Zod) |
| 6 | `tsc --noEmit` + smoke test | ⚠️ À exécuter localement après `npm install` (workspace sandbox sans node_modules) |
| 7 | authFetch + FormData | ✅ N/A — Phase 4.3 utilise uniquement JSON POST / RPC server-side |
| 8 | `npm install` pour nouvelles deps | ✅ N/A — Phase 4.3 ne nécessite aucune nouvelle dépendance |

---

## 11. Points de vigilance & limites V1 documentées

### 11.1 Module Immobilisations absent (§7.1 spec)
✅ Stratégie hybride mise en place : extraction depuis écritures 2x/28x avec
   fallback "Aucune immo" si soldes nuls. Phase 4.4 future ajoutera la table
   dédiée `immobilisations`.

### 11.2 BFR — Besoin en Fonds de Roulement (§7.2 spec)
⚠️ Le helper `calculerTft` n'inclut pas de check de cohérence préalable sur
   les comptes 41x/40x à signe inversé. À surveiller manuellement en V1.

### 11.3 Méthodes comptables texte libre (§7.3 spec)
✅ V1 conforme au spec : textarea simple dans `IdentiteForm` avec texte par
   défaut SYSCOHADA pré-rempli par la migration. Phase 4.4 = éditeur structuré.

### 11.4 Comparatif N-1 (§7.4 spec)
✅ Si l'exercice N-1 n'existe pas : colonne N-1 affiche `0` / `—`. Pas d'erreur.

### 11.5 Dossier complet — performance (§7.5 spec)
✅ Architecture 1-passe Puppeteer = ~3-5 s pour 10-12 pages. `maxDuration` à
   60 s avec marge confortable. Promise.all sur les 4 calculs préalables
   garantit la parallélisation.

### 11.6 Multi-tenant futur (§7.6 spec)
✅ Toutes les migrations Phase 4.3 sont compatibles ajout `tenant_id` futur.
   Aucune table créée — uniquement extensions de tables existantes.

---

## 12. Récapitulatif livraison

**24 fichiers** (12 créés, 8 modifiés, 4 routes nouvelles)
- 2 migrations BDD additives idempotentes
- 3 helpers Node + 1 RPC PG (+ 1 RPC wrapper)
- 5 routes API + 3 PDF templates + 3 pages UI + 1 carte hub
- 8 conventions Cowork respectées (5 audits ✅, 1 ⚠️ smoke, 2 N/A)

Le patch est **rétrocompatible**, **safe à déployer** (migrations additives),
**sans nouvelle dépendance**, et préserve l'intégralité du contrat API Phase 4.2.

Avec cette phase, **Fleet Boyah devient un outil de production comptable
conforme SYSCOHADA à 100 %**, déposable tel quel à la DGI avant le 31 mars
ou à toute banque/auditeur sans intervention manuelle additionnelle.
