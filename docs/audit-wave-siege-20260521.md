# Audit isolé — Caisse Wave Boyah + Caisse principale siège

**Date** : 21 mai 2026
**Périmètre** : 9 février 2026 → 21 mai 2026
**Auteur** : Cowork (lecture seule, schéma `audit_20260521` non créé — toutes les analyses faites hors BD sur CSV exportés)
**Statut** : analyse uniquement, aucune correction proposée

---

## Avertissement préalable

Cet audit est un instantané. Aucune écriture n'a été effectuée sur Fleet Boyah. Le rapport sert de base de discussion pour décider d'une trajectoire A (appliquer correctifs) ou B (rejet, repartir des soldes physiques).

Le rôle PostgreSQL `audit_readonly_20260521` a été créé puis supprimé proprement.

---

## Livrable 1 — Reconstitution des soldes

### Tableau de synthèse

| Caisse | Solde affiché brief | Recalc opérationnel | Recalc comptable SYSCOHADA | Écart op/affiché | Écart compta/op |
|---|---:|---:|---:|---:|---:|
| **Caisse principale siège** | **−1 339 200 F** | **−1 339 200 F** | **−1 339 200 F** | **0 F** | **0 F** |
| **Wave Boyah** | **−1 976 000 F** | **+887 558 F** | **+887 558 F** | **+2 863 558 F** | **0 F** |

### Lecture du tableau

- **Caisse principale siège** : cohérence parfaite entre les 3 vues. Le `−1 339 200 F` est le vrai état Fleet. La cible (180 000 F cash physique) implique **+1 519 200 F d'entrées manquantes** OU **39 sorties sur-comptées**.
- **Wave Boyah** : la vue opérationnelle et la vue comptable concordent parfaitement (+887 558 F), mais ne correspondent **pas** au solde affiché −1 976 000 F dans le brief. Cet écart de 2 863 558 F suggère que le brief utilisateur a lu le solde sur un snapshot différent (ou un autre calcul que `getSoldeCaisse` standard de `lib/compta/soldes.ts`). Zone d'incertitude — à clarifier avec Emmanuel.

### Détail des flux

**Caisse principale siège** (id `f94e664c-22eb-440b-95b3-00eaad46b19b`, compte 5711) :
- 1 entrée valide : 1 000 F (transfert Petite caisse → Siège du 13/05)
- 39 sorties valides : 1 340 200 F
- Aucune entrée tracée provenant de Wave, NSIA ou cash externe

**Wave Boyah** (id `5d42ee4c-a1ca-415b-bdf5-7484fc86e6d4`, compte 5311) :
- 471 entrées valides : 10 631 299 F dont :
  - 470 `recette_wave` : 10 531 299 F
  - 1 `transfert_interne` : 100 000 F (du Siège, 15/05)
- 8 sorties valides : 9 743 741 F dont :
  - 7 `versement_client` : 6 087 000 F
  - **1 `manuel` : 3 656 741 F** (ajustement manuel suspect — voir L4)

---

## Livrable 2 — Réconciliation Wave Boyah ↔ Fleet

### Comparaison `wave_fr` (548 lignes, source de vérité externe) vs Fleet

| Type de transaction (wave_fr) | Nb | Montant brut |
|---|---:|---:|
| `merchant_payment` (encaissements clients) | 473 | +10 645 970 F |
| `merchant_sweep` (sortie vers autre wallet) | 73 | **−12 227 838 F** |
| (vide / ouverture balance) | 2 | +961 809 F |
| **TOTAL net wave_fr** | 548 | **−620 059 F** |

### Match par `Identifiant de transaction` (wave_fr."Identifiant de transaction" ↔ operations.reference_externe)

| Catégorie | Nb |
|---|---:|
| IDs distincts dans wave_fr | 548 |
| IDs distincts dans Fleet (Wave Boyah) | 471 |
| **Match exact** (468 IDs, montants/dates concordent à 100%) | **468** |
| **Wave présent / Fleet absent** | **80** |
| **Fleet présent / Wave absent** | **3** |
| **Divergences sur les matches** (montant ou date différents) | **0** |

### Détail des 80 transactions Wave absentes de Fleet

| Type | Nb | Montant brut |
|---|---:|---:|
| `merchant_sweep` | 73 | **−12 227 838 F** |
| `merchant_payment` | 5 | +52 350 F |
| (ouverture balance) | 2 | +961 809 F |

### Détail des 3 opérations Fleet sans correspondance Wave externe

| Source | Type | Nb | Montant |
|---|---|---:|---:|
| `manuel` | sortie | 1 | 3 656 741 F (ajustement manuel — voir L4) |
| `recette_wave` | entrée | 2 | 43 580 F |
| `transfert_interne` | entrée | 1 | 100 000 F (transfert légitime Siège→Wave du 15/05) |

### Interprétation

- **0 divergence** sur les 468 matches : quand un ID Wave est présent des 2 côtés, montant et date concordent parfaitement → la sync recettes_wave fonctionne correctement quand elle s'exécute.
- **Tous les 73 merchant_sweep manquent côté Fleet** : la totalité des balayages automatiques Wave (−12,2 M F) n'est jamais redescendue dans `operations`.
- Les 2 ouvertures de balance Wave (961 809 F les 20/02 et 28/03) ne sont pas comptabilisées du tout.

---

## Livrable 3 — Décomposition mensuelle des écarts

### Caisse principale siège

| Mois | Nb entrées | Σ entrées | Nb sorties | Σ sorties | Net mois | Cumul |
|---|---:|---:|---:|---:|---:|---:|
| 2026-02 | 0 | 0 | 7 | 483 000 | −483 000 | −483 000 |
| 2026-03 | 0 | 0 | 0 | 0 | 0 | −483 000 |
| 2026-04 | 0 | 0 | 16 | 377 000 | −377 000 | −860 000 |
| 2026-05 | 1 | 1 000 | 16 | 480 200 | −479 200 | **−1 339 200** |

**Solde final théorique = solde affiché = −1 339 200 F ✓ (cohérence Fleet)**

Le décrochage est **continu** (pas de saut brutal sur un seul mois) :
- Février : 7 sorties (−483 K F) sans entrée correspondante
- Mars : aucun mouvement
- Avril : 16 sorties supplémentaires (−377 K F) sans entrée
- Mai : 16 sorties (−480 K F) + 1 entrée (1 000 F)

### Wave Boyah

| Mois | Nb entrées | Σ entrées | Nb sorties | Σ sorties | Net mois | Cumul Fleet |
|---|---:|---:|---:|---:|---:|---:|
| 2026-02 | 78 | 1 799 640 | 0 | 0 | +1 799 640 | +1 799 640 |
| 2026-03 | 117 | 2 593 739 | 3 | 2 700 000 | −106 261 | +1 693 379 |
| 2026-04 | 155 | 3 567 497 | 3 | 3 050 000 | +517 497 | +2 210 876 |
| 2026-05 | 121 | 2 670 423 | 2 | 3 993 741 | **−1 323 318** | **+887 558** |

**Solde final théorique Fleet = +887 558 F** (≠ −1 976 000 affiché brief = écart 2 863 558 F)

Le **décrochage majeur** est en **mai** (−1,32 M F net) dû à 2 sorties : ajustement manuel 3,66 M F + 337 K F de versements clients.

---

## Livrable 4 — Les 11 opérations test supprimées

### Pistes investiguées

| Piste | Résultat |
|---|---|
| `activity_logs` 20/05 18h → 21/05 14h | **0 log** — aucune suppression tracée |
| `activity_logs` actions `*delete*` sur toute la fenêtre | 4 actions (compta.compte/operation/categorie/caisse), toutes entre 10/05 et 12/05 (≠ matin 21/05) |
| Diff `recettes_wave_backup_20260515` vs `recettes_wave` actuel | **0 différence** (les 443 lignes du backup sont toujours présentes ; +28 lignes ajoutées entre 15/05 et 20/05 par sync auto) |
| Diff `depenses_vehicules_backup_20260515` vs `depenses_vehicules_bak_20260515` | **0 différence** (les 2 backups sont identiques, 36 lignes chacun, couvrant 19/02 → 13/05) |
| Opérations statut='annule' | **0** sur les 2 caisses → les 11 ops ont été **DELETE** (pas annulées) |
| `lignes_ecritures` orphelines (operation_id → op inexistante) | **1 trouvée** ⚠️ |
| Logs post 20/05 13:30 | **0** — silence total dans activity_logs ce matin |

### L'écriture orpheline trouvée

| Champ | Valeur |
|---|---|
| Numéro écriture | `2026-OD-000034` |
| Date | 2026-05-13 |
| Compte SYSCOHADA | 5711 (Caisse principale siège) |
| Libellé | « Transfert interne : Petite caisse opérationnelle → Caisse principale siège » |
| Débit | 1 000 F |
| Crédit | 0 |
| Statut | valide |
| `operation_id` (introuvable dans `operations`) | `33ebf363-8c45-42a0-9473-53f273aa275a` |

→ Cet UUID `33ebf363-...` correspond exactement au `operation_sortie_id` du transfert `3ec918bc-...` (Petite caisse → Siège du 13/05) **encore présent** dans `transferts_internes`.

**Conclusion L4** : au moins **1 des 11 ops supprimées** est l'opération de SORTIE du transfert Petite caisse → Siège du 13/05. La table `transferts_internes` référence toujours cette `operation_sortie_id` (FK cassée). L'opération d'entrée correspondante (`a4ec7b9f-...`) doit aussi être vérifiée → présente, j'ai checké : elle est dans operations.

**Limite de l'audit pour les 10 autres opérations** : aucun backup ne couvre la table `operations` directement (les 4 backups disponibles ne concernent que `recettes_wave` et `depenses_vehicules`). Sans backup `operations_*_20260515`, les 10 autres ops supprimées sont perdues côté Fleet. Activity_logs n'a pas tracé la suppression (silence total post 20/05 13:30).

---

## Livrable 5 — Transferts internes Wave → autres caisses

### Inventaire des 73 merchant_sweep Wave

| Métrique | Valeur |
|---|---|
| Nb total | 73 |
| Période | 2026-02-09 → 2026-05-19 |
| Montant brut total | **−12 227 838 F** |
| Montant net total | −12 227 838 F (0 F de frais — sweeps internes Wave) |
| Destinataires | **Tous vers "Yango Taxi Park Boyah Group"** (un seul nom de contrepartie) |
| Tracking dans `transferts_internes` | **0 / 73** (aucun matché) |
| Tracking dans `operations` (toute source) | **0 / 73** |

### Répartition mensuelle des sweeps non tracés

| Mois | Nb | Volume |
|---|---:|---:|
| 2026-02 | 6 | −1 501 500 F |
| 2026-03 | 11 | −4 070 809 F |
| 2026-04 | 24 | −3 728 771 F |
| 2026-05 | 32 | −2 926 758 F |

### Top 5 sweeps les plus gros (non tracés)

| ID transaction | Date | Montant | Destinataire |
|---|---|---:|---|
| `ms-23cpdff2g26r2` | 2026-03-05 | −1 500 000 F | Yango Taxi Park Boyah Group |
| `ms-23vg9ytj824hj` | 2026-03-28 | −981 809 F | Yango Taxi Park Boyah Group |
| `ms-23jfmks782smm` | 2026-03-14 | −800 000 F | Yango Taxi Park Boyah Group |
| `ms-24jy11mz826yw` | 2026-05-03 | −600 000 F | Yango Taxi Park Boyah Group |
| `ms-236znbvg02x7e` | 2026-02-24 | −520 000 F | Yango Taxi Park Boyah Group |

### Interprétation L5

Les sweeps Wave ne correspondent **pas** à des transferts vers des caisses Boyah identifiables (Siège, Petite caisse, NSIA, etc.) — ils vont **tous vers un autre wallet Wave dénommé "Yango Taxi Park Boyah Group"**. Sémantiquement, il s'agit probablement d'un balayage automatique des recettes Wave Boyah vers un compte agrégateur (peut-être celui qui collecte le CA Yango pour reversement aux partenaires ?).

**Aucune piste pour les 73 sweeps n'a été reportée côté Fleet**, ni comme operation sortie sur Wave Boyah, ni comme entrée sur une autre caisse, ni comme transfert interne. C'est la principale cause du décrochage Wave (en volume).

---

## Livrable 6 — Synthèse et hypothèses causes racines

### Diagnostic principal (4 lignes)

Le décrochage observé sur les 2 caisses ne provient pas d'un événement unique mais d'un **manque structurel de synchronisation** entre Wave Business et Fleet pour 2 types de flux : (1) **les 73 sweeps automatiques Wave→Yango Taxi Park** (−12,2 M F) non tracés, et (2) **1 ajustement manuel** de −3,66 M F passé sur Wave le 19/05 sans contrepartie d'entrée. Pour Caisse principale siège, c'est **l'absence quasi totale d'entrées** (1 seule entrée de 1 000 F sur 3 mois) qui crée mécaniquement le solde négatif à mesure que les sorties sont enregistrées.

### Causes racines identifiées

| # | Cause | Volume | Nb ops | Caisse impactée |
|---|---|---:|---:|---|
| **1** | **73 merchant_sweep Wave→Yango Taxi Park** non synchronisés en `operations` ni `transferts_internes` | **−12 227 838 F** | 73 | Wave Boyah (sortie manquante) |
| **2** | **Ajustement manuel** sur Wave Boyah du 19/05 (libellé « écart de reconstitution 01-05/2026 »), sortie sèche sans contrepartie | **−3 656 741 F** | 1 | Wave Boyah (sortie artificielle) |
| **3** | **Entrées manquantes sur Caisse principale siège** : 39 sorties documentées mais 1 seule entrée → 0 trace de cash entrant | **+1 519 200 F manquants** | 0 entrée | Caisse principale siège (gap) |
| **4** | **5 merchant_payment** Wave + **2 ouvertures balance** Wave non synchronisés | +52 350 F + +961 809 F | 7 | Wave Boyah (entrées manquantes mineures) |
| **5** | **Suppression non tracée des 11 ops test** ce matin (21/05) : aucune entrée dans `activity_logs`, FK cassée sur 1 ligne_ecriture orpheline `2026-OD-000034` (op `33ebf363-...` = sortie du transfert Petite caisse→Siège du 13/05) | inconnu (1 op identifiée ≈ 1 000 F) | 1 identifiée / 11 | les 2 |

### Zones d'incertitude (non tranchées en lecture seule)

1. **Solde Wave Boyah affiché −1 976 000 F ≠ recalc Fleet +887 558 F (écart 2,86 M F)** : le brief utilisateur affiche un solde que ni la vue opérationnelle, ni la vue comptable SYSCOHADA ne reproduisent. Possibilités : snapshot pris à un autre moment, autre méthode de calcul que `getSoldeCaisse()`, ou inclusion d'un type d'opération exclu par le filtre `statut='valide'`. **À clarifier avec Emmanuel** : d'où vient précisément le chiffre −1 976 000 F (capture d'écran, requête manuelle, page UI ?).

2. **10 ops sur 11 supprimées sont perdues** : aucun backup ne couvre la table `operations` directement. Sans dump anté-suppression, leur reconstitution est impossible en lecture seule. La trace orpheline (`2026-OD-000034`) ne donne qu'1 piste sur 11.

3. **Sémantique des sweeps Wave→Yango Taxi Park** : ces 12,2 M F partent vers un autre wallet (Yango Taxi Park). Faut-il les tracer comme (a) transferts internes entre 2 caisses Boyah si Yango Taxi Park est une caisse Boyah à créer, ou (b) sortie de fonds Boyah vers un partenaire externe (charge ou avance) ? La décision détermine l'écriture comptable cible.

4. **Solde Wave réel 19/05 12h57 = 0 F (cible)** : avec wave_fr = 473 paiements (+10,5 M F) − 73 sweeps (−12,2 M F) + 2 ouvertures (+0,96 M F) = **−0,72 M F**. Il y a déjà 0,72 M F d'écart dans `wave_fr` lui-même par rapport à la cible 0 F. Soit `wave_fr` est incomplet (1 ligne manque vs 548 brief), soit la convention "solde 0" intègre autre chose. Le `Solde` Wave en colonne 11 de `wave_fr` à la dernière ligne donne la valeur réelle mais je n'ai pas vérifié — à investiguer.

5. **Caisse principale siège : +1 519 200 F manquants en entrées** : si les sweeps Wave allaient effectivement (avant test) vers Siège en cash, alors `Yango Taxi Park Boyah Group` = Siège côté Boyah ? Improbable mais à infirmer/confirmer.

---

## Annexe SQL — Requêtes exécutées

Toutes les analyses ci-dessus ont été produites par des `SELECT` sur les CSV exportés depuis Supabase Studio puis ingérés dans DuckDB. Les scripts Python contenant les requêtes sont :

| Script | Livrable |
|---|---|
| `/sessions/eloquent-compassionate-pascal/mnt/outputs/audit-ingest.py` | Ingestion 11 CSV → DuckDB |
| `audit-l1-soldes.py` | Livrable 1 (3 vues de solde, par caisse) |
| `audit-l2-reconciliation.py` | Livrable 2 (matching wave_fr ↔ operations, divergences) |
| `audit-l3-l4-l5.py` | Livrables 3, 4, 5 (décomposition mensuelle, ops supprimées, sweeps) |
| `audit-l4-deep.py` | L4 détaillé (écriture orpheline, ajustement manuel) |

Tous ces scripts sont disponibles dans le dossier `outputs` Cowork et peuvent être rejoués sur les mêmes CSV pour reproduire les chiffres.

### Caisses ciblées

```
Caisse principale siège : id=f94e664c-22eb-440b-95b3-00eaad46b19b, compte=5711, solde_initial=0, date_solde_initial=2026-02-09
Wave Boyah              : id=5d42ee4c-a1ca-415b-bdf5-7484fc86e6d4, compte=5311, solde_initial=0, date_solde_initial=2026-02-09
```

### Requêtes SQL Supabase (read-only) ayant produit les CSV

```sql
-- caisses
SELECT * FROM caisses WHERE libelle IN ('Wave Boyah', 'Caisse principale siège');

-- operations (519 lignes après "No limit")
SELECT o.* FROM operations o
JOIN caisses c ON c.id = o.caisse_id
WHERE c.libelle IN ('Wave Boyah', 'Caisse principale siège')
  AND o.date_operation BETWEEN '2026-02-09' AND '2026-05-21'
ORDER BY o.date_operation, o.created_at;

-- lignes_ecritures (519 lignes)
SELECT le.*, ec.numero, ec.date_ecriture, ec.journal_code,
       ec.libelle AS ecriture_libelle, ec.statut AS ecriture_statut,
       ec.exercice_id, ec.operation_id, ec.transfert_id, ec.source_manuelle
FROM lignes_ecritures le
JOIN ecritures_comptables ec ON ec.id = le.ecriture_id
WHERE le.compte_syscohada_code IN ('5311', '5711')
  AND ec.date_ecriture BETWEEN '2026-02-09' AND '2026-05-21'
ORDER BY ec.date_ecriture, ec.numero, le.ordre;

-- transferts_internes (2 lignes)
SELECT ti.* FROM transferts_internes ti
WHERE ti.source_caisse_id IN (SELECT id FROM caisses WHERE libelle IN ('Wave Boyah','Caisse principale siège'))
   OR ti.dest_caisse_id   IN (SELECT id FROM caisses WHERE libelle IN ('Wave Boyah','Caisse principale siège'))
ORDER BY ti.date_transfert, ti.created_at;

-- wave_fr (548 lignes)
SELECT * FROM wave_fr ORDER BY "Horodatage";

-- recettes_wave (471 lignes sur la fenêtre)
SELECT * FROM recettes_wave WHERE "Horodatage" >= '2026-02-09' AND "Horodatage" < '2026-05-22'
ORDER BY "Horodatage";

-- activity_logs (155 lignes sur 9 fév → 21 mai 23:59)
SELECT * FROM activity_logs WHERE created_at BETWEEN '2026-02-09' AND '2026-05-21 23:59:59'
ORDER BY created_at;

-- backups (4 tables)
SELECT * FROM recettes_wave_backup_20260515;         -- 443 lignes
SELECT * FROM recettes_wave_bak_20260515;            -- 443 lignes (identiques au backup)
SELECT * FROM depenses_vehicules_backup_20260515;    -- 36 lignes
SELECT * FROM depenses_vehicules_bak_20260515;       -- 36 lignes (identiques au backup)
```

### Requêtes SQL (réplicables via Supabase Studio) pour validation indépendante

```sql
-- L1.1 : Recalc opérationnel Siège
SELECT COALESCE(SUM(CASE WHEN type='entree' AND statut='valide' THEN montant ELSE 0 END), 0)
     - COALESCE(SUM(CASE WHEN type='sortie' AND statut='valide' THEN montant ELSE 0 END), 0)
  AS solde_op_siege
FROM operations WHERE caisse_id = 'f94e664c-22eb-440b-95b3-00eaad46b19b';

-- L1.2 : Recalc comptable Siège
SELECT COALESCE(SUM(le.debit), 0) - COALESCE(SUM(le.credit), 0) AS solde_compta_siege
FROM lignes_ecritures le
JOIN ecritures_comptables ec ON ec.id = le.ecriture_id
WHERE le.compte_syscohada_code = '5711' AND ec.statut = 'valide';

-- L2 : sweeps non synchronisés (-12 227 838 F sur 73 transactions)
SELECT COUNT(*), SUM(CAST("Montant brut" AS BIGINT))
FROM wave_fr w
WHERE w."Type de transaction" = 'merchant_sweep'
  AND NOT EXISTS (
    SELECT 1 FROM operations o
    WHERE o.caisse_id = '5d42ee4c-a1ca-415b-bdf5-7484fc86e6d4'
      AND o.reference_externe = w."Identifiant de transaction"
  );

-- L4 : écriture orpheline (op supprimée)
SELECT le.* FROM lignes_ecritures le
WHERE le.compte_syscohada_code IN ('5311','5711')
  AND le.operation_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM operations o WHERE o.id = le.operation_id);

-- L5 : ajustement manuel suspect du 19/05
SELECT id, date_operation, montant, libelle, source, statut, created_at, created_by
FROM operations
WHERE caisse_id = '5d42ee4c-a1ca-415b-bdf5-7484fc86e6d4'
  AND source = 'manuel' AND type = 'sortie';
```

---

## Fin du rapport

**Aucune correction proposée.** Cet audit est une photo. Les trajectoires A/B (appliquer ou rejeter) restent à la décision d'Emmanuel.

**Recommandation neutre** : avant de prendre une décision, clarifier les 5 zones d'incertitude ci-dessus, notamment l'origine du solde affiché −1 976 000 F sur Wave Boyah qui ne correspond pas aux calculs Fleet (ni opérationnel, ni comptable).
