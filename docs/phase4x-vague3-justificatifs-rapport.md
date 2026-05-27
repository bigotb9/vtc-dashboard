# Phase 4.x — Vague 3 : Justificatifs des opérations

**Statut :** livré, prêt pour smoke test côté Emmanuel
**Date :** 2026-05-15
**Effort estimé spec :** 8 h
**Conventions V2 respectées :** UTF-8 sans BOM, pas d'overflow-hidden sur
composants popover, types XxxPayload/XxxInput cohérents, accessibility
HTML (pas de `<button>` imbriqué), race conditions React StrictMode.

---

## 1. Vue d'ensemble

Le module Justificatifs ajoute la gestion documentaire (factures, reçus,
photos) attachée aux opérations. Justificatif **obligatoire** dès que
`type = 'sortie'` ET `tiers_id IS NOT NULL` (sécurisé par trigger BD).

Stockage : Supabase Storage bucket `justificatifs` (privé, max 5 Mo par
fichier, mimes PDF/JPG/PNG). Soft delete avec audit trail SYSCOHADA.

Workflow utilisateur :
1. Créer l'op en brouillon (le formulaire bloque la validation directe
   pour sortie+tiers et explique la marche à suivre).
2. Sur la page détail, l'uploader s'ouvre automatiquement.
3. Upload du justificatif (drag-drop ou bouton).
4. Cliquer "Valider" → trigger BD passe (≥ 1 justif actif présent).

---

## 2. Fichiers livrés

### Migration BD (1 fichier)
| Fichier | Contenu |
|--|--|
| `supabase/migrations/20260517120000_compta_justificatifs.sql` | Table `justificatifs` + 3 indexes (partiel actif + uploaded_by + all), trigger `enforce_justificatif_required` (BEFORE INSERT/UPDATE), RLS table directeur, bucket `justificatifs` (idempotent INSERT INTO storage.buckets), 4 policies storage.objects (SELECT/INSERT/UPDATE/DELETE directeur). |

### Constants + types (2 fichiers)
- `lib/compta/justificatifs/constants.ts` — `JUSTIFICATIF_MAX_FILE_SIZE` (5 Mo), `MAX_TOTAL_SIZE` (15 Mo), `MAX_FILES` (5), `ALLOWED_MIMES`, `BUCKET`, `SIGNED_URL_TTL_SECONDS`, `slugifyFilename()`, `buildStoragePath()`.
- `types/compta-ui.ts` — `JustificatifMimeType`, `JustificatifRef`, `JustificatifUploadResponse`, `justificatifs_count` sur `OperationView` et `TiersOperationRow`, `missing_proof` sur `OperationsFilters`, `nb_ops_missing_proof` sur `DashboardHealth`.

### Lib helpers (3 fichiers)
| Fichier | Rôle |
|--|--|
| `lib/compta/justificatifs/uploadJustificatif.ts` | Validations mime/size/quota → pre-INSERT (réserve id) → upload Storage → patch storage_path. Rollback en cas d'échec. |
| `lib/compta/justificatifs/deleteJustificatif.ts` | Soft delete avec refus si dernier justif d'op validée (CONFLICT) ou si op annulée (FORBIDDEN). |
| `lib/compta/justificatifs/listJustificatifs.ts` | `listJustificatifs()` + `countJustificatifsByOperation()` (bulk) + `getJustificatifSignedUrl()`. Bulk signed URLs via `createSignedUrls`. |

### Routes API (4 endpoints + extension /operations)
| Route | Méthode | Rôle |
|--|--|--|
| `/api/compta/operations/[id]/justificatifs` | GET  | Liste enrichie + signed URLs |
| `/api/compta/operations/[id]/justificatifs` | POST | Upload multipart `field=file` |
| `/api/compta/justificatifs/[id]/download` | GET  | Redirect 302 vers signed URL (avec Content-Disposition: attachment) |
| `/api/compta/justificatifs/[id]` | DELETE | Soft delete |
| `/api/compta/operations` (extension) | GET | Filtre `?missing_proof=true` + `justificatifs_count` bulk dans chaque ligne |

### Composants UI (3 fichiers)
| Fichier | Rôle |
|--|--|
| `components/compta/JustificatifsUploader.tsx` | Drop-zone + bouton "Ajouter" + multi-fichiers + progress + suppression. Validations client mime/size avant upload. Pas d'overflow-hidden. |
| `components/compta/JustificatifsCard.tsx` | Card section avec liseré indigo, grille de vignettes (img direct pour PNG/JPG, icône FileText pour PDF), click → viewer. Bouton "Ajouter / Gérer" toggle l'uploader inline. |
| `components/compta/JustificatifViewer.tsx` | Modal fullscreen z-60. PDF → iframe ; image → img ; navigation ← / → ; Esc + clic backdrop ferment ; bouton Télécharger. |
| `components/compta/MissingProofBanner.tsx` | Banner ambre cliquable sur le dashboard (visible si nb > 0) → `/comptabilite/operations?missing_proof=true`. |

### Modifs fichiers existants (8)
| Fichier | Modification |
|--|--|
| `app/comptabilite/operations/nouveau/page.tsx` | `needsJustifFirst` désactive le bouton Valider + banner indigo "Justificatif obligatoire — enregistre en brouillon" |
| `app/comptabilite/operations/[id]/page.tsx` | `<JustificatifsCard>` entre `TiersRetroactionCard` et `EcritureComptableCard` ; uploader auto-open si brouillon+sortie+tiers |
| `app/api/compta/operations/route.ts` | Filtre `?missing_proof=true` (post-filtrage Node après pré-filtres SQL) + `justificatifs_count` bulk |
| `app/api/compta/dashboard/stats/route.ts` | Compte `nb_ops_missing_proof` + push anomalie "X opérations sans justif" |
| `components/compta/TiersOperationsTable.tsx` | Colonne "Justif." avec compteur 📎 N (lien vers fiche op) ou badge ambre "manquant" si sortie sans justif |
| `app/api/compta/tiers/[id]/operations/route.ts` | Inclut `justificatifs_count` bulk dans la réponse |
| `app/comptabilite/page.tsx` | `<MissingProofBanner>` sous `<HealthBanner>` |
| `lib/compta/exports/buildFicheTiers.ts` + `components/compta/pdf/FicheTiersTemplate.tsx` | Colonne "Justif." dans tableau historique + annexe "Justificatifs joints sur la période" avec tableau Date/Libellé/Montant/Fichier/Format/Upload |

**Total : 1 migration BD + 9 fichiers neufs (3 composants + 1 banner + 4 routes + 3 lib + 1 constants) + 8 modifs.**

---

## 3. Architecture critique

### Trigger d'enforcement BD
```sql
CREATE TRIGGER tr_operations_justificatif_required
  BEFORE INSERT OR UPDATE OF statut, type, tiers_id ON operations
  FOR EACH ROW EXECUTE FUNCTION enforce_justificatif_required();
```
- Bloque les passages à `statut='valide'` quand type=sortie+tiers et 0 justif actif
- Sécurité de défense en profondeur (la validation primaire reste côté API)
- `(TG_OP = 'INSERT' OR OLD.statut <> 'valide')` évite de re-checker à chaque UPDATE inutile

### Workflow upload (recommandé spec §3.3.5 option B)
```
POST /operations {statut: 'brouillon'}           → trigger ne s'active pas
POST /operations/[id]/justificatifs (file)       → upload Storage + insert table
PATCH /operations/[id] {statut: 'valide'}        → trigger passe (≥ 1 justif)
```

### Pre-INSERT pattern (uploadJustificatif)
1. INSERT avec `storage_path = "pending"` → retourne l'`id` généré
2. UPLOAD Storage avec path = `{op_id}/{justif_id}-{slug}`
3. UPDATE `storage_path = <real>`
4. Rollback en cas d'échec (DELETE row + remove storage)

### Signed URLs (60s)
- Régénérées à chaque GET liste via `createSignedUrls()` bulk
- Ne JAMAIS cacher dans le browser
- Le download endpoint régénère + redirect 302

---

## 4. Smoke test §5 spec — protocole

### 5.1 Création opération sortie vers tiers
1. `/comptabilite/operations/nouveau` → type=Sortie → section justif **invisible**
2. Sélectionner Wave + catégorie + tiers (Garage Atta) → bouton **Valider désactivé**, banner indigo "Justificatif obligatoire"
3. "Enregistrer en brouillon" → redirect vers `/comptabilite/operations/[id]`
4. Sur Écran 2 : carte Justificatifs auto-ouverte avec uploader
5. Drag-drop facture-atta.pdf (2 Mo) → vignette PDF apparaît
6. Drag-drop photo-pneus.jpg (6 Mo) → erreur "trop volumineux"
7. Drag-drop fichier.exe → erreur "format non supporté"
8. Drag-drop 5 fichiers cumulant 12 Mo → OK, 6e fichier → erreur "limite 5 max"
9. Retour formulaire → cliquer "Valider" → trigger BD passe (≥ 1 justif présent)

### 5.2 Consultation
1. Sur la fiche op → carte Justificatifs avec vignettes
2. Click sur miniature JPG → modal viewer (img)
3. Click sur miniature PDF → modal viewer (iframe)
4. Click "Télécharger" → fichier téléchargé avec nom original
5. Sur la fiche tiers Garage Atta → colonne Justif. montre `📎 1` (clic = lien vers fiche op)

### 5.3 Suppression
1. Brouillon avec 1 justif → DELETE → OK
2. Op validée avec 3 justifs → DELETE 1 → OK (reste 2)
3. Op validée avec 1 justif → DELETE → erreur 409 CONFLICT
4. Op annulée → DELETE → erreur 403 FORBIDDEN

### 5.4 Health Dashboard
1. `/comptabilite` → bannière ambre "X opérations sortie vers tiers sans justif"
2. Click → redirection `/comptabilite/operations?missing_proof=true`
3. Liste filtrée = ops sortie+tiers+valide sans justif

### 5.5 PDF fiche tiers
1. Générer PDF d'un tiers avec 3 ops dont 2 ont des justifs
2. Tableau historique : colonne "Justif." → 📎 1, 📎 2, —
3. Annexe : tableau récap (2 ops × leurs justifs)

### 5.6 Régression
- Transfert interne → pas de section justif (caché car type=sortie mais tiers=null → facultatif ; et badge transfert exclut)
- Entrée client → section justif visible mais facultative (sans bouton "obligatoire")
- Sortie sans tiers (frais bancaires) → section facultative
- Vagues 1, 2, 3.5 toujours fonctionnelles

---

## 5. Smoke SQL

```sql
-- 1) Structure de la table
SELECT column_name, data_type FROM information_schema.columns
  WHERE table_schema='public' AND table_name='justificatifs' ORDER BY ordinal_position;

-- 2) Trigger enregistré
SELECT tgname, tgrelid::regclass FROM pg_trigger
  WHERE tgname = 'tr_operations_justificatif_required';

-- 3) Bucket Storage créé
SELECT id, name, public, file_size_limit, allowed_mime_types
  FROM storage.buckets WHERE id = 'justificatifs';

-- 4) Tester le trigger (devrait échouer)
INSERT INTO operations (type, montant, libelle, caisse_id, categorie_id, tiers_id, statut, date_operation, exercice_id)
VALUES ('sortie', 1000, 'test', '<caisse_uuid>', '<cat_uuid>', '<tiers_uuid>', 'valide', CURRENT_DATE, '<exercice_uuid>');
-- Attendu : ERROR "Justificatif obligatoire pour sortie vers tiers"

-- 5) Compteurs des ops sans justif
SELECT COUNT(*) FROM operations o
  WHERE o.type='sortie' AND o.tiers_id IS NOT NULL AND o.statut='valide'
    AND NOT EXISTS (SELECT 1 FROM justificatifs j WHERE j.operation_id=o.id AND j.deleted_at IS NULL);
```

---

## 6. Points de vigilance

**Bucket Storage à créer manuellement** — La migration tente
`INSERT INTO storage.buckets` avec `ON CONFLICT DO UPDATE` (idempotent),
mais sur certains environnements Supabase la création de bucket via SQL
peut nécessiter les droits service_role. Vérifier que le bucket
`justificatifs` est bien présent dans le dashboard Supabase Storage
après application de la migration.

**Signed URLs TTL 60s** — Si l'utilisateur reste longtemps sur la page,
les URLs expirent. La carte JustificatifsCard re-fetch à chaque mount,
ce qui régénère naturellement les URLs. Pas de cache dans le browser.

**Pre-INSERT + rollback** — Le pattern d'upload utilise un INSERT
préalable avec `storage_path='pending'` pour générer l'id, puis UPDATE
avec le vrai path. Si le Storage upload échoue, on supprime la ligne
orpheline ET on tente de supprimer le fichier Storage (idempotent).

**Filtre `missing_proof`** — Pré-filtre SQL `type=sortie + tiers_id NOT
NULL + statut=valide`, puis post-filtre Node (retire les ops avec ≥ 1
justif). La pagination est approximative pour ce cas particulier
(`total = enriched.length`). Si volume > 1000 ops avec ce critère, à
optimiser via vue ou RPC.

**Soft delete = audit trail** — Les lignes `justificatifs` avec
`deleted_at IS NOT NULL` restent en BD, le fichier reste en Storage.
SYSCOHADA exige la conservation du document même après suppression
logique. Une purge éventuelle se ferait via un script de maintenance
manuel (hors scope V3).

**RLS table vs RLS Storage** — Les deux sont configurés en directeur
seul. Si on ajoute un rôle "comptable" plus tard, modifier les deux
policies en parallèle.

**Trigger UTF-8 + StrictMode** — Aucun fichier de cette livraison n'a
de risque encodage (créés via Write tool en UTF-8 par défaut) ni de
race condition (les hooks de Vague 3 sont stateless après mount).

---

## 7. Récap effort

| Étape | Effort estimé | Statut |
|--|--|--|
| Migration BD + bucket + policies | 1 h | livré |
| Routes API (4 + extension /operations + dashboard stats) | 2 h | livré |
| Composants (Uploader + Card + Viewer + MissingProofBanner) | 2 h | livré |
| Intégration formulaire (banner + désactivation Valider) | 1 h | livré |
| Intégration Écran 2 + fiche tiers + dashboard | 1 h | livré |
| PDF annexe + colonne Justif. tableau | 1 h | livré |
| **Total** | **8 h** | livré |

---

## 8. Prochaines étapes

- Smoke test Emmanuel selon protocole §4
- Si validation OK : Phase 4.2 (upload logo Boyah pour PDF) réutilise le
  pattern Supabase Storage de cette vague
- Phase 6 (anticipée par MissingProofBanner) : alerte plus poussée +
  workflow rappel email pour ops sans justif depuis > 7 jours
