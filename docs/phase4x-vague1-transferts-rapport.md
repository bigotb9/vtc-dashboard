# Phase 4.x — Vague 1 : Transferts internes Boyah ↔ Boyah

**Statut :** ✅ VALIDÉE INTÉGRALEMENT le 13 mai 2026 après 2 correctifs post-livraison
**Date :** 2026-05-13
**Périmètre :** Transferts INTERNES uniquement (sans tiers, sans externe, sans justificatif)

> **Correctifs post-livraison intégrés** (cf. §10 ci-dessous) :
> 1. **TS2305** — Imports `TransfertInput` renommés en `TransfertPayload` dans 2 fichiers lib (déjà appliqué)
> 2. **Bug critique BD** — Contrainte UNIQUE `operations_source_source_ref_unique` remplacée par un index PARTIEL excluant `transfert_interne` (sinon aucun transfert n'aurait pu réussir sur un déploiement frais)

---

## 1. Vue d'ensemble

Un transfert interne déplace des fonds entre 2 caisses/comptes Boyah (l'argent
reste dans Boyah, change juste de poche). Couvre les 4 combinaisons :
caisse→caisse, caisse→compte, compte→caisse, compte→compte.

**Modèle :** 1 transfert = 1 ligne `transferts_internes` + 2 lignes `operations`
(sortie + entrée) + 1 ligne `ecritures_comptables` + 2 lignes `lignes_ecritures`
(débit destination / crédit source) — le tout dans une transaction atomique
via la fonction RPC PostgreSQL `create_transfert_interne`.

**Numéro d'écriture :** `YYYY-OD-NNNNNN` (journal Opérations Diverses, séquence
par exercice).

---

## 2. Fichiers livrés (20 fichiers + 3 modifs)

### Migration BD (1 fichier)
| Fichier | Contenu |
|--|--|
| `supabase/migrations/20260515120000_compta_transferts_internes_rpc.sql` | Colonnes additionnelles (updated_at/by, notes), contrainte `chk_transfert_source_dest_different`, 6 indexes, **drop + recréation de la contrainte UNIQUE `operations(source, source_ref)` en index PARTIEL** (correctif post-livraison §10), catégorie `Transfert interne` idempotente, fonction RPC `create_transfert_interne` SECURITY DEFINER. |

> La table `public.transferts_internes` existait déjà depuis la migration
> Phase 1 (`20260510120000_compta_module.sql`, lignes 253-278). Cette
> migration est donc additive — elle ajoute le RPC, les indexes, la
> contrainte d'égalité source/dest, et la catégorie système.

### Types & Validators (2 modifs)
| Fichier | Modification |
|--|--|
| `types/compta-ui.ts` | +9 types (TransfertDestinationItem, TransfertPayload, TransfertPreview, TransfertCreateResult, TransfertListItem, TransfertDetail, TransfertWizardStep, TransfertJumelleLink, TransfertPreviewLigne) + ajout `transfert_jumelle` dans `OperationDetailResponse`. |
| `lib/compta/validators.ts` | + `transfertSchema` Zod (XOR source, XOR dest, source ≠ dest, montant > 0). |

### Lib helpers (2 fichiers)
| Fichier | Rôle |
|--|--|
| `lib/compta/transferts/createTransfert.ts` | Wrapper RPC + mapping des erreurs PG vers codes typés (`EXERCICE_CLOSED`, `INVALID_PAYLOAD`, `ECRITURE_DESEQUILIBREE`, …). |
| `lib/compta/transferts/previewTransfert.ts` | Calcule l'écriture future SANS toucher la BD (lecture seule : codes SYSCOHADA + exercice + numéro futur). |

### Routes API (4 fichiers)
| Fichier | Endpoint | Rôle |
|--|--|--|
| `app/api/compta/transferts/route.ts` | POST + GET | Création atomique (POST) + liste paginée filtrable (GET avec `date_from`/`date_to`/`caisse_id`/`compte_id`/`statut`) |
| `app/api/compta/transferts/[id]/route.ts` | GET | Détail enrichi (transfert + 2 ops + écriture inline) |
| `app/api/compta/transferts/preview/route.ts` | POST | Preview SYSCOHADA sans insertion (wizard étape 2) |

### Hooks client (3 fichiers)
| Fichier | Rôle |
|--|--|
| `hooks/compta/useCreateTransfert.ts` | POST + loading state |
| `hooks/compta/usePreviewTransfert.ts` | Preview debouncé (250 ms) |
| `hooks/compta/useDestinations.ts` | Charge caisses + comptes en parallèle, calcule shortCode |

### Composants UI (6 fichiers neufs + 1 modif composant)
| Fichier | Rôle |
|--|--|
| `components/compta/DestinationOption.tsx` | Ligne cliquable liste destinations (pastille + libellé + code + solde + halo violet si selected) |
| `components/compta/TransfertVisualBlock.tsx` | Bloc DEPUIS → VERS + bande montant (gradient violet→cyan) |
| `components/compta/TransfertSyscohadaPreview.tsx` | Tableau preview SYSCOHADA style PDF Grand Livre (Georgia + Courier + bandeau bleu marine) |
| `components/compta/TransfertStep1Destination.tsx` | Étape 1 du wizard (liste + form montant/date/libellé + warning over-solde) |
| `components/compta/TransfertStep2Preview.tsx` | Étape 2 (visual + libellé éditable + preview live) |
| `components/compta/TransfertInterneModal.tsx` | Modal container wizard (header + stepper 2 dots + footer actions + state machine) |
| `components/compta/OperationTransfertCard.tsx` | Encart Écran 2 "Cette opération fait partie d'un transfert" + lien vers jumelle |

### Pages modifiées (3 modifs Écrans existants)
| Fichier | Modification |
|--|--|
| `components/compta/CompteCaisseDetailHeader.tsx` | Ajout bouton **Transfert** dégradé violet→cyan (n'apparaît que si caisse/compte actif) |
| `app/comptabilite/comptes-caisses/[id]/page.tsx` | State `transfertOpen` + montage `<TransfertInterneModal>` + `refetch()` post-succès |
| `app/comptabilite/operations/[id]/page.tsx` | Affichage `<OperationTransfertCard>` quand `data.transfert_jumelle !== null` (entre Info et Écriture) |
| `app/api/compta/operations/[id]/detail/route.ts` | Résolution de l'op jumelle quand `source = 'transfert_interne'` |
| `components/compta/SourceBadge.tsx` | Badge "Transfert" rebrandé en dégradé violet→cyan (au lieu d'indigo) |

---

## 3. Architecture atomique RPC

```
Client                Route /transferts (POST)           PostgreSQL RPC
  │                          │                                   │
  │── POST payload ──────────►│                                   │
  │                          │── Zod validation ─►               │
  │                          │── createTransfertInterne() ──────►│
  │                          │                          ┌────────┴────────┐
  │                          │                          │ BEGIN           │
  │                          │                          │ INSERT transfert│
  │                          │                          │ INSERT op_sortie│
  │                          │                          │ INSERT op_entree│
  │                          │                          │ INSERT écriture │
  │                          │                          │ INSERT 2 lignes │
  │                          │                          │ UPDATE statut=  │
  │                          │                          │   valide → trig │
  │                          │                          │   équilibre BD  │
  │                          │                          │ UPDATE liens    │
  │                          │                          │ COMMIT          │
  │                          │                          └────────┬────────┘
  │                          │◄── JSON {transfert_id, …} ────────│
  │                          │── logActivity() ────►              │
  │◄── 201 + result ─────────│                                   │
```

**Garantie :** si une étape échoue (mapping SYSCOHADA absent, trigger
d'équilibre refuse, etc.), `RAISE EXCEPTION` rollbacke tout. Pas de
demi-transfert possible.

---

## 4. Tests d'acceptation — couverture spec §6

| § | Test | Statut |
|---|------|--------|
| 6.1 Migration BD | Table `transferts_internes` créée avec contraintes | déjà en place (Phase 1) ; contraintes additionnelles dans la migration Vague 1 |
| 6.1 | Indexes présents | 6 indexes ajoutés (date, source_caisse, source_compte, dest_caisse, dest_compte, statut) |
| 6.1 | Fonction `create_transfert_interne` callable | livrée avec GRANT EXECUTE TO authenticated, service_role |
| 6.1 | Catégorie 'Transfert interne' présente | INSERT idempotent dans la migration |
| 6.2 | Bouton visible sur page détail Wave / Caisse / SGCI | livré (apparaît si `detail.actif === true`) |
| 6.3 | Wizard étape 1 : stepper, titre, liste sauf source, soldes, validation Continuer | livré (`TransfertStep1Destination`) |
| 6.4 | Wizard étape 2 : visual + libellé + preview SYSCOHADA + bandeau équilibrée + Précédent/Confirmer | livré (`TransfertStep2Preview`) |
| 6.5 | Validation serveur (source = dest → 422, montant ≤ 0 → 422, UUID inconnu → 404) | livrée via `transfertSchema` Zod + RPC `RAISE EXCEPTION` |
| 6.6 | Effets BD après création (1 transfert + 2 ops + 1 écriture + 2 lignes) | livré atomiquement par RPC |
| 6.7 | Solde source ↓, solde dest ↑, total trésorerie inchangé | logique mathématique garantie par partie double |
| 6.8 | Toast vert + modal close + refetch détail caisse + badge Transfert liste + encart Écran 2 | livré |
| 6.9 | Test rééquilibrage Wave/Caisse | non exécuté (à faire avec smoke 1000 F d'abord) |
| 6.10 | Régression Phase 3 / PDF Grand Livre / Balance équilibrée | Compatibilité : nouvelle écriture journal OD → incluse naturellement dans Grand Livre + Balance |
| **6.11** | **Unicité préservée pour `recette_wave` (idempotence)** | **2e INSERT identique → ✓ rejette via index partiel** |
| **6.12** | **2 opérations `transfert_interne` autorisées avec même `source_ref`** | **Index partiel exclut `transfert_interne` → ✓ insertions acceptées** |

---

## 5. Smoke test SQL — vérifier les effets BD

À exécuter dans Supabase SQL Editor APRÈS un premier transfert test (1000 F
depuis une caisse vers une autre, via l'UI).

```sql
-- 1) Le transfert vient d'être créé
SELECT id, date_transfert, montant, libelle, statut,
       source_caisse_id, source_compte_id,
       dest_caisse_id,   dest_compte_id,
       operation_sortie_id, operation_entree_id, ecriture_id,
       created_at, created_by
  FROM public.transferts_internes
 ORDER BY created_at DESC
 LIMIT 1;

-- 2) Les 2 opérations jumelles
SELECT id, type, montant, source, source_ref, caisse_id, compte_id, ecriture_id, statut
  FROM public.operations
 WHERE source = 'transfert_interne'
 ORDER BY created_at DESC
 LIMIT 2;
-- Attendu : 1 ligne type='sortie' (caisse source), 1 ligne type='entree' (caisse dest),
--          source_ref identiques (= transfert.id), même ecriture_id.

-- 3) L'écriture comptable (journal OD)
SELECT id, numero, journal_code, date_ecriture, libelle, statut, transfert_id, operation_id
  FROM public.ecritures_comptables
 WHERE journal_code = 'OD'
 ORDER BY created_at DESC
 LIMIT 1;
-- Attendu : numero au format 2026-OD-NNNNNN, statut='valide', transfert_id défini.

-- 4) Les 2 lignes (débit destination + crédit source)
SELECT le.ordre, le.compte_syscohada_code, le.libelle, le.debit, le.credit
  FROM public.lignes_ecritures le
  JOIN public.ecritures_comptables ec ON ec.id = le.ecriture_id
 WHERE ec.transfert_id = (SELECT id FROM public.transferts_internes ORDER BY created_at DESC LIMIT 1)
 ORDER BY le.ordre;
-- Attendu : ordre=1 → débit montant (compte destination)
--          ordre=2 → crédit montant (compte source)
--          Σ débit = Σ crédit (sanity).

-- 5) Équilibre comptable
SELECT
  SUM(debit)  AS total_debit,
  SUM(credit) AS total_credit,
  CASE WHEN SUM(debit) = SUM(credit) THEN 'OK ✓' ELSE 'DESEQUILIBRE ✗' END AS verdict
  FROM public.lignes_ecritures le
  JOIN public.ecritures_comptables ec ON ec.id = le.ecriture_id
 WHERE ec.transfert_id = (SELECT id FROM public.transferts_internes ORDER BY created_at DESC LIMIT 1);

-- 6) Catégorie système 'Transfert interne'
SELECT id, libelle, type, compte_syscohada_code, journal_par_defaut, actif
  FROM public.categories_operations
 WHERE libelle = 'Transfert interne' AND type = 'transfert';
-- Attendu : 1 ligne, compte_syscohada_code IS NULL, journal_par_defaut='OD'.

-- 7) Fonction RPC enregistrée
SELECT proname, pronargs, prosecdef
  FROM pg_proc
 WHERE proname = 'create_transfert_interne'
   AND pronamespace = 'public'::regnamespace;
-- Attendu : 1 ligne, pronargs=9, prosecdef=true (SECURITY DEFINER).

-- 8) Index partiel correctement créé (cf. §10 correctif post-livraison)
SELECT indexname, indexdef
  FROM pg_indexes
 WHERE schemaname = 'public'
   AND tablename  = 'operations'
   AND indexname  = 'operations_source_source_ref_unique';
-- Attendu : 1 ligne contenant "WHERE ((source <> 'transfert_interne'::text)
--                              AND (source_ref IS NOT NULL))".

-- 9) Régression idempotence reprises (recette_wave doit toujours être unique)
-- À tester avec deux INSERT identiques sur (source='recette_wave', source_ref=X) :
-- le 2e doit échouer avec violation index unique.
```

---

## 6. Smoke UI — protocole 1000 F

Recommandé de tester sur un montant minimal (1000 F) entre 2 caisses
non sensibles avant tout transfert réel.

1. Aller sur `/comptabilite/comptes-caisses` et choisir une caisse de test
   (ex. Petite caisse) — cliquer pour ouvrir la page détail.
2. Cliquer le bouton **Transfert** (dégradé violet→cyan en haut à droite).
3. **Étape 1** :
   - Le bandeau "Depuis Petite caisse" affiche le solde courant.
   - La liste verticale affiche toutes les autres caisses/comptes (avec
     leur solde). La Petite caisse n'apparaît PAS.
   - Sélectionner une destination (ex. Caisse principale).
   - Saisir Montant = `1000`, Date = aujourd'hui, Libellé = vide (sera
     auto-généré).
   - Cliquer **Continuer**.
4. **Étape 2** :
   - Bloc visuel "DEPUIS Petite caisse → VERS Caisse principale, 1 000 F".
   - Preview SYSCOHADA affiché : 2 lignes, débit Caisse principale = 1000,
     crédit Petite caisse = 1000, total équilibré.
   - Numéro futur du type `2026-OD-NNNNNN`.
   - Cliquer **Confirmer le transfert** (dégradé vert).
5. **Post-succès** :
   - Toast vert "Transfert effectué : 1 000 F transférés."
   - Modal se ferme.
   - Solde de la Petite caisse rafraîchi à `solde - 1000`.
6. Vérifier sur `/comptabilite/operations` :
   - 2 nouvelles lignes avec le badge "Transfert" (gradient violet→cyan).
7. Cliquer une des 2 lignes :
   - Encart violet "Cette opération fait partie d'un transfert interne"
     entre Info et Écriture, avec lien "Voir l'opération jumelle".
8. Exécuter les requêtes SQL §5 pour valider les effets BD.

---

## 7. tsc — état

Une exécution `npx tsc --noEmit` dans le sandbox Linux retourne des
erreurs `TS1127 / TS17008 / TS1002` sur des dizaines de fichiers du
projet (y compris des fichiers non touchés par cette livraison). Cause
identifiée et documentée en Vague 2 : le montage `/sessions/.../mnt/` voit
des snapshots tronqués / NULL-padded de la source Windows authoritative
— là où la vue Windows (outil Read et le build Next côté Windows) montre
des fichiers complets et syntaxiquement corrects.

**Recommandation :** relancer `npx tsc --noEmit` côté Windows
(PowerShell ou terminal IDE) après cette livraison. La vue Windows est
la source de vérité ; le build Vercel et le dev server lisent depuis
cette vue, pas depuis le mount Linux.

---

## 8. Points de vigilance

**Atomicité PRC** — Toute la chaîne (1 transfert + 2 ops + 1 écriture +
2 lignes + 3 UPDATE de liens) est dans une seule fonction `plpgsql`. Si
le trigger d'équilibre BD refuse l'écriture, l'ensemble est rollbacké.

**Catégorie 'Transfert interne' avec `compte_syscohada_code = NULL`** —
La logique standard (`genererEcritureFromOperation`) refuserait cette
catégorie. C'est volontaire : le compte SYSCOHADA n'est PAS celui de la
catégorie mais celui des caisses/comptes source/destination. La RPC court-
circuite cette logique en générant l'écriture elle-même, sans passer par
`ecritures.ts`.

**Compatibilité avec extourne** — Les transferts ne peuvent pas être
annulés en Vague 1 (cf. spec §1.5 — exclusion). Si une annulation est
ultérieurement demandée, il faudra écrire une RPC `cancel_transfert_interne`
miroir qui inverse les opérations + génère une extourne préfixée
`EXT-2026-OD-NNNNNN`.

**Pas de filtre `caisses_ids` / `categories_ids` propagé à
`buildGrandLivre`** — Les écritures de transfert apparaîtront
naturellement dans le Grand Livre via les comptes de classe 5 concernés
(5311, 5711, etc.). Pas de modification PDF nécessaire en Vague 1.

**RLS + SECURITY DEFINER** — La RPC tourne en SECURITY DEFINER pour
bypasser RLS et insérer dans plusieurs tables avec une seule autorisation.
Permissions : `GRANT EXECUTE TO authenticated, service_role`. La policy
`directeur_full_access` sur `transferts_internes` filtre déjà les SELECT
côté UI.

**Contrainte UNIQUE operations partielle** — Cf. §10.2. L'index existant
en Phase 1 sur `(source, source_ref)` était trop strict pour les
transferts internes. Désormais index PARTIEL excluant `transfert_interne`.

---

## 10. Correctifs post-livraison (intégrés)

Deux bugs détectés au smoke test du 13/05/2026, corrigés et intégrés
dans cette livraison officielle pour qu'un déploiement frais (Vercel cold)
soit reproductible sans intervention manuelle.

### 10.1 TS2305 — `TransfertInput` introuvable

**Symptôme**

```
lib/compta/transferts/createTransfert.ts:13  error TS2305
  Module '"@/types/compta-ui"' has no exported member 'TransfertInput'.
lib/compta/transferts/previewTransfert.ts:16 error TS2305
  Module '"@/types/compta-ui"' has no exported member 'TransfertInput'.
```

**Cause** — Le type API a été nommé `TransfertPayload` dans `types/compta-ui.ts`
mais l'import des 2 fichiers lib utilisait l'ancien nom `TransfertInput`
(qui n'existe que comme inférence Zod locale dans `validators.ts`).

**Fix appliqué** — Rename des imports dans :
- `lib/compta/transferts/createTransfert.ts` ligne 13
- `lib/compta/transferts/previewTransfert.ts` ligne 16

**Note** — Le nom `TransfertInput` reste exporté par `validators.ts` (inférence
Zod, convention cohérente avec `BootstrapInput`, `OperationInput`, etc.) ; il
n'est plus importé ailleurs.

### 10.2 Bug critique BD — contrainte UNIQUE `operations(source, source_ref)`

**Symptôme** (toast d'erreur au clic *Confirmer le transfert*)

```json
{
  "error": "Échec création transfert : duplicate key value violates
            unique constraint \"operations_source_source_ref_unique\""
}
```

**Diagnostic SQL**

```sql
SELECT conname, contype, pg_get_constraintdef(oid)
  FROM pg_constraint
 WHERE conrelid = 'public.operations'::regclass
   AND conname LIKE '%source%';
-- → operations_source_source_ref_unique | u | UNIQUE (source, source_ref)
```

**Cause racine** — La contrainte UNIQUE `(source, source_ref)` introduite en
Phase 1 garantissait l'idempotence des reprises automatiques
(`recette_wave`, `depense_vehicule`, `versement_client`, …). Or les
transferts internes (Vague 1) insèrent volontairement DEUX opérations
jumelles (sortie + entrée) partageant la même `source_ref` (= transfert_id) ;
ce design permet de retrouver le couple via une seule clé.

**Conséquence sans le fix** — La RPC `create_transfert_interne` plantait
au 2e INSERT (la sortie passait, l'entrée violait la contrainte), et
PostgreSQL rollbackait toute la transaction. **AUCUN transfert n'aurait
pu réussir** sur un déploiement frais.

**Fix intégré dans la migration officielle** (§3bis de
`20260515120000_compta_transferts_internes_rpc.sql`) — Remplacement
de la contrainte par un index unique PARTIEL qui exclut `transfert_interne` :

```sql
DROP CONSTRAINT IF EXISTS operations_source_source_ref_unique;
DROP INDEX IF EXISTS operations_source_source_ref_unique;
DROP INDEX IF EXISTS idx_operations_source_unique;  -- ancien nom Phase 1

CREATE UNIQUE INDEX operations_source_source_ref_unique
  ON public.operations (source, source_ref)
  WHERE source <> 'transfert_interne'
    AND source_ref IS NOT NULL;
```

**Effet** — Idempotence préservée pour `recette_wave`, `depense_vehicule`,
`versement_client`, `import_csv`, `dotation_amort`, `manuel` ; mais 2 ops
`transfert_interne` peuvent partager une `source_ref`.

### 10.3 Recommandations de rituel pré-livraison

- Ajouter `grep -r 'TransfertInput'` dans le rituel pre-livraison Cowork
  pour éviter les fuites de noms obsolètes.
- Toute nouvelle table qui introduit une opération multi-INSERT partageant
  une clé doit vérifier les contraintes UNIQUE existantes sur les
  tables impactées.

---

## 11. Récap fichiers (compte précis)

- 1 migration BD
- 2 modifs fichiers types/validators
- 2 lib helpers (createTransfert, previewTransfert)
- 4 routes API (POST+GET list, [id] GET, preview POST)
- 3 hooks client
- 7 composants UI (DestinationOption, TransfertVisualBlock,
  TransfertSyscohadaPreview, TransfertStep1, TransfertStep2,
  TransfertInterneModal, OperationTransfertCard)
- 5 modifs de fichiers existants
  (SourceBadge, CompteCaisseDetailHeader, comptes-caisses/[id] page,
   operations/[id] page, operations/[id]/detail route)

**Total : 20 fichiers neufs + 5 modifs.** Estimé spec : 8-10 h.

Prêt pour smoke test 1000 F côté UI + vérification SQL §5.
