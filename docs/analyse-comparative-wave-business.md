# Analyse comparative — Architecture caisses/comptes actuelle vs cible Wave Business

> **Mission** : rapport analytique sans implémentation. Comparer point par point
> le système actuel Fleet Boyah et le système cible avec intégration API Wave
> (10 points du rapport joint).
>
> **Méthode** : inventaire factuel du code existant (migrations, libs, routes,
> RLS), confrontation avec la cible, évaluation d'effort par bloc.
>
> Date : 18 mai 2026 · Auteur : Cowork · Statut : analyse uniquement.

---

## Sommaire

- [0. Inventaire de l'existant (référentiel)](#0-inventaire-de-lexistant-référentiel)
- [1. Principe fondateur — argent réel central](#1-principe-fondateur--argent-réel-central)
- [2. Architecture des caisses (3 types)](#2-architecture-des-caisses-3-types)
- [3. Flux des recettes](#3-flux-des-recettes)
- [4. Allocation des budgets](#4-allocation-des-budgets)
- [5. Gestion déléguée par caisse virtuelle](#5-gestion-déléguée-par-caisse-virtuelle)
- [6. Flux des dépenses](#6-flux-des-dépenses)
- [7. Double effet de chaque dépense](#7-double-effet-de-chaque-dépense)
- [8. Contrôle de solvabilité par enveloppe](#8-contrôle-de-solvabilité-par-enveloppe)
- [9. Réconciliation API Balance Wave](#9-réconciliation-api-balance-wave)
- [10. Résultat opérationnel cible](#10-résultat-opérationnel-cible)
- [Tableau récap modules](#tableau-récap-modules)
- [Estimation d'effort par bloc](#estimation-deffort-par-bloc)
- [Recommandation de priorisation (migration progressive)](#recommandation-de-priorisation-migration-progressive)

---

## 0. Inventaire de l'existant (référentiel)

Avant d'aborder les 10 points, voici la cartographie factuelle qui sert
d'ancrage à toute l'analyse.

### 0.1 Tables comptables (18 tables ; PostgreSQL Supabase)

| Table | Rôle | Migration de création |
|-------|------|------------------------|
| `caisses` | Caisses physiques (cash + mobile_money), `plafond` numérique, `compte_syscohada_code`, `responsable_id` | `20260510120000_compta_module.sql` (§6) |
| `comptes` | Comptes bancaires (banque, numero_compte, devise=XOF) | idem (§5) |
| `operations` | Mouvements d'argent (XOR compte/caisse, type entree/sortie, source CHECK 7 valeurs, statut brouillon/valide/annule) | idem (§8) |
| `ecritures_comptables` | Écritures double partie SYSCOHADA (numero, journal, exercice_id) | idem (§11) |
| `lignes_ecritures` | Détail des lignes débit/crédit | idem (§12) |
| `transferts_internes` | Transferts Boyah ↔ Boyah, XOR source/dest, génère 2 operations | idem (§9) |
| `categories_operations` | Recette/dépense/apport/transfert + mapping SYSCOHADA | idem (§7) |
| `tiers` | Clients / fournisseurs / salariés (compte 401/411/421 + suffixe) | `20260516120000_compta_module_tiers.sql` |
| `justificatifs` | PDF/JPG/PNG liés à `operations.id` | `20260517120000_compta_justificatifs.sql` |
| `comptes_syscohada` | Plan comptable + CHECK type (16 valeurs dont `technique` Phase 4.3) | `20260510120000_compta_module.sql` |
| `exercices` | Exercices comptables, statut ouvert/clos | `20260518121000_compta_exercices_v2.sql` |
| `bilan_mapping` | Mapping compte → poste Bilan | `20260518122000_compta_bilan_mapping.sql` |
| `etats_financiers_archives` | Archive PDF Bilan/CR/TFT/Notes/Dossier | `20260518123000_…` + Phase 4.3 |
| `societe_parametres` | Identité légale + logo + méthodes comptables | `20260518120000_compta_societe_parametres.sql` |
| `profiles` | Utilisateurs, `role TEXT` ∈ {`directeur`, `admin`, `dispatcher`} | tables Phase 0 |
| `parametres_module_compta` | Singleton config (bootstrap) | `20260510120000_compta_module.sql` |
| `recettes_wave` | **Table legacy** : import CSV Wave brut (clé `"Identifiant de transaction"`) | héritée Phase 1 |
| `depenses_vehicules` | **Table legacy** : dépenses véhicule, clé `id_depense BIGINT` | héritée Phase 1 |

### 0.2 Caisses bootstrap (fixtures Phase 1)

Définies dans `app/api/compta/bootstrap/route.ts` :

```
'Wave Boyah'                  · mobile_money · operateur=Wave        · 5311 · plafond 1 000 000
'Orange Money Boyah'          · mobile_money · operateur=Orange Money · 5312 · plafond 500 000
'MTN MoMo Boyah'              · mobile_money · operateur=MTN MoMo    · 5313 · plafond 500 000
'Caisse principale siège'     · cash                                 · 5711 · plafond 500 000
'Petite caisse opérationnelle'· cash                                 · 5712 · plafond 100 000
```

→ Pas de notion de **caisse virtuelle** ; toutes ont une "réalité" et un solde.

### 0.3 Sources d'opérations actuelles (CHECK contrainte)

```
source IN ('manuel', 'recette_wave', 'depense_vehicule', 'versement_client',
           'import_csv', 'transfert_interne', 'dotation_amort')
```

### 0.4 Profils utilisateurs / RLS

- `lib/profile.ts` : `UserRole = "directeur" | "admin" | "dispatcher"`.
- Toutes les policies RLS du module compta : `USING (public.is_directeur())`.
  Donc **seul le directeur** a aujourd'hui un accès complet aux tables compta.
  Le rôle "admin" du profil n'est pas exploité côté compta.
- Aucune RLS par caisse / par utilisateur granulaire.

### 0.5 Calcul de soldes (utilisé en lecture, jamais en garde-fou)

`lib/compta/soldes.ts` :
```
solde_courant = solde_initial + Σ(entree validée) − Σ(sortie validée)
```
- `getSoldeCompte(compteId, dateMax?)` et `getSoldeCaisse(caisseId, dateMax?)`.
- **Aucun appel** depuis `app/api/compta/operations/route.ts` pour bloquer un insert.

### 0.6 Wave aujourd'hui

- **Pas d'API Wave**, pas de webhook, pas de payout.
- Le mot "Wave" se retrouve dans :
  - `app/api/recettes/import/route.ts` : upsert CSV Wave dans `recettes_wave`
  - `app/api/compta/reprise/recettes-wave/route.ts` + `lib/compta/reprise.ts` :
    transforme les lignes `recettes_wave` en `operations` source='recette_wave'
  - `lib/compta/flow/computeStats.ts` : libellé "Recette Wave"
  - Bootstrap caisse "Wave Boyah" (operateur='Wave')
- **Aucun lien temps réel** entre Wave et Fleet Boyah. Le pipeline est :
  `Wave Business → CSV manuel → /recettes/import → recettes_wave → reprise → operations`.

### 0.7 Sync bidirectionnelle existante (Vague 3.6)

`supabase/migrations/20260517000000_sync_operations_to_legacy.sql` :
- Trigger AFTER INSERT/UPDATE/DELETE sur `operations`
- Sync uniquement `source='manuel'` → `recettes_wave` (clé `op_<uuid>`) ou
  `depenses_vehicules` (clé `id_depense`).
- Les opérations `source='recette_wave'` (issues de la reprise CSV) ne
  re-synchronisent pas — la table `recettes_wave` reste source of truth.

---

## 1. Principe fondateur — argent réel central

### 1.1 État actuel

- **Pas de notion d'argent réel "central"**. Chaque caisse / chaque compte
  bancaire a son `solde_initial` + ses opérations indépendantes.
- La caisse `Wave Boyah` (compte SYSCOHADA `5311`) est traitée comme une
  caisse mobile money classique, équivalente fonctionnellement à
  `Orange Money Boyah` ou `MTN MoMo Boyah`.
- Les autres caisses (cash, banque NSIA via table `comptes`) sont des **silos**
  indépendants côté Fleet Boyah ; le système ne sait pas que "tout l'argent
  est censé être sur Wave".

### 1.2 État cible

- Le **compte marchand Wave Business** = unique réservoir réel.
- Fleet Boyah devient la **comptabilité analytique** qui reflète + déclenche
  les mouvements de ce wallet.
- Toutes les autres caisses Fleet Boyah deviennent des miroirs (≈ 20 % des
  flux cash/NSIA) ou des enveloppes virtuelles (caisses budgétaires).

### 1.3 Écart

- **Aucune notion de "wallet central"** dans le schéma actuel. Toutes les
  caisses ont le même statut.
- Pas de mécanisme garantissant que `caisses.solde_courant['Wave Boyah'] ==
  Σ(toutes les caisses virtuelles)` (puisque les caisses virtuelles n'existent
  pas encore).

### 1.4 Compatibilité

- **Extension possible sans refonte** : ajout d'un champ `caisses.role`
  (enum `marchand_wave` | `virtuelle` | `manuelle`) + d'un `caisses.parent_id`
  pour les virtuelles. Le schéma existant accepte une nouvelle colonne sans
  casser les contraintes XOR `operation.compte_id|caisse_id`.

### 1.5 Risques & dépendances

- **Bilan SYSCOHADA Phase 4.2** : la caisse Wave marchand devra rester
  comptabilisée dans la classe 5 (Trésorerie-Actif). Les caisses virtuelles
  doivent être **exclues du Bilan** (sinon double-comptage). À traiter via
  `bilan_mapping` (poste neutre) ou via un compte SYSCOHADA `technique`
  comme on l'a fait pour le 891 en Phase 4.3.
- **Justificatifs (Vague 3)** : non impactés — ils restent liés à
  `operations.id` indépendamment du type de caisse.

---

## 2. Architecture des caisses (3 types)

### 2.1 État actuel

- Table `caisses` :
  ```sql
  type TEXT NOT NULL CHECK (type IN ('cash', 'mobile_money'))
  operateur TEXT     -- 'Wave', 'Orange Money', 'MTN', 'Moov'
  responsable_id UUID REFERENCES auth.users(id)
  plafond NUMERIC(18,2)  -- cap operateur, ex 1 000 000 F sur Wave
  ```
- Table `comptes` : banques (`banque`, `numero_compte`).
- **Aucune distinction** Wave-marchand / virtuelle / manuelle. Tout est
  une caisse "réelle" pour le système.
- `responsable_id` existe mais n'est utilisé que comme métadonnée
  (pas de RLS basée dessus).

### 2.2 État cible

3 types fonctionnels :
1. **Caisse Wave marchand** : miroir 1-pour-1 du wallet Wave Business
2. **Caisses virtuelles** : enveloppes budgétaires (Entretien, Carburant…)
   — sans argent réel, seulement un solde comptable qui contrôle les paiements
3. **Caisses manuelles** : espèces, NSIA — saisie déclarative (20 % des flux)

### 2.3 Écart

- Le `CHECK type IN ('cash', 'mobile_money')` doit être étendu (ou remplacé
  par un nouveau champ `role`) pour accepter 3 valeurs métier.
- Le concept de **caisse virtuelle** n'existe pas. Il faut :
  - soit créer une nouvelle table `caisses_virtuelles` (parent_id → `caisses`
    où la parent est la caisse Wave marchand)
  - soit ajouter `caisses.role` + `caisses.parent_caisse_id` (extension de
    la table existante)
- La 2e option est plus simple mais alourdit légèrement la table.

### 2.4 Compatibilité

- **Extension de schéma**, pas de refonte. Le code existant (calculs de
  solde, RLS, sync legacy) continuera de fonctionner sur les caisses
  marquées comme "manuelles" sans rien changer.
- Le mapping SYSCOHADA (`bilan_mapping`) devra être ajusté pour exclure les
  virtuelles de l'agrégat Bilan (sinon double-comptage).

### 2.5 Risques

- **Reprise / sync legacy** (Vague 3.6) : le trigger `sync_operations_to_legacy`
  ne gère que `source='manuel'`. Les opérations sur caisses virtuelles
  utiliseraient probablement une nouvelle source `'wave_payout'` ou
  `'budget_alloc'` → pas d'impact direct, mais à confirmer.
- **TFT (Phase 4.3)** : la réconciliation trésorerie utilise la classe 5x.
  Si les caisses virtuelles utilisent aussi classe 5x, le calcul du TFT
  est faussé. → Comptabiliser les virtuelles dans une **classe analytique
  hors classe 5** (ex 9x compte de gestion analytique SYSCOHADA), ou les
  retirer du périmètre `calculerTft.ts:tresorerie()`.

---

## 3. Flux des recettes

### 3.1 État actuel

- **Saisie manuelle** : `app/recettes/create/page.tsx` → POST
  `/api/recettes/create/route.ts` → INSERT dans `recettes_wave`
- **Import CSV** : `/api/recettes/import/route.ts` accepte un tableau JSON
  (parsé en client depuis CSV Wave) → upsert dans `recettes_wave` avec
  clé `"Identifiant de transaction"` (colonne FR).
- **Reprise** vers comptabilité (Phase 4.x) : `lib/compta/reprise.ts`
  → fonction `repriseRecettesWave` → INSERT `operations` source='recette_wave'
  + ecritures comptables associées (mode Avancé).
- **Sync inverse** (Vague 3.6) : trigger `sync_operations_to_legacy` ne
  touche pas `recettes_wave` si source≠'manuel'. Les recettes Wave restent
  pilotées par le CSV.

### 3.2 État cible

- Wave envoie un **webhook HTTPS** vers Fleet Boyah à chaque encaissement
  (chauffeur → marchand, ou client → marchand).
- Le webhook crée **directement** une `operation` source='recette_wave'
  sur la caisse Wave marchand, sans étape CSV.
- Plus de saisie manuelle, plus d'import CSV (sauf rattrapage historique).

### 3.3 Écart

- **Endpoint webhook à créer** : `POST /api/webhooks/wave/recette` —
  signature HMAC, idempotence par `transaction_id` Wave, mapping vers
  une opération.
- **Suppression progressive** de l'import CSV : on conserve
  `app/api/recettes/import` pendant la transition (historique + secours),
  mais on désactive son usage quotidien.
- **Catégorisation automatique** : le webhook doit déduire la catégorie
  (`versement_quotidien_chauffeur`, `paiement_client`, etc.) selon le
  numéro émetteur (matching tiers) ou le memo Wave.

### 3.4 Compatibilité

- **Réutilisation forte** : la table `operations` + `lib/compta/ecritures.ts`
  (`genererEcritureFromOperation`) gèrent déjà la création d'écriture
  comptable à partir d'une operation. Le webhook ne fait que pré-remplir
  les champs.
- La source `'recette_wave'` est déjà au CHECK contrainte → aucun changement
  de schéma nécessaire pour ce point précis.
- La page `/recettes/suivi` (complétude des versements chauffeurs) continue
  de fonctionner si on alimente `recettes_wave` en miroir du webhook
  (1 trigger en aval). Sinon, à refondre pour lire depuis `operations`.

### 3.5 Risques

- **Idempotence** : si Wave réémet le webhook (timeout), il faut empêcher
  le doublon. Solution : UNIQUE (source, reference_externe) — n'existe
  pas aujourd'hui dans `operations`.
- **Page `/recettes/suivi`** (Phase 1) : actuellement basée sur la jointure
  `recettes_wave` ↔ `attribution`. Refonte légère nécessaire OU sync
  inverse `operations → recettes_wave` (extension du trigger Vague 3.6).
- **Sync bidirectionnelle Vague 3.6** : le trigger n'est armé que pour
  `source='manuel'`. Il faut soit étendre soit accepter que les recettes
  webhook ne soient pas miroirées dans `recettes_wave` (à éclaircir avec
  les pages legacy `/recettes`).
- **Sécurité webhook** : aucune infra Fleet Boyah n'attend des webhooks
  signés aujourd'hui. À monter (HMAC, IP whitelist, retry).

---

## 4. Allocation des budgets

### 4.1 État actuel

- **Inexistant**. Aucune table `budgets`, `allocations`, `enveloppes`. Le
  champ `caisses.plafond` est un **cap operateur** (ex 1 M F autorisé par
  Wave par jour), pas un budget mensuel alloué.
- Pas de "pot commun" identifiable. Le solde de la caisse Wave Boyah est
  juste le solde courant calculé via opérations.

### 4.2 État cible

- L'administrateur **alloue** des budgets mensuels aux caisses virtuelles
  (`Entretien=300k`, `Carburant=500k`…).
- Cette allocation = **écriture comptable interne**, pas de mouvement Wave
  réel. C'est un déplacement de "monnaie analytique" du pot commun (Wave
  marchand) vers les enveloppes.
- Le pot commun reste visible = solde Wave marchand − Σ(enveloppes
  virtuelles allouées non consommées).

### 4.3 Écart

- **Nouvelle table** `budgets_alloues` (ou `allocations_caisses`) :
  - `caisse_virtuelle_id UUID FK caisses`
  - `montant NUMERIC`
  - `periode TEXT` (ex `'2026-05'`) ou `date_debut/date_fin`
  - `created_by`, `created_at`, `notes`
- **Nouvelle source d'opération** : `'allocation_budget'` à ajouter au
  CHECK constraint.
- **Concept "pot commun"** : à calculer en runtime (pas de table dédiée
  nécessaire).
- L'allocation génère un transfert interne (ou un pseudo-transfert
  comptable) entre `Wave Boyah` (compte 5311) et la caisse virtuelle (compte
  analytique 9x).

### 4.4 Compatibilité

- La table `transferts_internes` peut être réutilisée comme support de
  l'allocation, à condition d'ajouter un type de transfert
  (`type IN ('manuel', 'allocation_budget')`). Pour V1, c'est l'option
  la plus économe.
- Alternative : table dédiée `allocations_caisses` (plus propre car les
  budgets ont des champs spécifiques : période, projection, vs réel).
- **Le mécanisme d'écriture comptable** (`lib/compta/ecritures.ts`) accepte
  déjà des paires débit/crédit arbitraires → réutilisable tel quel.

### 4.5 Risques

- **Bilan / CR** : les allocations sont des mouvements analytiques internes
  qui ne doivent **pas** apparaître dans le Bilan ou le CR officiel. Il
  faut un compte technique (équivalent au 891 Phase 4.3) ou exclure
  explicitement la source `'allocation_budget'` de `calculerBilan` et
  `calculerCompteResultat`.
- **Notes annexes Phase 4.3** : la note 5 (variation capitaux propres)
  ne devrait pas être impactée tant que les comptes 10x/11x/13 ne sont
  pas touchés.
- **Sync legacy** : à priori non concernée — les allocations sont des
  écritures internes, ne créent pas de recettes_wave ni depenses_vehicules.

---

## 5. Gestion déléguée par caisse virtuelle

### 5.1 État actuel

- `lib/profile.ts` définit 3 rôles : `directeur`, `admin`, `dispatcher`.
- Toutes les RLS du module compta sont en `directeur_full_access` :
  ```sql
  CREATE POLICY directeur_full_access ON public.caisses
    FOR ALL USING (public.is_directeur());
  ```
- Le champ `caisses.responsable_id UUID REFERENCES auth.users(id)` existe
  mais **n'est jamais utilisé** comme garde-fou RLS — c'est juste une
  donnée descriptive.
- Aucun rôle "gestionnaire" n'existe ; pas de matrice de permissions par
  caisse.

### 5.2 État cible

- Nouveau rôle utilisateur **`gestionnaire`** (ou `responsable_caisse`).
- Chaque caisse virtuelle a un gestionnaire désigné qui peut :
  - voir son solde disponible
  - voir l'historique des dépenses de SA caisse
  - initier des paiements depuis SA caisse (sortie Wave payout)
- Pas d'accès aux autres caisses, ni aux écritures comptables, ni au
  Bilan/CR (réservés directeur).

### 5.3 Écart

- Ajouter `'gestionnaire'` dans le CHECK CONSTRAINT du champ
  `profiles.role` (ou enum si déclaré). Modifier `UserRole` dans
  `lib/profile.ts`.
- Ajouter une **table d'association** `caisse_gestionnaires` (UUID caisse,
  UUID user) si on accepte qu'un user puisse gérer plusieurs caisses.
  Sinon, réutiliser `caisses.responsable_id` (1 gestionnaire = 1 caisse).
- **RLS à refondre** pour les caisses virtuelles :
  ```sql
  CREATE POLICY gestionnaire_caisse_read ON public.caisses FOR SELECT
    USING (responsable_id = auth.uid() OR public.is_directeur());
  CREATE POLICY gestionnaire_caisse_ops ON public.operations FOR SELECT
    USING (caisse_id IN (SELECT id FROM caisses WHERE responsable_id = auth.uid())
           OR public.is_directeur());
  CREATE POLICY gestionnaire_caisse_initiate ON public.operations FOR INSERT
    USING (caisse_id IN (SELECT id FROM caisses WHERE responsable_id = auth.uid())
           AND type = 'sortie');   -- pas d'entrée manuelle
  ```
- **UI dédiée gestionnaire** : nouvelle page `/comptabilite/ma-caisse`
  scopée au profil connecté + masquage de la sidebar compta pour ce rôle.
- **Helper d'auth** : `lib/compta/auth.ts` (actuellement
  `requireDirecteurCompta`) → ajouter `requireGestionnaireCaisse(caisseId)`.

### 5.4 Compatibilité

- **Refonte modérée** : les RLS existantes sont toutes du type "directeur
  ou rien". Il faut ré-écrire 8-10 policies pour intégrer le pattern
  gestionnaire (les `directeur_full_access` restent, on AJOUTE des policies
  scopées).
- Le hook `useProfile()` (`hooks/useProfile.ts`) gère déjà une matrice de
  permissions (`role_permissions`). Le mécanisme est **étendable sans
  refonte**.
- La sidebar (`components/Sidebar.tsx`) doit être conditionnée sur
  `isGestionnaire` pour ne montrer que `/comptabilite/ma-caisse`.

### 5.5 Risques

- **Compatibilité backwards** : tout le code actuel des routes API compta
  utilise `requireDirecteurCompta` → reste compatible (la nouvelle policy
  s'ajoute, ne remplace pas).
- **Justificatifs (Vague 3)** : le gestionnaire devra pouvoir uploader des
  justificatifs sur SES dépenses → RLS sur table `justificatifs` à étendre
  au pattern gestionnaire.
- **États financiers (Phase 4.2/4.3)** : restent réservés directeur, donc
  pas d'impact.
- **Audit / `logActivity`** : les actions des gestionnaires doivent être
  loguées avec leur ID — `lib/logActivity.ts` accepte déjà `auth.user.id`,
  pas de modif.

---

## 6. Flux des dépenses

### 6.1 État actuel

- Saisie déclarative classique :
  - `/depenses/create` → INSERT dans `depenses_vehicules` (table legacy)
  - Sync vers `operations` via trigger Vague 3.6 (`sync_operations_to_legacy`)
    ou via la reprise comptable
- Le directeur **saisit** les dépenses passées : aucune notion de
  "demande" ni de pré-paiement.
- Aucun lien obligatoire avec la table `tiers` (Vague 2). Une dépense peut
  référencer un tiers via `operations.tiers_id` (Phase 4.x Vague 2), mais
  ce n'est pas requis.
- Aucun contrôle de solvabilité (cf. point 8).
- Aucun déclenchement de paiement réel — la dépense est juste enregistrée.

### 6.2 État cible

Le gestionnaire (ou directeur) initie une **demande de paiement** :
1. Choix d'un tiers **obligatoirement enregistré** dans `tiers`
2. Montant ≤ solde disponible de SA caisse virtuelle
3. Si montant > plafond unitaire de la caisse → demande de **validation
   administrateur**
4. Si tout OK : **payout API Wave** depuis le compte marchand vers le
   numéro Wave du tiers
5. Paiement réel et immédiat (pas d'écriture en attente)

### 6.3 Écart

- **Nouvelle table** `demandes_paiement` (ou statut intermédiaire dans
  `operations`) :
  - statut : `initiee` | `en_attente_admin` | `approuvee` | `echouee` |
    `executee`
  - lien obligatoire `tiers_id` (existant)
  - `payout_wave_id` (ID retourné par l'API Wave)
- **Validation administrateur** : workflow approval — pas de
  workflow_validation_actif aujourd'hui (le flag existe dans
  `parametres_module_compta.workflow_validation_actif` mais n'est pas
  exploité par le module compta).
- **Endpoint API Wave** : `POST https://api.wave.com/v1/payouts` (ou
  équivalent — à confirmer après validation Wave Business). Le sandbox
  doit avoir une clé API serveur, jamais exposée au client.
- **Numéro Wave du tiers** : la table `tiers` a `telephone TEXT` (Vague 2),
  réutilisable. À nettoyer en format E.164 (+225…).

### 6.4 Compatibilité

- **Plus d'extension que de refonte** : on greffe un workflow sur la table
  `operations` (statut `brouillon` → `initiee` → `executee`) sans casser
  les autres flux.
- Le système d'écritures comptables (`lib/compta/ecritures.ts`) accepte
  déjà la génération d'écritures sur opérations validées → pas de modif.
- **`requireDirecteurCompta`** ne suffit plus : il faut un middleware
  `requireGestionnaireOuDirecteur(caisseId)` (cf. point 5).

### 6.5 Risques

- **Workflow validation jamais utilisé** : le flag
  `parametres_module_compta.workflow_validation_actif` n'a aucune
  implémentation. Risque de friction si on l'active partiellement.
- **Justificatifs** : actuellement uploadés APRÈS la dépense (Vague 3).
  Avec Wave payout, la facture/reçu peut être uploadée AVANT (proof of
  intent) ou APRÈS (proof of payment) → à clarifier.
- **Échec payout API Wave** : différentes causes (solde Wave insuffisant
  côté marchand, KYC tiers manquant, blacklist). Il faut un statut
  `echouee` + retry manuel + alerte directeur.
- **TVA / Impôts** : les payouts Wave peuvent être soumis à frais
  (commission Wave). À comptabiliser séparément.

---

## 7. Double effet de chaque dépense

### 7.1 État actuel

- 1 dépense saisie produit :
  - 1 ligne `depenses_vehicules` (legacy)
  - 1 `operation` (source='manuel' ou 'depense_vehicule')
  - 1 `ecriture_comptable` + 2 `lignes_ecritures` (si mode Avancé)
- C'est déjà un "double effet" comptable (partie double SYSCOHADA), mais
  PAS de double effet "monétaire réel + virtuel" puisque les caisses
  virtuelles n'existent pas.

### 7.2 État cible

1 action gestionnaire = 4 effets simultanés :
1. **Sortie d'argent réelle** sur le compte marchand Wave (via API payout)
2. **Diminution du solde virtuel** de la caisse concernée
3. **Écriture comptable double partie SYSCOHADA** (existante)
4. **Traçabilité complète** (qui, quand, vers qui, pour quoi) — déjà
   couverte par `operations.created_by` + `tiers_id` + `libelle` +
   `justificatifs`

### 7.3 Écart

- Pour matérialiser l'effet (1) et (2) ensemble, l'écriture doit être
  **atomique** dans une transaction PostgreSQL :
  - DEBIT compte analytique caisse virtuelle (ex 9xxx)
  - CREDIT compte 5311 Wave marchand
  - LINK avec `payout_wave_id` (idempotence en cas de retry webhook
    confirmation)
- Si l'API Wave répond OK → INSERT operation + écriture
- Si l'API Wave KO → ROLLBACK, statut `echouee`, alerte
- → Pattern saga + circuit breaker. Pas trivial.

### 7.4 Compatibilité

- L'infra écriture comptable (`lib/compta/ecritures.ts:genererEcritureFromOperation`)
  produit déjà une écriture à partir d'une opération validée. **Réutilisable
  tel quel** pour le scénario nominal.
- Le scénario d'échec (rollback) nécessite un wrapper transactionnel
  Postgres → un `CREATE OR REPLACE FUNCTION execute_paiement_avec_payout`
  similaire à `create_transfert_interne` (Vague 1).

### 7.5 Risques

- **Atomicité réelle vs comptable** : Wave est un service externe. On ne
  peut pas garantir une vraie transaction ACID croisant base + API. Le
  pattern recommandé est **outbox** :
  1. INSERT operation statut `initiee` + écriture statut `brouillon`
  2. Appel API Wave payout
  3. Webhook confirmation Wave → UPDATE operation statut `executee`, écriture
     statut `valide`
- **Délai webhook** : si Wave met >5 s à confirmer, l'UI doit gérer le
  pending. → polling ou Server-Sent Events.

---

## 8. Contrôle de solvabilité par enveloppe

### 8.1 État actuel

- **Aucun contrôle**. `app/api/compta/operations/route.ts` POST n'appelle
  jamais `getSoldeCaisse` ou `getSoldeCompte`.
- La fonction `lib/compta/soldes.ts:getSoldeCaisse` existe mais n'est
  utilisée que par les routes GET pour AFFICHER les soldes.
- Le `caisses.plafond` est un cap operateur (ex 1 M F sur Wave) qui n'est
  vérifié nulle part programmatiquement.

### 8.2 État cible

- Une **caisse virtuelle dont le budget est consommé** refuse la nouvelle
  dépense, **même si le wallet Wave est largement approvisionné**.
- Le budget est un garde-fou par enveloppe, indépendant de la trésorerie
  globale Wave.

### 8.3 Écart

- Au `POST /api/compta/operations` (ou la nouvelle route
  `/api/paiements/initier`), avant tout INSERT, exécuter :
  ```typescript
  const solde = await getSoldeCaisse(caisseVirtuelleId)
  if (solde < montant) {
    return comptaError("SOLDE_INSUFFISANT", { solde, montant })
  }
  ```
- À doubler côté Postgres avec un **CHECK constraint ou trigger BEFORE
  INSERT** pour empêcher la race condition (deux paiements simultanés
  depuis la même caisse virtuelle).
- Plus subtil : si le compte Wave marchand global a un solde insuffisant
  (cas extrême), il faut aussi refuser → check `getSoldeCaisse(waveMarchandId)`.

### 8.4 Compatibilité

- `lib/compta/soldes.ts` est **déjà adapté** : `getSoldeCaisse` retourne
  `solde_initial + Σ entree − Σ sortie`. Le calcul incluera
  automatiquement les allocations (en tant qu'entrées source='allocation_budget')
  et les dépenses sortantes.
- Le passage du check de "lecture pour affichage" à "blocking pour
  insertion" est trivial.
- **Race conditions** : pour empêcher 2 gestionnaires de débiter la
  caisse virtuelle simultanément → trigger `BEFORE INSERT` ou un
  `SELECT FOR UPDATE` sur la caisse dans une transaction.

### 8.5 Risques

- **Performance** : `getSoldeCaisse` scanne toutes les `operations`
  validées de la caisse. Pour Boyah Group avec 50-200 ops/mois, c'est
  rapide ; à 10k ops/mois ce sera ~50 ms par check. Acceptable pour V1.
- **Cohérence** : si une op statut `executee` est annulée a posteriori,
  le solde se recalcule automatiquement (le check est `statut='valide'`).
- **Allocations passées** : si on alloue un budget pour mai, comment
  empêcher d'utiliser le budget de juin ? Le solde courant ne distingue
  pas — il faut peut-être un check supplémentaire "solde sur la période
  en cours". Phase 4.4 future.

---

## 9. Réconciliation API Balance Wave

### 9.1 État actuel

- **Aucune réconciliation automatique**. La cohérence Fleet Boyah ↔ Wave
  repose sur l'import CSV manuel + la reprise comptable.
- Le mot "réconciliation" n'apparaît qu'une fois dans le code :
  `lib/compta/etats-financiers/calculerTft.ts:ecart_reconciliation`. C'est
  une réconciliation TFT ↔ Bilan (cohérence interne SYSCOHADA), pas Wave.
- Pas de cron, pas de scheduled task.

### 9.2 État cible

Chaque nuit, Fleet Boyah interroge l'API Balance Wave pour vérifier :
- Toutes les transactions Wave du jour ont leur `operation` correspondante
  (rattrapage des webhooks ratés via `reference_externe`)
- Le solde de la caisse Wave marchand dans Fleet Boyah == solde réel du
  wallet Wave Business
- Tout écart déclenche une alerte administrateur.

### 9.3 Écart

- **Nouveau job cron** : Vercel Cron ou Supabase scheduled function.
  Fleet Boyah a déjà `mcp__scheduled-tasks__*` côté Cowork — l'équivalent
  côté Vercel est `app/api/cron/wave-reconciliation/route.ts` + entry
  `vercel.json` schedule.
- **Wrapper API Wave Balance** : `lib/compta/wave/getBalance.ts` +
  `lib/compta/wave/listTransactions.ts` (à créer).
- **Nouvelle table** `reconciliations_wave` :
  - `date_run TIMESTAMPTZ`
  - `solde_fleet NUMERIC` / `solde_wave NUMERIC` / `ecart NUMERIC`
  - `transactions_orphelines JSONB` (transactions Wave sans operation
    associée — pour rattrapage manuel)
  - `statut TEXT` ('ok', 'ecart_detecte', 'erreur_api')
- **Notifications** : SMS / Email / log activity à l'admin si écart > seuil.

### 9.4 Compatibilité

- **Nouvel ajout pur**, pas de refonte. Le job lit `operations` et écrit
  dans une nouvelle table `reconciliations_wave`.
- Si une transaction Wave est trouvée sans `operation` correspondante →
  le job peut auto-créer l'opération (rattrapage webhook) avec source
  `'recette_wave_recover'` (nouvelle source à ajouter au CHECK).

### 9.5 Risques

- **Clé API Wave** : à stocker côté serveur uniquement
  (`process.env.WAVE_API_KEY`), jamais dans le client. Cohérent avec le
  pattern `SUPABASE_SERVICE_ROLE_KEY`.
- **Rate limits Wave** : un job nocturne devrait tenir, mais si on appelle
  l'API Balance + List Transactions à chaque webhook (pour vérification),
  on dépasse vite. → Cron uniquement + cache en mémoire.
- **Historique de réconciliation** : conserver toutes les exécutions
  (audit) → la table `reconciliations_wave` peut grossir vite. Index sur
  `date_run DESC` + politique de purge après 12 mois.

---

## 10. Résultat opérationnel cible

### 10.1 État actuel

- 100 % déclaratif. Le directeur saisit chaque ligne (CSV import + saisies
  manuelles).
- 0 % automatique. Le seul automatisme est le trigger Vague 3.6 qui
  miroir `operations ↔ recettes_wave / depenses_vehicules` (utile mais
  ne crée pas de mouvement réel).
- 0 % exécutoire. Aucun paiement réel n'est déclenché depuis Fleet Boyah.

### 10.2 État cible

- 80 % des opérations automatiques (recettes webhook) ou exécutoires
  (dépenses payout API).
- 20 % restent déclaratives (cash, NSIA, ajustements manuels).
- Délégation contrôlée à des gestionnaires de caisse.
- Argent jamais dispersé sur des comptes secondaires.

### 10.3 Écart

C'est la résultante des 9 points précédents — pas de point spécifique à
implémenter ici, mais un objectif opérationnel à mesurer après livraison :
- KPI : % d'opérations source ∈ {`recette_wave`, `wave_payout`} vs `manuel`
- KPI : écart moyen de réconciliation
- KPI : temps moyen entre demande gestionnaire et paiement effectif

### 10.4 Compatibilité & Risques globaux

Cf. tableau récap ci-dessous.

---

## Tableau récap modules

Légende : ➕ Créer · ✏️ Modifier · 🔄 Refondre · ➖ Supprimer / déprécier

| Module | Action | Fichiers / tables impliqués |
|--------|--------|------------------------------|
| **M0** Schéma `caisses` : ajout `role` + `parent_caisse_id` + `actif_si_virtuelle` | ✏️ | Migration BD additive |
| **M1** Nouvelle table `caisses_virtuelles` OU extension `caisses` | ➕ ou ✏️ | Choix architectural ; recommandation : extension `caisses` |
| **M2** Plan SYSCOHADA : ajout comptes analytiques 9x pour caisses virtuelles | ➕ | `comptes_syscohada` (seed) + `bilan_mapping` (exclusion) |
| **M3** Nouvelle table `budgets_alloues` (allocation mensuelle) | ➕ | Migration + lib `allocations.ts` + UI directeur |
| **M4** Source d'opération `'allocation_budget'` ajoutée au CHECK | ✏️ | Migration ALTER constraint |
| **M5** Webhook Wave recette `/api/webhooks/wave/recette` | ➕ | Nouvelle route + signature HMAC + idempotence |
| **M6** Endpoint payout `/api/paiements/initier` | ➕ | Workflow + appel API Wave |
| **M7** Rôle utilisateur `'gestionnaire'` + table `caisse_gestionnaires` | ➕ ou ✏️ | `profiles.role` CHECK + nouvelles RLS |
| **M8** RLS scoped par caisse (lecture + insertion limitées au gestionnaire) | 🔄 | 8-10 policies à ajouter, anciennes conservées |
| **M9** Contrôle solvabilité au POST operation | ✏️ | `app/api/compta/operations/route.ts` + trigger BEFORE INSERT |
| **M10** UI gestionnaire `/comptabilite/ma-caisse` | ➕ | Nouvelle page + masquage sidebar conditionnel |
| **M11** Cron réconciliation nightly `/api/cron/wave-reconciliation` | ➕ | Nouvelle route + table `reconciliations_wave` + Vercel cron |
| **M12** Lib `lib/compta/wave/*` (client API Wave) | ➕ | Wrapper API + types |
| **M13** Import CSV Wave : déprécier (mode rattrapage uniquement) | ➖ | `/api/recettes/import` conservée mais signalée dépréciée |
| **M14** Sync legacy Vague 3.6 (`sync_operations_to_legacy`) : étendre aux sources Wave | ✏️ ou 🔄 | Trigger à étendre OU à figer pour conserver la cohérence pages `/recettes`,`/depenses` |
| **M15** Reprise `lib/compta/reprise.ts` : adapter pour les nouvelles sources | ✏️ | Ajouter `recette_wave_recover`, `wave_payout` |
| **M16** Bilan / CR / TFT : exclure caisses virtuelles + comptes 9x analytiques | ✏️ | `calculerBilan.ts` + `calculerTft.ts` + `bilan_mapping` (exclusions) |
| **M17** Notes annexes Phase 4.3 : pas d'impact direct | — | OK tel quel |
| **M18** Justificatifs Vague 3 : RLS à étendre au pattern gestionnaire | ✏️ | Policy `justificatifs` + storage RLS |
| **M19** Page `/recettes/suivi` : décider si on garde le pipeline CSV ou refonte sur `operations` | 🔄 ou ✏️ | Décision business |

---

## Estimation d'effort par bloc

| Bloc | Description | Effort (h) | Justification |
|------|-------------|-----------:|---------------|
| **Bloc A** | Schéma caisses virtuelles + plan compte 9x + migration | **6** | M0+M1+M2 — additif, design CHECK + seed |
| **Bloc B** | Allocations budgétaires (table + lib + UI directeur) | **8** | M3+M4 — table simple, UI 1 page, intégration TFT |
| **Bloc C** | Webhook Wave recette + signature + idempotence | **10** | M5 — sécurité critique, retries, catégorisation auto |
| **Bloc D** | Payout API Wave + workflow validation admin | **14** | M6 — saga, états, gestion d'erreurs, UI demande |
| **Bloc E** | Rôle gestionnaire + RLS scopées + UI dédiée | **12** | M7+M8+M10 — 10 policies + page complète + tests RLS |
| **Bloc F** | Contrôle solvabilité (app + trigger BD) | **4** | M9 — petit mais critique |
| **Bloc G** | Cron réconciliation nightly + alertes | **8** | M11+M12 — wrapper API + comparaison + notif |
| **Bloc H** | Adaptation Bilan / CR / TFT (exclusions analytiques) | **5** | M16 — ajout filtres dans 3 calculateurs |
| **Bloc I** | Sync legacy + reprise (extensions ou figement) | **6** | M14+M15 — décision + impl + tests régression |
| **Bloc J** | Page `/recettes/suivi` (selon décision) | **4 à 12** | M19 — fourchette large : 4h si on conserve recettes_wave en miroir via trigger, 12h si refonte sur `operations` |
| **Bloc K** | Justificatifs RLS gestionnaire | **3** | M18 — policy + storage RLS |
| **Bloc L** | Tests intégration end-to-end + smoke test Wave sandbox | **10** | Couverture cycle recette → payout → réco |
| **Bloc M** | Documentation + rapport + ADR (Architecture Decision Record) | **4** | Conventions Cowork (8) à appliquer |

**Total estimatif** : **94 à 102 h** (≈ 12-13 jours-homme).

Hypothèses :
- Aucune nouvelle dépendance npm majeure (uniquement le client API Wave,
  qu'on peut implémenter en `fetch` natif).
- API Wave Business validée et sandbox accessible (sinon ajouter 10-15 h
  de découverte / debug intégration).
- Pas de migration de données existantes (recettes_wave reste tel quel
  comme historique).

---

## Recommandation de priorisation (migration progressive)

Pas de **big bang**. Stratégie en **5 phases** (Vagues 4.4 à 4.8) qui chacune
livre de la valeur indépendamment et ne casse pas les vagues précédentes.

### Vague 4.4 — Fondations caisses virtuelles + budgets (≈ 14 h)
*Sans Wave API. Permet de tester le modèle de gestion budgétaire à blanc.*

- M0+M1+M2+M3+M4 : schéma 3 types de caisses + allocations
- Bilan/CR/TFT (M16) ajusté pour exclure les caisses virtuelles
- **Livrable** : le directeur peut créer des caisses virtuelles, leur
  allouer un budget, voir le pot commun, sans aucune intégration externe.
- **Gain immédiat** : visibilité analytique budgétaire, prépare le terrain.

### Vague 4.5 — Rôle gestionnaire + RLS + UI dédiée (≈ 15 h)
*Toujours sans Wave. Le contrôle de solvabilité s'arme.*

- M7+M8+M10+M9 : rôle, RLS, page gestionnaire, blocage solde insuffisant
- Bloc K (justificatifs gestionnaire)
- **Livrable** : un gestionnaire peut se connecter, voir SA caisse,
  proposer des dépenses (mode déclaratif, sans payout réel) qui se
  bloquent si solde < montant.
- **Gain** : test du modèle de délégation sans engagement Wave.

### Vague 4.6 — Webhook Wave recette + reconciliation read-only (≈ 18 h)
*Première intégration Wave. Read-only, pas de payout.*

- M5+M11+M12+M13 : webhook entrant + cron réco + déprécation CSV
- **Livrable** : les recettes Wave arrivent en temps réel dans Fleet
  Boyah ; chaque nuit, vérification automatique vs API Balance Wave.
- **Gain** : suppression des imports CSV manuels. Risque maîtrisé (pas
  d'écriture vers Wave).

### Vague 4.7 — Payout API Wave + workflow validation (≈ 17 h)
*Intégration write Wave. Le système devient exécutoire.*

- M6 + workflow validation admin + UI demande de paiement
- **Livrable** : le gestionnaire initie un paiement → API Wave →
  écriture comptable automatique.
- **Gain** : 80 % des opérations deviennent exécutoires.

### Vague 4.8 — Consolidation & dépréciation (≈ 12 h)
*Nettoyage post-migration.*

- M14+M15+M19 : décision finale sync legacy + refonte `/recettes/suivi`
- Bloc L (tests E2E) + Bloc M (docs ADR)
- **Livrable** : système final, documentation à jour, conventions
  Cowork (8) respectées.

---

### Pourquoi cet ordre ?

- **Risque croissant** : les vagues 4.4 et 4.5 sont 100 % internes Fleet
  Boyah, aucun appel externe. Réversibles à coût nul.
- **Wave entre par la lecture seule** : vague 4.6 prouve l'intégration
  webhook avant d'oser écrire (payout). Si Wave sandbox montre des
  surprises, on les découvre en lecture, pas en payant des fournisseurs.
- **Workflow gestionnaire avant payout** : la vague 4.5 met en place les
  garde-fous (solvabilité, RLS) avant que la vague 4.7 ne déclenche de
  vrais transferts d'argent.
- **Big bang évité** : à aucun moment on ne casse les pages `/recettes`,
  `/depenses`, le Bilan ou les états financiers. Chaque vague est livrable
  indépendamment et roulable en prod.

---

## Annexe — Dépendances avec les vagues déjà livrées

| Vague livrée | Impact potentiel | Mitigation |
|--------------|------------------|------------|
| **Vague 1 — Transferts internes** | La table `transferts_internes` peut servir de support pour les allocations budgétaires (M3). Option à arbitrer : extension vs table dédiée. | Recommandation : table dédiée `budgets_alloues`. |
| **Vague 2 — Tiers** | Les payouts Wave (M6) imposent un `tiers_id` non null + téléphone normalisé E.164. À renforcer dans le validator Zod. | Migration additive : trigger validation `tiers.telephone` en format Wave. |
| **Vague 3 — Justificatifs** | RLS sur `justificatifs` à étendre au pattern gestionnaire (M18). | Policies additives, code applicatif inchangé. |
| **Vague 3.5 — Refonte /depenses + /recettes** | Pages `/depenses/create` et `/recettes/create` peuvent rester en mode déclaratif pour les 20 % de flux hors Wave, mais perdent leur centralité. | Conserver, ajouter un nouveau parcours "Paiement Wave" parallèle. |
| **Vague 3.6 — Sync bidirectionnelle** | Le trigger `sync_operations_to_legacy` ne sait que faire de `source='manuel'`. Les nouvelles sources Wave (M5/M6) seront ignorées par défaut → cohérent. À documenter clairement (cf. M14). | Soit étendre le trigger, soit figer la sync legacy comme historique read-only. |
| **Phase 4.2 — Bilan + Compte de résultat** | `calculerBilan.ts` lit la classe 5 pour la trésorerie. Si les caisses virtuelles utilisent classe 9x, pas d'impact. Si elles utilisent classe 5 → exclure via `bilan_mapping`. | Recommandation : classe 9x analytique. |
| **Phase 4.3 — TFT + Notes + Dossier complet** | `calculerTft.ts:tresorerie()` somme 52+53+57−56. Aucun risque si les virtuelles ne sont pas dans ces classes. | Idem. |
| **Patch QR + URL courte** | Aucun impact. | — |

---

## Annexe — Conventions Cowork (rappel : doivent rester respectées pour toute future implémentation)

Les 8 conventions documentées dans `docs/CONVENTIONS-COWORK.md`
restent applicables :
1. UTF-8 sans BOM
2. React StrictMode safe (capture ref avant await)
3. Pas de `<button>` imbriqué
4. Pas de `overflow-hidden` sur popover
5. Typing `XxxInput` vs `XxxPayload`
6. Smoke test + `tsc --noEmit`
7. authFetch + FormData
8. `npm install` obligatoire pour nouvelles deps

Le client API Wave (M12) impliquera probablement un fetch natif sans nouvelle
dépendance, mais à confirmer après lecture de la doc Wave Business.

---

## Conclusion

**Le code actuel n'est pas un blocker** — la cible Wave Business se greffe
**majoritairement par extension** sur l'existant :
- Tables `operations`, `ecritures_comptables`, `tiers`, `transferts_internes`
  sont **réutilisables sans refonte**.
- `lib/compta/soldes.ts`, `lib/compta/ecritures.ts`,
  `lib/compta/parametres-societe`, `lib/compta/auth.ts` sont
  **extensibles** (matrice de permissions déjà câblée).

**Les seuls vrais points de refonte** :
1. RLS scoped par caisse (politique gestionnaire) — refonte de 8-10 policies.
2. Décision `recettes_wave` ↔ `operations` post-migration (Vague 4.8).

**Le risque le plus élevé** est l'**atomicité Wave ↔ comptable** (point 7),
qui nécessite un pattern outbox + webhook de confirmation. À discuter avec
l'équipe Wave Business avant le démarrage de la vague 4.7.

**Effort total** : ~94-102 h sur 5 vagues progressives. Chaque vague livre
de la valeur indépendamment. Pas de big bang.
