# Phase 4.x — Vague 2 : Module Tiers Boyah

**Statut :** livré, prêt pour validation
**Date :** 2026-05-13
**Périmètre :** Module Tiers complet (Fournisseurs, Salariés, Autres), cohabitation avec clients/chauffeurs

---

## 1. Vue d'ensemble

Création d'une table `tiers` dédiée pour centraliser fournisseurs, salariés et
autres contacts comptables. La table coexiste avec `clients` et `chauffeurs`
(décision : pas de fusion). Chaque tiers porte un code SYSCOHADA généré
automatiquement à partir du nom (initiales) et du type (parent 401/411/421/467).

**Spécificité technique** : la colonne `compte_syscohada_code` est une colonne
PostgreSQL `GENERATED ALWAYS AS` qui concatène `parent + "-" + suffix`. Un
index unique PARTIEL garantit l'unicité sur les tiers actifs uniquement,
laissant un tiers désactivé libérer son code. La RPC `create_tiers` retry
automatiquement sur collision (GA → GA1 → GA2 …, max 100 tentatives).

---

## 2. Fichiers livrés

### Migration BD (1 fichier)
| Fichier | Contenu |
|--|--|
| `supabase/migrations/20260516120000_compta_module_tiers.sql` | Table `tiers` + colonne générée + 7 indexes (dont GIN texte) + ALTER `operations` ADD `tiers_id` + RLS directeur + 3 fonctions PostgreSQL (`compta_unaccent_lite`, `generate_tiers_suffix`, `create_tiers` SECURITY DEFINER avec retry). |

### Types & Validators (2 modifs)
- `types/compta-ui.ts` : +13 types (`TiersType`, `TIERS_SYSCOHADA_PARENT`, `Tiers`, `TiersListItem`, `TiersListKpis`, `TiersFilters`, `TiersListResponse`, `TiersDetail`, `TiersOperationRow`, `TiersOperationsResponse`, `TiersPayload`, `TiersUpdatePayload`, `TiersCreateResult`, `SuggestSuffixResponse`, `TiersRef`) + ajout `tiers` dans `OperationDetail` + `tiers_id` dans `CreateOperationInput`.
- `lib/compta/validators.ts` : `tiersSchema`, `tiersUpdateSchema`, `tiers_id` ajouté à `operationUpdateSchema`.

### Lib helpers (3 fichiers)
| Fichier | Rôle |
|--|--|
| `lib/compta/tiers/createTiers.ts` | Wrapper RPC `create_tiers` + mapping erreurs (INVALID_PAYLOAD / CONFLICT / DB_ERROR). |
| `lib/compta/tiers/generateSuffix.ts` | `generateTiersSuffix` (init en Node, miroir SQL) + `suggestSuffixWithAvailability` (lecture des tiers actifs existants). |
| `lib/compta/exports/buildFicheTiers.ts` | Builder PDF — agrège tiers + historique opérations sur période. |

### Routes API (8 endpoints)
| Route | Méthode | Rôle |
|--|--|--|
| `/api/compta/tiers` | GET | Liste paginée + KPIs (filtres : type / q / actifs_only) |
| `/api/compta/tiers` | POST | Création atomique via RPC + `logActivity` |
| `/api/compta/tiers/[id]` | GET | Détail enrichi + KPIs |
| `/api/compta/tiers/[id]` | PATCH | Modification (nullify cohérent + recompute syscohada si type/suffix change) |
| `/api/compta/tiers/[id]/disable` | POST | Soft delete |
| `/api/compta/tiers/[id]/operations` | GET | Historique paginé |
| `/api/compta/tiers/suggest-suffix` | GET | Suggest live + alternatives si pris |
| `/api/compta/exports/tiers/[id]` | POST | PDF Puppeteer (réutilise template) |

### Hooks client (5 hooks)
- `useTiersList` — liste + KPIs avec filtres
- `useTiersDetail` — détail + 404
- `useTiersOperations` — historique paginé
- `useSuggestSuffix` — debouncé 250 ms
- `useCreateTiers` — POST + PATCH + disable

### Composants UI atomiques (9 fichiers)
- `TiersTypeBadge` (4 couleurs)
- `TiersHeader` (liste)
- `TiersKpis` (5 cards : Total / Clients / Fournisseurs / Salariés / Autres)
- `TiersFilters` (tabs + search debouncée + toggle actifs)
- `TiersTable` (5 colonnes + flux 2026)
- `TiersDetailHeader` (avatar initiales 2 lettres + meta + actions)
- `TiersDetailKpis` (4 cards : Opérations / Flux net / Dernière op / Solde courant)
- `TiersInfoCards` (Contact + Entreprise)
- `TiersOperationsTable` (historique avec sens E/S + liens vers détail op)

### Composants transactionnels (4 fichiers)
- `TiersForm` (4 sections : identité / entreprise collapsible / comptabilité avec suggest live / notes) — mode `create` + `edit`
- `TiersQuickCreateModal` (création compacte depuis le sélecteur)
- `TiersSelector` (combobox + recherche + bouton "+Nouveau tiers" + click-outside)
- `TiersDisableModal` (confirmation soft delete)

### Template PDF (1 fichier)
- `components/compta/pdf/FicheTiersTemplate.tsx` — Pure HTML string, palette Grand Livre (bleu marine #1F4E79, papier #FAFAF8, Georgia + Courier), en-tête société + bandeau identité + 2 blocs contact/entreprise + 4 KPIs + tableau historique signé + sous-totaux net.

### 4 pages (`app/comptabilite/tiers/`)
- `page.tsx` (liste avec URL state)
- `nouveau/page.tsx` (création)
- `[id]/page.tsx` (détail + désactivation modal + export PDF)
- `[id]/modifier/page.tsx` (édition)

### Modifs fichiers existants (5)
| Fichier | Modification |
|--|--|
| `components/Sidebar.tsx` | NavLink "Tiers" entre Catégories et Plan comptable (icône `Users`) |
| `app/comptabilite/operations/nouveau/page.tsx` | TiersSelector ajouté dans la section "Liens métier" (filtré par sens : entrée→client/autre, sortie→fournisseur/salarie/autre) + `tiers_id` propagé dans `buildInput` |
| `app/comptabilite/operations/[id]/page.tsx` | `TiersRetroactionCard` entre OperationTransfertCard et EcritureComptableCard |
| `app/api/compta/operations/[id]/route.ts` (PATCH) | Branche spéciale "tiers-only" qui bypass la restriction brouillon+manuel — permet la rétroaction sur ops validées/reprise |
| `app/api/compta/operations/[id]/detail/route.ts` | JOIN `tiers:tiers_id (id, nom, type, compte_syscohada_code, actif)` exposé dans `operation.tiers` |

### Composant additionnel
- `TiersRetroactionCard` — encart "Tiers lié" sur Écran 2 avec édition inline (lier / changer / délier).

**Total : 32 fichiers neufs + 5 modifs + 1 migration BD.** Estimé spec : 10-14h.

---

## 3. Logique métier critique — génération du suffixe SYSCOHADA

### Mapping type → parent
| Type | Parent SYSCOHADA |
|------|------------------|
| `client` | 411 |
| `fournisseur` | 401 |
| `salarie` | 421 |
| `autre` | 467 |

### Algorithme du suffixe (Node + PostgreSQL miroirs)
1. UPPER + unaccent
2. Strip civilités (`MME`, `MR`, `M.`, `MLLE`, `DR`, `PROF`)
3. Split alphanumériques
4. 1 mot → 2 premières lettres (`"Atta"` → `AT`)
5. ≥ 2 mots → initiale 1 + initiale 2 (`"Garage Atta"` → `GA`, `"Kouamé Yao Christ"` → `KY`)
6. Fallback `XX` si rien d'exploitable

### Retry sur collision (RPC `create_tiers`)
```
v_suffix_base := "GA"
WHILE v_attempt < 100 LOOP
  v_suffix_try := v_attempt = 0 ? "GA" : "GA" || attempt   -- GA, GA1, GA2, …
  TRY INSERT … compte_syscohada_suffix = v_suffix_try
    EXIT on success
  CATCH unique_violation
    v_attempt += 1
END LOOP
```
La colonne `compte_syscohada_code` est `GENERATED ALWAYS AS (parent || '-' || suffix)` STORED, indexée en partial unique `WHERE actif = true`.

---

## 4. Smoke test SQL — vérifier les effets BD

À exécuter dans Supabase SQL Editor après application de la migration et
quelques tests UI.

```sql
-- 1) Structure de la table
SELECT column_name, data_type, generation_expression, is_generated
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'tiers'
 ORDER BY ordinal_position;
-- Attendu : compte_syscohada_code → is_generated='ALWAYS'

-- 2) Fonctions enregistrées
SELECT proname, pronargs, prosecdef
  FROM pg_proc
 WHERE proname IN ('create_tiers', 'generate_tiers_suffix', 'compta_unaccent_lite')
   AND pronamespace = 'public'::regnamespace;
-- Attendu : 3 lignes, create_tiers prosecdef=true (SECURITY DEFINER).

-- 3) Test génération suffix sans collision (Garage Atta)
SELECT public.create_tiers(
  'Garage Atta Mécanique', 'fournisseur',
  '+225 07 12 34 56 78', 'contact@garage-atta.ci', 'Marcory Zone 4',
  'Garage Atta SARL', 'CI-ABJ-2024-A-9876', '9876543 X',
  NULL, NULL, auth.uid()
);
-- Attendu : { tiers_id, suffix_final: "GA", compte_syscohada_code: "401-GA" }

-- 4) Test collision : créer un 2e fournisseur "Garage Akli"
SELECT public.create_tiers(
  'Garage Akli', 'fournisseur',
  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, auth.uid()
);
-- Attendu : suffix_final="GA1" car GA est pris

-- 5) Désactiver le 1er et vérifier qu'un 3e peut récupérer "GA"
UPDATE public.tiers SET actif = false WHERE compte_syscohada_code = '401-GA';
SELECT public.create_tiers('Garage Aboubacar', 'fournisseur',
  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, auth.uid());
-- Attendu : suffix_final="GA" car le code est libre (l'index partiel ne le verrouille plus)

-- 6) ALTER operations.tiers_id
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'operations' AND column_name = 'tiers_id';
-- Attendu : 1 ligne, data_type='uuid', is_nullable='YES'

-- 7) Index partiel d'unicité
SELECT indexname, indexdef
  FROM pg_indexes
 WHERE schemaname = 'public' AND tablename = 'tiers'
   AND indexname = 'uq_tiers_syscohada_actif';
-- Attendu : indexdef contient "WHERE (actif = true)"

-- 8) Régression : générer le suffixe Node ↔ SQL doivent matcher
SELECT public.generate_tiers_suffix('Mme Lengue Vanessa');   -- attendu LV
SELECT public.generate_tiers_suffix('Kouamé Yao Christ');    -- attendu KY
SELECT public.generate_tiers_suffix('Atta');                  -- attendu AT
SELECT public.generate_tiers_suffix('');                       -- attendu XX
```

---

## 5. Smoke UI — protocole

1. **Sidebar** : vérifier que "Tiers" apparaît sous "Catégories".
2. **Liste vide** : `/comptabilite/tiers` → 5 KPIs à 0, table empty state, bouton "Nouveau tiers".
3. **Création Garage Atta** :
   - `/tiers/nouveau` → Type Fournisseur → Nom "Garage Atta Mécanique"
   - Suffixe suggéré "GA" (badge vert "disponible")
   - Compléter RCCM, contribuable
   - Cliquer "Créer" → redirect `/tiers/[uuid]` + toast `Tiers créé · 401-GA`
4. **Collision** : Créer "Garage Akli" → suffixe "GA" suggéré + bandeau ambre "pris, alt. GA1" → valider → SYSCOHADA = `401-GA1`.
5. **Liaison opération nouveau** :
   - `/comptabilite/operations/nouveau` → Sortie / Wave / 22 000 F / "Achat pneus"
   - Section Liens métier → TiersSelector → "+ Nouveau tiers" → modal compact → "Pneus Express Marcory"
   - Auto-sélection + valide opération
   - Vérifier en BD : `operations.tiers_id = <uuid>`
6. **Rétroaction Écran 2** :
   - Sur une opération existante validée avec `source = depense_vehicule`
   - Encart "Tiers lié" → "+ Lier un tiers" → choisir Garage Atta
   - Toast "Tiers lié" + encart affiche la pastille avec lien vers la fiche
7. **Fiche détail Garage Atta** :
   - L'opération apparaît dans l'historique
   - KPIs corrects (1 op, flux signé négatif si sortie)
8. **Export PDF** :
   - Bouton "Exporter PDF" → période année courante
   - Fichier téléchargé `fiche-tiers-garage-atta-mecanique-2026-01-01_to_2026-12-31.pdf`
   - Contenu : en-tête société + bandeau accent ambre + 4 KPIs + table historique
9. **Désactivation** :
   - Cliquer "Désactiver" → modal confirmation → tiers disparaît de la liste (toggle "Actifs uniquement" caché)
   - Toggle off → tiers réapparaît avec opacité réduite + badge "Désactivé"

---

## 6. Tests d'acceptation §7 (spec) — couverture

| § | Test | Statut |
|---|------|--------|
| 7.1 | Migration BD : table + GENERATED + colonne tiers_id + indexes + RPC | livré |
| 7.2 | Sidebar Tiers + 5 KPIs + tabs + recherche + bouton | livré |
| 7.3 | Création Garage Atta avec suggest "GA" disponible | livré |
| 7.4 | Collision Garage Akli → "GA1" | livré (logique retry RPC) |
| 7.5 | Fiche détail : avatar initiales + 4 KPIs + cards + boutons | livré |
| 7.6 | Création à la volée depuis Écran 4 → opération.tiers_id rempli | livré |
| 7.7 | Rétroaction manuelle sur Écran 2 → PATCH tiers-only | livré (route spéciale) |
| 7.8 | Export PDF avec période + sous-totaux | livré |
| 7.9 | Désactivation soft + masquage liste | livré |
| 7.10 | Modification (téléphone) + updated_at | livré |
| 7.11 | Régression Phase 3+4 + tsc 0 erreur | à valider côté Windows |

---

## 7. Points de vigilance

**Colonne `GENERATED ALWAYS AS`** — La concaténation `parent-suffix` est gérée
par PostgreSQL. Toute tentative d'INSERT/UPDATE direct sur `compte_syscohada_code`
échoue (erreur PG). Toujours passer par `compte_syscohada_parent` +
`compte_syscohada_suffix`.

**Index unique PARTIEL** — Seuls les tiers actifs sont contraints. Un tiers
désactivé conserve son code mais libère le slot. Si on réactive un tiers dont
le code est désormais pris par un autre, l'UPDATE échouera avec `CONFLICT` — le
PATCH route le détecte et renvoie un message clair ("choisis un autre suffixe").

**RPC SECURITY DEFINER** — `create_tiers` tourne en SECURITY DEFINER pour
permettre l'INSERT depuis n'importe quel `authenticated` (sous réserve de
l'auth Bearer côté route). Permissions : `GRANT EXECUTE TO authenticated, service_role`.

**Génération suffix : duplication Node ↔ SQL** — La logique d'initiales existe
en double (TS + plpgsql). Source de vérité = PostgreSQL (RPC `create_tiers`).
La version TS dans `lib/compta/tiers/generateSuffix.ts` sert uniquement à la
prévisualisation `/suggest-suffix`. Toute évolution future doit être
synchronisée des deux côtés.

**PATCH tiers-only sur opérations validées** — La route `/operations/[id]`
PATCH détecte si le body contient UNIQUEMENT `tiers_id` (autres clés vides).
Dans ce cas, elle bypass la restriction "brouillon + manuel" et accepte la
modification sur n'importe quelle opération (validée, annulée, reprise auto).
Toute autre modification reste soumise aux restrictions standard.

**RetroactionCard sur opérations annulées** — Possible techniquement, mais
considérer le sens fonctionnel : un tiers lié à une opération annulée n'apparaît
pas dans son historique si la requête filtre `statut = valide`. À documenter
côté UI si jugé utile.

**Filtrage par sens dans TiersSelector** — `entree` → clients + autres ;
`sortie` → fournisseurs / salariés / autres. Strict pour éviter les
incohérences SYSCOHADA (un client en sortie produirait un 411 en crédit ce
qui est techniquement permis mais sémantiquement étrange).

**tsc** — Le mount Linux remonte de faux positifs documentés depuis la Vague 2
Phase 4 (snapshots tronqués / NULL bytes). À valider côté Windows.

---

## 8. Régression — compatibilité

- **Phase 1-3** : Aucune table existante n'est modifiée à part `operations` (ajout colonne nullable `tiers_id`).
- **Vague 1 Transferts** : Le sélecteur de tiers exclut implicitement les ops
  `transfert_interne` (le formulaire `/operations/nouveau` est utilisé pour
  saisie manuelle uniquement ; les ops jumelles transferts ne passent jamais
  par ce flux).
- **PDF Grand Livre / Balance** : Les nouveaux comptes `401-GA`, `411-LV` etc.
  apparaîtront naturellement dans les rapports (présents dans `lignes_ecritures.compte_syscohada_code`).
- **Health UI Écran 8** : Pas de check spécifique aux tiers. À ajouter en Phase 5
  si besoin (ex. tiers actifs sans opération sur l'année).

---

## 9. Prochaine étape

Vague 3 : Transferts EXTERNES vers tiers + upload de justificatifs (Storage
Supabase + lien `pieces_justificatives.transfert_id`). À aborder une fois la
Vague 2 validée côté UI/UX par Emmanuel.
