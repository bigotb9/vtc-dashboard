# Phase 4.2 — Logo + Bilan + Compte de résultat SYSCOHADA

**Statut :** livré, prêt pour smoke test
**Date :** 2026-05-16
**Effort estimé spec :** 12-15 h
**Conventions respectées :** UTF-8 sans BOM · pas d'overflow-hidden sur popover ·
StrictMode safe · pas de button-in-button · XxxInput/XxxPayload · authFetch
FormData (déjà OK depuis V3).

---

## 1. Vue d'ensemble

Phase 4.2 finalise la compta SYSCOHADA en livrant 3 modules :

1. **Paramètres société** : page d'admin pour configurer logo + identité légale
   (raison sociale, RCCM, N° CC, capital, NIF, code NAF, régime fiscal). Le
   logo s'affiche dans tous les PDF existants.
2. **Exercices comptables** : workflow d'ouverture / clôture avec trigger BD
   qui verrouille définitivement les écritures d'un exercice clos.
3. **États financiers** : Bilan SYSCOHADA révisé + Compte de résultat avec
   cascade des 9 SIG. Génération PDF officielle avec hash SHA-256 de
   traçabilité et route publique de vérification.

---

## 2. Fichiers livrés

### Migrations BD (4 fichiers)
| Fichier | Contenu |
|--|--|
| `20260518120000_compta_societe_parametres.sql` | Table singleton + bucket Storage `logos` + RLS table + storage policies |
| `20260518121000_compta_exercices_v2.sql` | ALTER `exercices` (annee, statut, date_cloture, resultat_net, bilan_pdf_path, cr_pdf_path) + backfill + 2 triggers (`set_exercice_id_on_operation`, `enforce_exercice_clos_lock`) |
| `20260518122000_compta_bilan_mapping.sql` | Table `bilan_mapping` + seed SYSCOHADA standard (28 classes mappées) |
| `20260518123000_compta_etats_financiers_archives.sql` | Table `etats_financiers_archives` + RPC publique `verify_etat_financier` (SECURITY DEFINER) |

### Types + Validators (2 fichiers étendus)
- `types/compta-ui.ts` — 15+ types Phase 4.2 (SocieteParametres, ExerciceItem, BilanData, BilanLigne, BilanSection, CompteResultatData, SIGRow, EtatsFinanciersArchiveRef…)
- `lib/compta/validators.ts` — `societeParametresSchema` + `exerciceCreateSchema`

### Lib helpers (5 fichiers)
- `lib/compta/parametres/getParametresSociete.ts` — singleton + signed URL logo
- `lib/compta/exercices/listExercices.ts` — liste enrichie + counts bulk
- `lib/compta/exercices/cloturerExercice.ts` — workflow clôture (validation brouillons + calcul résultat + création exercice suivant)
- `lib/compta/etats-financiers/computeResultatNet.ts` — résultat net rapide
- `lib/compta/etats-financiers/calculerBilan.ts` — agrégation Actif/Passif via `bilan_mapping`
- `lib/compta/etats-financiers/calculerCompteResultat.ts` — cascade des 9 SIG
- `lib/compta/etats-financiers/computeHash.ts` — SHA-256 + UUID v4

### Routes API (10 endpoints)
| Méthode | Route | Rôle |
|--|--|--|
| GET / PUT | `/api/compta/parametres-societe` | Singleton société |
| POST / DELETE | `/api/compta/parametres-societe/logo` | Upload (FormData) / supprimer logo |
| GET / POST | `/api/compta/exercices` | Liste + création |
| POST | `/api/compta/exercices/[id]/cloturer` | Clôture irréversible |
| GET | `/api/compta/etats-financiers/bilan` | Calcul Bilan |
| POST | `/api/compta/etats-financiers/bilan/export-pdf` | PDF Bilan + archive |
| GET | `/api/compta/etats-financiers/compte-resultat` | Calcul CR |
| POST | `/api/compta/etats-financiers/compte-resultat/export-pdf` | PDF CR + archive |
| GET (PUBLIC) | `/api/compta/verify/[uuid]` | Vérification d'authenticité d'un PDF |

### Composants UI (7 fichiers)
- `components/compta/societe/LogoUploader.tsx` — drag-drop + preview (pas d'overflow-hidden)
- `components/compta/societe/IdentiteForm.tsx` — 3 sections (Identité, Légal, Exercice par défaut)
- `components/compta/exercices/ClotureModal.tsx` — confirmation irréversible avec blocage si brouillons
- `components/compta/pdf/BilanPdfTemplate.tsx` — header logo + tableaux Actif/Passif + bandeau équilibre + footer hash
- `components/compta/pdf/CompteResultatPdfTemplate.tsx` — cascade 9 SIG + page-break SIG6 + footer hash

### Pages UI (4 pages)
- `app/comptabilite/parametres-societe/page.tsx`
- `app/comptabilite/exercices/page.tsx`
- `app/comptabilite/etats-financiers/bilan/page.tsx`
- `app/comptabilite/etats-financiers/compte-resultat/page.tsx`

### Intégrations existantes (5 fichiers modifiés)
- `lib/pdf/buildHeader.ts` + `lib/pdf/pdfStyles.ts` — Header avec logo (image + texte côte à côte)
- `lib/compta/exports/common.ts` — `loadSocieteInfo` lit `societe_parametres` en priorité, fallback `parametres_module_compta`
- `components/compta/pdf/FicheTiersTemplate.tsx` + `FlowReportTemplate.tsx` — Logo intégré
- `components/Sidebar.tsx` — 4 NavLinks ajoutés (Bilan, CR, Exercices, Société)

**Total : 4 migrations + 5 lib + 10 routes + 7 composants + 4 pages + 5 modifs = ~35 fichiers.**

---

## 3. Décisions clés

**Singleton via UNIQUE INDEX `((TRUE))`** — La table `societe_parametres` n'autorise
qu'une seule ligne. Si SaaS multi-tenant : remplacer par `UNIQUE(tenant_id)`
plus tard.

**Coexistence `parametres_module_compta` ↔ `societe_parametres`** — Pas de
migration destructive. La fonction `loadSocieteInfo()` lit d'abord
`societe_parametres` (Phase 4.2), puis tombe en fallback sur
`parametres_module_compta` (Phase 3). Migration finale différée à 4.3.

**Mapping `bilan_mapping` configurable** — Le seed couvre les classes SYSCOHADA
standard. Chaque tenant peut override avec `override_manuel = true` pour
personnaliser. Détection automatique du préfixe le plus long (ex : compte
`4011` → `401` → `PC_FOURNISSEURS`).

**Hash SHA-256 canonicalisé** — La fonction `canonicalJson()` trie les clés
avant hash → reproductible. Si Emmanuel re-génère un PDF avec les mêmes
données, le hash doit être identique (sauf si une op a été modifiée).

**Trigger `enforce_exercice_clos_lock`** — BEFORE INSERT/UPDATE/DELETE sur
operations. Toute tentative de modif sur un exercice clos → `RAISE
EXCEPTION 'Exercice clos : modifications interdites'`. Sécurité défense en
profondeur.

**Route `/verify/[uuid]` publique** — Aucune auth. Utilise une RPC PG
`verify_etat_financier` SECURITY DEFINER qui retourne uniquement {hash,
date, raison, résultat net}. Un tiers (DGI, banque) reçoit un PDF papier,
lit l'UUID en pied de page, fait GET et compare le hash.

**Page-break PDF CR** — Insertion automatique d'un page-break avant le SIG 6
(Résultat financier) pour respecter la pagination 5+4 de la spec §6.2.

---

## 4. Smoke test §7 (protocole obligatoire)

### 7.1 — Paramètres société
1. Aller sur `/comptabilite/parametres-societe`
2. Remplir nom + raison sociale → cliquer Enregistrer → toast vert
3. Upload PNG 1 Mo → preview apparaît
4. Upload JPG 3 Mo → erreur "trop volumineux"
5. Upload PDF → erreur "format non supporté"
6. Supprimer logo → revient au header texte seul
7. Exporter un Grand Livre → vérifier que le header inclut le logo

### 7.2 — Exercices
1. `/comptabilite/exercices` → exercice 2026 ouvert
2. "Nouvel exercice" → crée 2027 statut ouvert
3. Re-cliquer "Nouvel exercice" → si annee=2027 déjà existante → erreur
4. Tenter clôture 2026 si brouillons présents → modal bloquante avec message clair
5. Valider tous les brouillons puis clôturer 2026 → toast résultat net
6. Vérifier en BD :  `statut='clos'`, `resultat_net` rempli, exercice 2027 créé si pas déjà là
7. Tenter INSERT op avec exercice 2026 (clos) → erreur trigger BD
8. INSERT op avec date dans 2027 → `exercice_id` auto-rempli vers 2027

### 7.3 — Bilan
1. `/comptabilite/etats-financiers/bilan` → sélecteur exercice = 2026
2. Tableaux Actif/Passif rendus avec sections (Immobilisations, Circulant, etc.)
3. Bandeau équilibre vert si Actif = Passif (à 1 F près), rouge sinon
4. Comparatif Net N-1 affiché à droite (vide si exercice 2025 absent)
5. "Exporter PDF officiel" → fichier `bilan-exercice-2026-2026-12-31.pdf`
6. PDF a 2 pages (Actif page 1, Passif page 2 avec page-break-before), bandeau équilibre, footer hash
7. Headers HTTP `X-Etat-Financier-Hash` et `X-Etat-Financier-Uuid` présents
8. Vérifier : 1 ligne insérée dans `etats_financiers_archives`

### 7.4 — Compte de résultat
1. `/comptabilite/etats-financiers/compte-resultat` → cascade 9 SIG rendue
2. Chaque SIG a son détail (lignes signées + / −) et son total surligné
3. Couleurs : Marge ambre, VA bleu, EBE/Résultat expl vert, Financier indigo, HAO rose, Résultat net bleu marine plein
4. "Exporter PDF officiel" → 2 pages (SIG 1-5 page 1, SIG 6-9 page 2)
5. Résultat net cohérent avec ligne "Résultat de l'exercice" du Bilan
6. Hash + UUID en footer

### 7.5 — Hash de traçabilité
1. Exporter Bilan → noter UUID
2. GET `/api/compta/verify/<uuid>` (sans auth) → réponse `{verified: true, hash, raison_sociale, ...}`
3. Modifier une op de l'exercice + re-générer Bilan → nouveau UUID + nouveau hash
4. Vérifier que l'ancien UUID renvoie toujours `verified: true` (audit trail préservé)

### 7.6 — Régression
1. PDF Grand Livre, Balance, Fiche tiers, Annexe justificatifs → tous ont le logo dans le header
2. Vagues 1, 2, 3, 3.5 → toutes fonctionnelles
3. Encodage UTF-8 OK partout (pas de Ã, Â)

---

## 5. Smoke SQL

```sql
-- 1) Tables créées
SELECT table_name FROM information_schema.tables
 WHERE table_schema='public'
   AND table_name IN ('societe_parametres','bilan_mapping','etats_financiers_archives');
-- Attendu : 3 lignes

-- 2) Colonnes ajoutées sur exercices
SELECT column_name FROM information_schema.columns
 WHERE table_schema='public' AND table_name='exercices'
   AND column_name IN ('annee','statut','date_cloture','resultat_net','bilan_pdf_path','cr_pdf_path');
-- Attendu : 6 lignes

-- 3) Triggers actifs
SELECT tgname FROM pg_trigger
 WHERE tgname IN ('tr_operations_set_exercice','tr_operations_exercice_clos_lock');
-- Attendu : 2 lignes

-- 4) Buckets
SELECT id, public, file_size_limit FROM storage.buckets WHERE id IN ('logos','justificatifs');

-- 5) Mapping SYSCOHADA seedé
SELECT classe_compte, poste_bilan, section FROM bilan_mapping ORDER BY ordre;
-- Attendu : 28 lignes

-- 6) RPC verify
SELECT proname, prosecdef FROM pg_proc
 WHERE proname = 'verify_etat_financier';
-- Attendu : 1 ligne, prosecdef=true
```

---

## 6. Points de vigilance

**Buckets manuels** — Les `INSERT INTO storage.buckets ON CONFLICT DO UPDATE`
peuvent échouer sur certains environnements Supabase si les droits sont
restreints. Vérifier dans le dashboard Storage qu'`logos` est bien créé. Sinon
créer manuellement avec : private, max 2 Mo, mimes PNG/JPEG/SVG.

**Bilan déséquilibré ?** — En V1 simplifiée, si Actif ≠ Passif c'est
généralement parce que :
- La ligne "Résultat de l'exercice" (compte 13) n'a pas été enregistrée dans
  les écritures (le calcul Bilan additionne les classes 1-5, ne déduit pas
  automatiquement le résultat).
- Solution : avant l'export, créer une écriture OD qui débite/crédite le
  compte 13 avec le résultat calculé. Sera automatisé dans Phase 4.3.

**SIG = 0** — Si les SIG retournent 0, c'est que les opérations ne sont pas
encore correctement écriturées (lignes manquantes ou compte_syscohada_code
absent). Vérifier `lignes_ecritures` pour les classes 6 et 7.

**Hash reproductible** — Le hash SHA-256 est calculé sur le JSON canonicalisé
(clés triées). Toute modification d'une op de l'exercice → nouveau hash. Le
PDF avec un ancien hash n'est plus "vivant" mais reste archivé pour audit.

**Singleton + multi-tenant futur** — L'`UNIQUE INDEX ((TRUE))` sur
`societe_parametres` bloque toute 2e ligne. Lors du passage SaaS, retirer cet
index et ajouter `UNIQUE(tenant_id)`.

---

## 7. Récap effort

| Étape | Estimé spec | Statut |
|--|--|--|
| Module 1 : Paramètres société + logo + bucket | 3 h | livré |
| Module 1 : Intégration header PDF existants | 1 h | livré |
| Module 2 : Exercices + triggers + workflow | 2 h | livré |
| Module 3 : Bilan calculs + UI + PDF | 3 h 30 | livré |
| Module 3 : CR + 9 SIG + UI + PDF | 3 h 30 | livré |
| Hash + archive + verify | 1 h 30 | livré |
| Smoke test + corrections | 1 h | à faire côté Emmanuel |
| **Total** | **15 h 30** | livré |

---

## 8. Prochaine étape

Phase 4.3 (suggérée) :
- Notes annexes + tableau des flux de trésorerie (compléter les États financiers)
- Auto-écriture du résultat dans compte 13 pour équilibrer le Bilan
- Multi-tenant : ajouter `tenant_id` partout
- Audit annuel par expert-comptable agréé recommandé avant prod officielle DGI
