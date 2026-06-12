# AUDIT COMPLET — vtc-dashboard (Fleet · Boyah Group)

> **Périmètre** : Next.js 16.1.6 + React 19.2.3 + TypeScript strict + Supabase (projet `iixpsfsqyfnllggvsvfl`), déployé Vercel — `fleet.boyahgroup.com`.
> **Date** : 11 juin 2026 · **Type** : audit **READ-ONLY** (aucun fichier de code modifié, aucune migration, aucune écriture base).
> **Méthode** : cartographie (~111 routes API, 88 pages, 210 composants, 41 migrations SQL) → analyse parallèle par domaine → **vérification manuelle de chaque constat P0/P1** (lecture directe des fichiers, pas de confiance aveugle).
> **Vérification base (11/06/2026)** : contrôle **lecture seule** du schéma de production via le serveur MCP Supabase (`SELECT` sur le catalogue système uniquement : RLS, policies, fonctions, triggers, index, FK, buckets — aucune écriture). Les constats confirmés portent le marqueur **[VÉRIFIÉ EN BASE]**. Cette passe a **confirmé P0-1**, **infirmé P1-4**, et **révélé une dérive repo ↔ prod majeure** (cf. §2.5).
> **Objectif** : sécuriser et fiabiliser l'existant, puis le dériver en SaaS multi-tenant. **Aucune réécriture complète recommandée.**

---

## 1. Synthèse exécutive

L'application est **fonctionnellement mûre et, par endroits, exemplaire** (module Comptabilité SYSCOHADA : auth dédiée + Zod + double-partie soignée ; règle métier des loyers M-1 **correcte de bout en bout** ; marge consolidée avec **source de vérité unique** en TypeScript — pas de divergence SQL/front possible). Mais elle présente une **fracture de maturité nette** entre ce module récent et la couche « flotte » historique, qui concentre les risques.

Le problème dominant est la **sécurité d'accès aux données**, désormais **confirmé en base** : il n'existe **aucun middleware** d'authentification global, **plusieurs routes mutantes/destructives sont ouvertes** sans aucun contrôle, et surtout **RLS est désactivée sur 23 tables** (dont `clients`, `vehicules`, `chauffeurs`, `recettes_wave`, `depenses_vehicules`, `commandes_yango`) **[VÉRIFIÉ EN BASE]** — leurs policies sont donc inertes ; de plus **37 vues s'exécutent en `security_invoker` off** et contournent la RLS. La clé `anon` étant **publique**, tout le jeu de données opérationnel + la PII clients/chauffeurs est **lisible et modifiable en contournant la couche API**. Priorité absolue. La vérification a aussi révélé une **dérive repo ↔ prod majeure** (sous-système « app chauffeur » et FK présents en prod mais absents du repo, migrations non tracées — cf. §2.5).

Le reste (performance sans cache, quelques N+1, monolithes, absence de types Supabase générés) relève du durcissement et n'est pas bloquant à court terme.

### Notes par domaine

| Domaine | Note | Synthèse |
|---|---|---|
| **Sécurité** | **4 / 10** | Module compta solide, agent fail-closed ✅ — mais RLS inerte/absente sur la flotte, routes ouvertes, `service_role` partout sans filet. |
| **Architecture** | **7,5 / 10** | Découpage par domaine propre, intégrations bien isolées ; 2 monolithes, migration `*-v2` inachevée. |
| **Qualité code** | **7 / 10** | TS strict + `tsc` obligatoire, gestion d'erreurs API uniforme ; pas de types Supabase générés, aucun `error.tsx`. |
| **Base de données** | **7 / 10** | **[VÉRIFIÉ EN BASE]** FK + index présents en prod (au-delà du repo), triggers anti-récursion soignés, loyers M-1 corrects ; `handle_new_user` sans `search_path`, 1 numérotation à risque, **37 vues `security_invoker` off**, suivi de migrations quasi inexistant (dérive §2.5). |
| **Performance** | **6 / 10** | Pagination correcte, RPC Yango anti-504 ✅ ; **zéro cache**, agrégats compta en RAM, N+1 résiduels, dashboard tout-client. |
| **SaaS readiness** | **3,5 / 10** | Modularité fonctionnelle réelle + identité société déjà externalisée ; mais 0 `tenant_id`, `service_role` ×67, plan comptable & bot hardcodés. |

---

## 2. Constats détaillés (P0 → P3)

Convention : **P0** = critique sécurité/intégrité données · **P1** = grave · **P2** = moyen · **P3** = confort. Chaque constat = `fichier:ligne` · description · impact · correctif.

### 2.1 SÉCURITÉ

#### 🔴 P0-1 — RLS inerte ou absente sur les tables « flotte » → exposition totale via la clé `anon` publique **[VÉRIFIÉ EN BASE]**
- **Preuve** : les policies existent (`supabase/migrations/00000000000000_legacy_baseline.sql:2504` `authenticated_all_chauffeurs`, `:2505` `authenticated_all_clients`, `:2528` `authenticated_all_vehicules`, toutes `USING(true) WITH CHECK(true)`) **mais ces 3 tables n'apparaissent JAMAIS** dans le bloc `ENABLE ROW LEVEL SECURITY` (`legacy_baseline.sql:2474-2496`). En PostgreSQL, `CREATE POLICY` **n'active pas** RLS : sans `ENABLE`, **les policies sont ignorées**.
- De plus, ~17 tables métier n'ont **ni policy ni ENABLE** : `recettes_wave`, `depenses_vehicules`, `versement_attribution`, `commandes_yango`, `justifications_versement`, `jours_feries`, `entretiens`, `affectation_chauffeurs_vehicules`, `taches_suivi`, `versements_chauffeurs`, `chauffeurs_yango_snapshot`, `records_flotte`, `wave_fr`, `calendrier`, `alertes_envoyees`, `boyahbot_memory`… + `clients_documents` (`DISABLE` explicite, `20260523120200:51`) + `agent_*` (`DISABLE`, `migration-agent.sql:50-52`).
- **Impact** : la clé `NEXT_PUBLIC_SUPABASE_ANON_KEY` est **publique** (livrée au navigateur). Si l'état prod reflète les migrations, **n'importe qui** peut interroger directement `https://<projet>.supabase.co/rest/v1/clients?select=*` (idem `vehicules`, `chauffeurs`, `recettes_wave`…) et **lire/insérer/modifier/supprimer** : PII clients investisseurs + données financières, numéros de téléphone chauffeurs (`numero_wave`), recettes Wave brutes, dépenses, attributions, commandes Yango — **en contournant 100 % de la couche API et des permissions applicatives**. Fuite massive + altération/destruction de données.
- **Correctif** : **(1)** vérifier immédiatement l'état réel dans Supabase → Dashboard → Auth → Policies (un badge « RLS disabled » sur une table = faille active). **(2)** `ALTER TABLE … ENABLE ROW LEVEL SECURITY` sur **toutes** les tables `public`, puis définir des policies explicites (au minimum `auth.role() = 'authenticated'` pour un outil interne ; idéalement par `tenant_id`/propriétaire à terme). **(3)** Remplacer les policies `USING(true)` par des conditions réelles. **(4)** Auditer les GRANT par défaut des rôles `anon`/`authenticated`.
- **✅ CONFIRMÉ EN PRODUCTION [VÉRIFIÉ EN BASE]** (MCP, 11/06/2026) : **23 tables `public` ont `rls_enabled = false`** → `affectation_chauffeurs_vehicules`, `agent_analyses`, `agent_conversations`, `agent_memory`, `alertes_envoyees`, `boyahbot_memory`, `calendrier`, **`chauffeurs`** (1 policy inerte), `chauffeurs_yango_snapshot`, **`clients`** (1 policy inerte), `clients_documents`, `commandes_yango`, `depenses_vehicules`, `entretiens`, `jours_feries`, `justifications_versement`, **`recettes_wave`**, `records_flotte`, `taches_suivi`, **`vehicules`** (1 policy inerte), `versement_attribution`, `versements_chauffeurs`, `wave_fr`. Pour `chauffeurs`/`clients`/`vehicules`, la policy `authenticated_all_* USING(true)` **existe mais est inerte** (RLS off) — exactement comme prédit. **La faille est active** : la clé `anon` publique donne un accès lecture/écriture direct à toutes ces tables.
- **🔴 Aggravant [VÉRIFIÉ EN BASE]** : activer RLS ne suffira **pas** seul. Les **37 vues** `public` (`vue_recettes_vehicules`, `vue_ca_*`, `vue_profit_journalier`, `classement_chauffeurs`, `cout_reel_vehicule`…) sont **toutes `owner = postgres` avec `security_invoker` non activé** (`reloptions = null`) → elles s'exécutent avec les droits du créateur et **continueront de contourner la RLS** des tables sous-jacentes. Le correctif RLS doit donc **aussi** poser `ALTER VIEW … SET (security_invoker = on)` sur ces 37 vues (et auditer les `GRANT` `anon`/`authenticated`).

#### 🔴 P0-2 — Routes API mutantes/destructives sans aucune authentification (pas de middleware global)
- **Preuve** : **aucun `middleware.ts`** dans le projet (vérifié) → pas de garde d'auth transverse sur `/api`. Chaque route est seule responsable. Or plusieurs n'en ont aucune :
  - `app/api/recettes/attribution/route.ts:28` — `export async function POST()` **sans `req`, sans auth**, en `supabaseAdmin` (service_role) → **`:152` `delete().gte("jour_exploitation","1900-01-01")` supprime TOUTE la table `versement_attribution`** puis ré-insère. Un simple `curl -X POST` anonyme efface/recalcule toutes les attributions de recettes.
  - `app/api/vehicules/update/route.ts:4-15` — `PATCH` **sans auth**, `const { id, ...fields } = await req.json()` → `update(fields)` : **mass-assignment** (n'importe quel champ : `statut`, `sous_gestion`, `id_client`, `montant_recette_jour`…).
  - `app/api/chauffeurs/update/route.ts:4-15` — idem (mass-assignment sans auth).
  - `app/api/yango/create-driver/route.ts` & `create-car/route.ts` — `POST` sans auth, **proxy vers l'API Yango réelle avec les credentials partenaire** → création de chauffeurs/véhicules dans la flotte Yango de production par un tiers.
  - `app/api/yango/sync-orders/route.ts` — `POST` sans auth (seul le `GET` est gardé par `CRON_SECRET`) → déclenche une synchro massive.
  - `app/api/upload/route.ts:15` — `POST` sans auth, service_role, écrit dans des buckets **publics** (`vehicules`/`avatars`/`chauffeurs`) ; whitelist MIME+taille présente mais write ouvert (abus de stockage / hébergement de contenu).
- **Impact** : destruction de données (`attribution`), corruption silencieuse (mass-assignment), effets de bord sur un système tiers de production (Yango), DoS stockage.
- **Correctif** : ajouter `requirePermission(req, …)` (déjà disponible) en tête de **chaque** route mutante (`manage_recettes`, `edit_vehicle`, `edit_chauffeur`, `sync_orders`, `create_driver`…). Pour `attribution`, exiger au minimum `manage_recettes`. Idéalement, **un `middleware.ts` qui refuse par défaut** toute route `/api/*` non listée comme publique (fail-closed).

#### 🟠 P1-1 — Endpoints GET sensibles sans authentification
- **Preuve** : `app/api/vehicules/marge/route.ts:43` (marge nette par véhicule, service_role) ; `app/api/compta/bilan-cash-net/route.ts:153` (trésorerie consolidée, service_role) ; `app/api/completude/route.ts` (complétude versements) ; `app/api/justifications/route.ts` GET (montants attendus/reçus) ; `app/api/yango/{drivers,vehicles,orders}/route.ts` (données flotte Yango). Aucune n'appelle `requirePermission`.
- **Impact** : exposition de données financières/opérationnelles sensibles à tout client réseau, sans session.
- **Correctif** : `requirePermission(req, "view_finances_cockpit")` (marge, bilan-cash-net), `"view_fleet"`/`"view_reports"` (completude, justifications, yango/*).

#### 🟠 P1-2 — Validation d'entrée (Zod) limitée au seul module compta
- **Preuve** : `lib/compta/validators.ts` (`safeParse`) est utilisé par ~26 routes compta — **toutes les mutations compta sont validées**. Hors compta : **0 route** valide son body. `vehicules/update`/`chauffeurs/update` font du mass-assignment ; `recettes/import` (`POST`) upsert un tableau brut ; `recettes/create`, `yango/*`, `agent/process`, `boyah-transport/generate-post` consomment `await req.json()` sans schéma runtime (`as {…}` n'est qu'un cast TypeScript, effacé à l'exécution).
- **Impact** : écriture de champs arbitraires, types incohérents, corruption de données, surface d'injection applicative.
- **Correctif** : généraliser les schémas Zod (réutiliser le pattern `validators.ts`) aux routes hors-compta, en commençant par les `*/update` (whitelist explicite des champs modifiables).

#### 🟠 P1-3 — `service_role` (bypass RLS) dans ~67 routes API, sans filet
- **Preuve** : `lib/supabaseAdmin.ts` est importé par ~67 routes. Tant que RLS est la seule barrière théorique (cf. P0-1), `service_role` la contourne **par conception** : la sécurité repose **entièrement** sur la présence d'un `requirePermission` correct dans chaque handler. Les routes de P0-2/P1-1 montrent que ce n'est pas systématique.
- **Annexe — duplication** : `app/api/upload/route.ts:6-9` et `app/api/clients/versements/route.ts` recréent un client `createClient(SERVICE_ROLE)` inline au lieu d'importer le singleton `supabaseAdmin` → config divergente possible.
- **Impact** : toute route oubliée = accès total. Surface d'erreur maximale.
- **Correctif** : (court terme) revue exhaustive « chaque route service_role a-t-elle un `requirePermission` ? » ; (moyen terme) activer RLS partout (P0-1) pour disposer d'un second rempart, et réserver `service_role` aux opérations qui le nécessitent réellement.

#### 🟡 P2-1 — Policies RLS trop permissives (sur les tables où RLS est active)
- **Preuve** : `ai_insights` — `INSERT`+`SELECT` **`TO public`** (rôle `anon` inclus), `USING/CHECK(true)` (`legacy_baseline.sql`) ; `cockpit_todos` — CRUD complet `USING(true)` authenticated (`20260527140000:…`) ; `activity_logs` — `USING(true)/CHECK(true)` (tout authentifié lit **et insère** les logs d'audit → falsification possible) ; `profiles_select USING(true)` (tout authentifié lit tous les profils + rôles) ; `versements_clients` — `auth.role()='authenticated'` sans filtre propriétaire ni `WITH CHECK`.
- **Impact** : sur un outil mono-entreprise interne, l'exposition inter-utilisateurs est tolérable ; mais `ai_insights` ouvert à `anon` et `activity_logs` falsifiable sont des défauts réels, et **toutes** ces policies deviennent des failles d'isolation dès le passage multi-tenant.
- **Correctif** : retirer `TO public` d'`ai_insights` ; restreindre l'INSERT d'`activity_logs` au `service_role` ; préparer des policies par tenant.

#### 🟡 P2-2 — Buckets Storage publics non déclarés en migration
- **Preuve** : `vehicules`, `avatars`, `chauffeurs` utilisés en `getPublicUrl` (`app/api/upload/route.ts:53`) ne sont **pas** déclarés dans les migrations (créés à la main en Studio) → URLs publiques, énumérables. Les buckets compta (`pieces-comptables`, `justificatifs`, `logos`) sont eux **privés** + signed URL + policy `is_directeur()` ✅, et `clients-docs` est privé (signed URL 1h) ✅.
- **Impact** : photos véhicules/chauffeurs accessibles publiquement ; upload anonyme (cf. P0-2) alimente ces buckets publics.
- **Correctif** : déclarer ces buckets en migration, décider public/privé explicitement, et authentifier `upload`.

#### ℹ️ Cartographie du bypass « directeur » (by-design, à scoper pour le SaaS)
- Le bypass n'est **pas** un UUID hardcodé (le grep de `b9906ac7-…` dans le code = **0 occurrence** ; cet UUID est la *donnée* `profiles.id` du directeur, pas du code). Il est **basé sur le rôle** `role === "directeur"`, présent à 5 endroits cohérents :
  - `lib/profile.ts:68` (`getRolePermissions` → `Proxy` renvoyant `true` pour toute permission) ;
  - `lib/profile.ts:50` & `hooks/useProfile.ts:50` (`can()` côté client) ;
  - `lib/requirePermission.ts:40` (API) ;
  - `lib/compta/auth.ts:75` (API compta) ;
  - SQL `is_directeur()` (`legacy_baseline.sql`), utilisé par toutes les policies `directeur_full_access`.
- **Pour le SaaS** : ce superadmin est **global** (aucun rattachement tenant). En multi-tenant, il deviendrait un super-utilisateur cross-tenant — à transformer en « admin **du tenant** » (cf. §4).

### 2.2 BASE DE DONNÉES

#### ✅ P1-4 — RETIRÉ après vérification base (faux positif repo-only) **[VÉRIFIÉ EN BASE]**
- **Constat repo (faux)** : les migrations du repo ne déclarent pas de FK sur `operations.vehicule_id/client_id/chauffeur_id`.
- **Réalité prod [VÉRIFIÉ EN BASE]** : ces FK **existent**, avec exactement le comportement que je recommandais — `FOREIGN KEY (vehicule_id) REFERENCES vehicules(id_vehicule) ON DELETE SET NULL`, idem `client_id → clients(id)` et `chauffeur_id → chauffeurs(id_chauffeur)`. Le risque d'orphelins / marge faussée côté `operations` est donc **inexistant**. Elles ont été ajoutées **directement en prod** (hors migration → dérive §2.5).
- **Reste mineur (P3)** : `versements_chauffeurs` (table legacy, RLS off) reste sans FK ; `lignes_ecritures` ne porte pas de dimension véhicule/client (vérifié) — sans impact sur la marge.

#### 🟠 P1-5 — Numérotation d'écritures `COUNT(*)+1` (collision possible) dans `create_transfert_interne`
- **Preuve** : `supabase/migrations/20260515120000_compta_transferts_internes_rpc.sql:282` numérote via `COALESCE(COUNT(*),0)+1` sur le journal `OD`, alors que `generer_ecriture_pour_operation` (`20260526120000:120`) utilise correctement `MAX(seq)+1` + advisory lock. Les deux écrivent dans le **même** espace de numérotation OD.
- **Impact** : après une extourne/`DELETE` d'écriture, `COUNT(*)+1` peut **régénérer un numéro déjà pris** → violation de l'index UNIQUE → la RPC transfert échoue et rollback. Collision possible aussi entre les deux fonctions.
- **Correctif** : aligner `create_transfert_interne` sur le pattern `MAX(seq)+1` + `pg_advisory_xact_lock`.

#### 🟡 P2-3 — `handle_new_user` sans `search_path` + index d'expression manquant `commandes_yango` **[VÉRIFIÉ EN BASE]**
- **[VÉRIFIÉ EN BASE]** `handle_new_user()` est bien `SECURITY DEFINER` avec `proconfig = null` (**aucun `search_path`**) — la **seule** des 17 fonctions DEFINER dans ce cas ; toutes les autres (cascades, `create_transfert_interne`, `generer_ecriture_pour_operation`, `app_chauffeur_*`, `verify_*`…) fixent `search_path`. Risque d'escalade théorique.
- **[VÉRIFIÉ EN BASE]** Index réels de `commandes_yango` : `created_at` (×2, dont un **doublon**), `ended_at`, `status` — **aucun index sur l'expression `(timezone('UTC',created_at))::date`** utilisée par `boyah_commission_for_month`/`boyah_dashboard_stats`. (Gap réel mais limité : `boyah_dashboard_stats` fait de toute façon un full-scan all-time assumé.)
- **[VÉRIFIÉ EN BASE] — point initial corrigé** : la cible du `ON CONFLICT` **existe** (`operations_source_source_ref_unique` partiel `WHERE source <> 'transfert_interne' AND source_ref IS NOT NULL`) → la déduplication des cascades est **solide**, pas « par chance ». Reste un durcissement cosmétique (expliciter la cible).
- **Correctif** : `ALTER FUNCTION handle_new_user() SET search_path = public` ; `CREATE INDEX idx_commandes_yango_created_date ON commandes_yango (((timezone('UTC',created_at))::date))` ; supprimer les index doublons (cf. D-4 §2.5).

#### 🟢 P3-1 — `prevMonth` de l'agent en heure locale + débordement de fin de mois
- **Preuve** : `app/api/agent/process/route.ts:271` `new Date(new Date().setMonth(getMonth()-1))` : opère en heure locale et, exécuté un 31, déborde (avril n'a pas de 31). Le reste du code utilise `Date.UTC(y, m-1, 1)`.
- **Impact** : faible — ne sert qu'au « mois précédent » cité par BoyahBot, **pas** aux loyers/arriérés (qui passent par le ledger robuste). En bord de mois, l'agent pourrait citer le mauvais mois de référence.
- **Correctif** : `new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()-1, 1)).toISOString().slice(0,7)`.

#### ✅ Vérifié conforme — règle loyers M-1 & marge consolidée (points forts, pas des défauts)
- **Loyers M-1** : `lib/finance/loyerEcheance.ts:88-91` (`moisATraiter` renvoie bien M-1), `:58-81` (`getLoyerStatus` : retard seulement après le 10 de M+1, bornes UTC). Consommateurs alignés : `app/api/cockpit/finances/route.ts:71-122` (tout sur M-1), `lib/finance/getArriereLoyers.ts:354` (ne retient que `en_retard`), agent via le même ledger. **Aucun indicateur ne raisonne à tort sur le mois courant.**
- **Marge consolidée** : **une seule implémentation**, en TypeScript (`lib/finance/margeConsolidee.ts:344-345` : `marge_reelle = bloc1.marge + bloc2.resultat - bloc4.total` ; `total_consolide = marge_reelle + bloc3.commission`). Le SQL ne fournit que les briques (commission Yango via `boyah_commission_for_month`). **Divergence SQL/front structurellement impossible.** Anti-double-comptage vérifié (dépenses lues depuis `operations` seul, jamais `depenses_vehicules`).

### 2.3 ARCHITECTURE & QUALITÉ CODE

#### 🟠 P1-6 — Monolithes : route agent (1084 l.) et page recettes/create (839 l.)
- **Preuve** : `app/api/agent/process/route.ts` (1084 l.) mêle `SYSTEM_PROMPT` (~110 l.), `classifyIntent` (~10 tableaux de mots-clés, `:172-265`), **10 fonctions d'agrégation métier** (`:268-848`), nettoyage Markdown et handler HTTP. — `app/recettes/create/page.tsx:198-307` définit toute la logique de parsing/normalisation CSV **dans le composant client** (logique pure, testable, mêlée à 500 l. de JSX).
- **Impact** : non testable unitairement, tout changement touche le même fichier, logique CSV dupliquée avec `app/api/recettes/import/route.ts` (risque de divergence de parsing).
- **Correctif** : extraire `lib/agent/{intents,context/*,prompts}.ts` et `lib/recettes/csvMapping.ts` (réutilisé client + serveur).

#### 🟠 P1-7 — Aucun `error.tsx` dans toute l'app
- **Preuve** : 0 `error.tsx` trouvé ; `components/ErrorBoundary.tsx` existe mais n'est utilisé **que** sur `/dashboard` (`dashboard/page.tsx:47-93`). 17 `loading.tsx` présents ✅.
- **Impact** : une exception dans un Server Component (ex. vue Supabase modifiée) tombe sur l'écran d'erreur Next par défaut, **non stylé, non localisé FR**.
- **Correctif** : ajouter `app/error.tsx` racine + sur les segments lourds (`comptabilite/`, `clients/`, `boyah-transport/`).

#### 🟡 P2-4 — Aucun type Supabase généré (cause racine des `any`)
- **Preuve** : `types/` ne contient que des types métier écrits à la main ; pas de `Database` généré (`supabase gen types`). 52 `any` / 33 fichiers, 58 `eslint-disable no-explicit-any` — quasi tous **justifiés** par l'absence de typage des retours `.from().select()`.
- **Impact** : casts manuels partout (`as Record<string, unknown>`, `Number()` défensifs), aucune détection compile-time d'un renommage de colonne/vue.
- **Correctif** : générer `types/database.ts` + `createClient<Database>(…)` → fait tomber l'essentiel des `any`. **Levier qualité #1.**

#### 🟡 P2-5 — Migration `*-v2` inachevée (quasi-dead code)
- **Preuve** : `app/depenses-v2/page.tsx` + `app/recettes-v2/page.tsx` (nouvelle vue flux compta `FlowPageClient`) coexistent avec `app/depenses` + `app/recettes` (anciennes vues flotte). Les `-v2` ne sont liées **nulle part** dans la nav.
- **Impact** : deux implémentations de la même donnée à maintenir, risque de divergence.
- **Correctif** : trancher le cutover (décision Emmanuel) et supprimer la branche perdante.

### 2.4 PERFORMANCE

#### 🟠 P1-8 — Aucune stratégie de cache + RPC lourdes recalculées à chaque visite
- **Preuve** : **0 occurrence** de `unstable_cache`/`revalidateTag`/`revalidate`/`fetch cache` dans tout le projet. `app/api/boyah-transport/dashboard-stats` et `driver-stats` appellent les bonnes RPC `boyah_*` (agrégation SQL, fix 504 ✅) **mais sans cache** → chaque visite ré-agrège ~65 000 lignes `commandes_yango` ; `driver-stats` ajoute un fetch Yango bloquant (jusqu'à 1000 drivers).
- **Impact** : coût DB/latence inutiles, multipliés par chaque rafraîchissement.
- **Correctif** : `unstable_cache(…, { revalidate: 300, tags: ['boyah-stats'] })` + `revalidateTag` après `sync-orders`.

#### 🟠 P1-9 — Agrégats comptables full-history calculés en RAM (anti-pattern des 504, non migré)
- **Preuve** : `app/api/compta/dashboard/stats/route.ts:69-132, 224-228` pagine et rapatrie **toute** la table `operations` (`1900→9999`) pour sommer **en JS** (`fetchAllOps`, `agregerMontantsParType`, `compute2Soldes`). Idem `lib/compta/flow/queryOperations.ts:226`.
- **Impact** : latence croissant **linéairement** avec l'historique — exactement la trajectoire qui a produit les 504 Yango, ici non encore corrigée. `maxDuration 30s` sera atteint à terme.
- **Correctif** : déporter en RPC SQL (`SUM(...) FILTER (...) GROUP BY`) comme `boyah_*`, + cache court.

#### 🟠 P1-10 — N+1 sur la complétude des versements + dashboard 100 % widgets clients
- **Preuve** : `lib/completude/calculCompletude.ts:156-168` — boucle `for (const v of vehicules)` avec **une requête `versement_attribution` par véhicule** (endpoint `/api/completude` appelé par le dashboard **et** `/recettes/suivi`). — `app/dashboard/page.tsx` : ~10 widgets clients refont chacun leurs fetchs après hydratation (`KpiCards.tsx:189-196` = 6 requêtes Supabase directes depuis le navigateur, `CaChart.tsx:74` charge toute `vue_ca_journalier` sans borne).
- **Impact** : latence linéaire en taille de flotte ; waterfall réseau non coordonné, non caché, à chaque visite.
- **Correctif** : remplacer la boucle par un `select id_vehicule, min(jour_exploitation) … group by` ; agréger le dashboard côté serveur (un endpoint `/api/dashboard` ou des RSC).

#### 🟡 P2-6 — N+1 soldes (caisses/comptes/plan-comptable) + bundle non optimisé
- **Preuve** : `app/api/compta/{caisses,comptes}/route.ts:54-66` (`Promise.all(map)` → 3 requêtes/ligne dont un scan `operations` réduit en JS) ; `app/api/compta/plan-comptable/[code]/route.ts:52-94` (triple N+1). — `recharts` importé **statiquement** dans 9+ composants (`0` `next/dynamic` dans tout le projet) ; pas d'`experimental.optimizePackageImports` pour `lucide-react`/`recharts`/`framer-motion`.
- **Impact** : listes paramètres lentes avec l'historique ; First Load JS alourdi (recharts ≈ 150-300 KB gzip/page).
- **Correctif** : RPC `SUM` groupé pour les soldes ; wrapper les charts en `dynamic(() => import(...), { ssr:false, loading: <Skeleton/> })` ; `optimizePackageImports` dans `next.config`.

> **Correction d'un faux positif** : un premier passage automatisé a signalé un « write-on-render » P0 (3 POST de cascade comptable au montage du dashboard via `SuiviVersementsWidget`). **Vérification manuelle : FAUX.** Le montage ne fait qu'un GET `/api/completude` (`SuiviVersementsWidget.tsx:57`). Les 3 POST sont dans `recalculer()`, **déclenché par un bouton** (`:167 onClick={recalculer}`, idem `recettes/suivi/page.tsx:292`). Pas d'écriture au rendu. Le seul vrai sujet du widget est le N+1 GET (P1-10).

---

## 2.5 ÉCARTS REPO ↔ PROD (vérifié en base, MCP — 11/06/2026)

La vérification a révélé que **le repo ne reflète pas fidèlement la production**. Quatre écarts :

#### 🟠 D-1 — Suivi de migrations quasi inexistant **[VÉRIFIÉ EN BASE]**
La table `supabase_migrations.schema_migrations` de prod ne contient que **2 entrées** (`20260510120000_compta_module`, `20260510120001_seed_plan_comptable`) alors que le repo compte **41 fichiers** de migration. Le schéma réel (compta complète, triggers, FK, sous-système chauffeur) est donc construit par des SQL joués **à la main** en Studio, **non tracés**. *Impact* : impossible de reconstruire le schéma prod depuis le repo — bloquant pour le provisioning SaaS (§4) et risqué en restauration. *Correctif* : repartir d'un **dump prod = nouvelle baseline** versionnée, puis discipline stricte (tout DDL = fichier + appliqué via CLI/CI).

#### 🟠 D-2 — Sous-système « app chauffeur » présent en prod, absent du repo **[VÉRIFIÉ EN BASE]**
Un backend d'**application mobile chauffeur** existe entièrement en base mais **sans aucune trace dans le repo audité** :
- **6 tables** (RLS **activée**, isolation par claim JWT `id_chauffeur`) : `app_chauffeur_auth`, `app_chauffeur_finances`, `app_messages_patron`, `app_support_conversations`, `app_support_messages`, `app_versements_mirror`.
- **6 fonctions `SECURITY DEFINER`** (`search_path` fixé ✅) : `app_chauffeur_login`, `app_chauffeur_set_pin`, `app_chauffeur_verify_phone`, `app_chauffeur_home`, `app_chauffeur_versements`, `app_phone_last8` ; **1 bucket privé** `app-chauffeurs-media` ; triggers `app_*_touch`.
- **Qualité [VÉRIFIÉ EN BASE]** : auth **bien conçue** — PIN haché **bcrypt** (`crypt(p_pin, gen_salt('bf'))`), anti-bruteforce (5 essais → lock 15 min → 1 h → blocage support, verrou `FOR UPDATE`), validation `^\d{4}$`, rejet de `0000`, requêtes **100 % paramétrées** (pas d'injection). `app_chauffeur_auth` a RLS activée **sans policy** (deny-all) → accessible uniquement via les fonctions DEFINER : bon pattern.
- *Impact* : ce sous-système échappe à la revue de code, au versioning et à l'audit ; c'est un **2ᵉ système d'authentification** distinct de Supabase Auth. Il **doit être rapatrié dans le repo** (migrations + code mobile) et audité pour lui-même.
- *Mineur (P3)* : `app_chauffeur_login` (appelable par `anon`) distingue `not_found` / `wrong_pin` → légère **énumération** des numéros chauffeurs enregistrés.

#### 🟢 D-3 — Schéma prod en avance sur le repo (FK + index ajoutés à la main) **[VÉRIFIÉ EN BASE]**
Les FK `operations.{vehicule_id,client_id,chauffeur_id}` (`ON DELETE SET NULL`) et plusieurs index existent **en prod mais pas dans les migrations du repo** (cf. P1-4 retiré). Bon pour la robustesse, mais creuse l'écart repo↔prod → à réintégrer dans la baseline (D-1).

#### 🟢 D-4 — Index doublons mineurs **[VÉRIFIÉ EN BASE]**
`versement_attribution` porte deux index identiques sur `jour_exploitation` (`idx_va_jour` + `idx_versement_attribution_jour_exploitation`) ; `ecritures_comptables.extourne_de` a un index UNIQUE **et** un index partiel. Supprimer les doublons.

> **Note SaaS [VÉRIFIÉ EN BASE]** : un 2ᵉ projet Supabase **`ilvzdzrthwzgrougmvmk` (« vtc-saas-master », eu-west-1, Postgres 17)** existe déjà dans la même organisation — un chantier multi-tenant semble **déjà amorcé**. À cadrer avec la recommandation §4.

---

## 3. Plan d'amélioration priorisé

### 🚀 Quick wins (< 1 jour chacun)
1. **[P0-1] Activer RLS (confirmé OFF sur 23 tables)** : `ENABLE ROW LEVEL SECURITY` sur les 23 tables `public` listées + policy `authenticated` minimale, **ET** `ALTER VIEW … SET (security_invoker = on)` sur les 37 vues (sinon elles continuent de contourner la RLS). *(1 j, gain sécurité maximal)*
2. **[P0-2] Fermer les routes ouvertes** : ajouter `requirePermission` sur `recettes/attribution`, `vehicules/update`, `chauffeurs/update`, `yango/{create-driver,create-car,sync-orders}`, `upload`. *(½ j)*
3. **[P1-1] Authentifier les GET sensibles** : `vehicules/marge`, `compta/bilan-cash-net`, `completude`, `justifications`, `yango/*`. *(2 h)*
4. **[P2-3] DB durcissement rapide** : `search_path` sur `handle_new_user`, index d'expression `commandes_yango`, suppression des index doublons (D-4). *(2 h)*
5. **[P1-7] `app/error.tsx`** racine + segments lourds. *(2 h)*
6. **[P3-1] `prevMonth` UTC** dans l'agent. *(15 min)*
7. **[P1-3 annexe] Dédupliquer `supabaseAdmin`** inline (`upload`, `versements`). *(15 min)*

### 🛠️ Chantiers moyens (1-5 jours)
8. **[P0-2] `middleware.ts` fail-closed** : refuse par défaut toute route `/api/*` non explicitement publique. *(1 j)*
9. **[P1-2] Zod hors compta** : schémas de validation + whitelist de champs sur tous les `POST/PATCH` (priorité aux `*/update`). *(2-3 j)*
10. **[P1-8 / P1-9] Cache + RPC compta** : `unstable_cache` sur les RPC `boyah_*` ; migrer les agrégats `compta/dashboard/stats` vers une RPC SQL. *(2-3 j)*
11. **[P1-5] Numérotation transferts** : aligner `create_transfert_interne` sur `MAX(seq)+1` + advisory lock (P1-4 sans objet : FK déjà présentes en prod). *(½-1 j, à tester sur copie)*
12. **[P2-4] Types Supabase générés** + branchement `createClient<Database>`. *(1-2 j, fait tomber la dette `any`)*
13. **[P1-10] Dashboard server-side** + N+1 complétude en une requête groupée. *(2-3 j)*
14. **[P2-1] Durcir les policies permissives** (`ai_insights`, `activity_logs`, `profiles_select`). *(1 j)*

### 🏗️ Chantiers lourds
15. **[P1-6] Éclatement des monolithes** (`agent/process` → `lib/agent/*` ; `recettes/create` → `lib/recettes/csvMapping`). *(3-5 j)*
16. **[P2-5] Finaliser la migration `*-v2`** et supprimer la branche morte. *(2-4 j)*
17. **[P2-6] Lazy-load charts + `optimizePackageImports`** sur toutes les pages graphiques. *(2-3 j)*
18. **[D-1 / D-2] Re-baseline repo ↔ prod** : dump prod → nouvelle baseline versionnée + discipline de migration ; **rapatrier le sous-système « app chauffeur »** (tables + fonctions + code mobile) dans le repo et l'auditer. *(2-4 j)*
19. **Préparation SaaS** (cf. §4) — le plus gros poste.

---

## 4. Section SaaS — Multi-tenancy & modularisation

**Note SaaS readiness : 3,5 / 10.** App interne solide, mais **mono-tenant de bout en bout** : **0 `tenant_id`** dans les ~50 tables de prod (dont le sous-système chauffeur, cf. §2.5 ; seuls des TODO anticipés dans `20260520100000:19`, `20260518120000:58-59`), deux tables paramètres **verrouillées en singleton** (`parametres_module_compta` `CHECK (id=1)` ; `societe_parametres` `UNIQUE((true))`), aucun lien `user → tenant`. **Bon socle malgré tout** : aucun UUID Boyah dans le code, les 6 clients vivent en base (pas en dur), l'identité société est **déjà externalisée** (`societe_parametres` alimente l'en-tête PDF via `lib/pdf/buildHeader.ts`), et la commission Yango est paramétrée (`YANGO_COMMISSION_RATE`).

### 4.1 Recommandation : **Option A — un projet Supabase par tenant** (en V1)

| | Option A : projet Supabase / tenant | Option B : base partagée + `tenant_id` + RLS |
|---|---|---|
| **Isolation** | Physique, par construction — **impossible de fuiter entre tenants** | Logique — dépend d'un `.eq('tenant_id')` correct partout |
| **Réécriture code** | **Quasi nulle** (on injecte URL/clé par tenant) | **Massive** : les ~67 routes `service_role` **bypassent RLS** → il faut d'abord refondre toute la couche API |
| **Singletons/triggers** | Restent valides (`CHECK id=1`, `WHERE libelle='Wave Boyah'`) | À casser partout + contraintes UNIQUE → composites |
| **Conformité compta** | 1 dossier SYSCOHADA isolé/entité = aligné légal | Mélange d'entités juridiques dans `ecritures_comptables` (risqué) |
| **Coût / scaling** | Coûteux au-delà de N tenants ; provisioning à industrialiser | Économique à grande échelle |
| **Reporting cross-tenant** | Difficile | Natif |

**Justification du choix A** : l'usage massif de `service_role` (qui **neutralise RLS**) rend l'option B dangereuse — elle exigerait de refondre toute la couche d'accès **avant** de pouvoir s'appuyer sur RLS, sur des données comptables **opposables** (états financiers archivés/hachés/vérifiables publiquement via `app/verify/*`). L'option A ne demande aucune réécriture, offre une isolation forte (argument commercial + conformité), et le volume actuel (faible) rend le surcoût négligeable. **Trajectoire** : A maintenant (time-to-market + sécurité), réévaluer B seulement au-delà de plusieurs dizaines de tenants **et après** un refactor planifié `service_role → RLS`.

**Pré-requis avant de vendre (même en A)** :
- **Industrialiser le provisioning** (aujourd'hui les migrations sont jouées **à la main** en Studio et **non tracées** — cf. D-1) : script idempotent `create project → migrations → seed plan comptable → admin`. **Pré-requis : reconstituer une baseline fiable repo↔prod.** Un projet `vtc-saas-master` existe déjà (§2.5) — à cadrer.
- **Externaliser les secrets par tenant** (Yango/Wave/Anthropic/Telegram) — actuellement globaux en env.
- **Dé-hardcoder le branding et le bot** (sinon chaque tenant voit « Boyah Group » / « BOYA »).
- **Transformer le directeur global en admin *du tenant*** (cf. cartographie §2.1).

### 4.2 Inventaire du hardcoding à neutraliser (extraits localisés)

| Catégorie | Exemple | Emplacement |
|---|---|---|
| Branding | « Boyah Group » + `/logo.png` | `components/Sidebar.tsx:235,246`, `components/AuthGuard.tsx:70,76`, tous les `app/**/layout.tsx` (metadata), `app/verify/[short_uuid]/page.tsx` |
| Fallback société | `'Boyah Group SARL'` | `lib/pdf/buildHeader.ts:42`, RPC verify/archives SQL |
| Caisse par libellé | `WHERE libelle = 'Wave Boyah'` (trigger + route) | `legacy_baseline.sql:1176,1252`, `app/api/compta/bilan-cash-net/route.ts:28` |
| Seuils métier | `PLAFOND_BOYAH = 50_000`, forfait férié `15 000`, devise `F CFA`, locale `fr-FR` | `lib/clients/calculLoyerNet.ts:22`, `lib/attributionAlgo.ts:12`, `lib/format/montant.ts` |
| Bot identitaire | prompt « Tu es BOYA… » + lexique métier (≈100 l., 63× « Boyah ») | `app/api/agent/process/route.ts:52-145` |
| Plan comptable | libellés `'… (Boyah Group flotte propre)'`, `'Commissions Boyah Transport (2,5% Yango)'`, spécifique CI/OHADA (CNPS, Wave/OM/MTN) | `supabase/migrations/20260510120001_seed_plan_comptable.sql` |
| Provider VTC | credentials Yango globaux | `app/api/yango/**` (env `YANGO_*`, `CLID`, `ID_DU_PARTENAIRE`) |
| Provider paiement | schéma CSV Wave **figé dans la table** `recettes_wave` | `lib/compta/reprise.ts`, `app/api/recettes/import/route.ts` |

### 4.3 Modules vendables (découpage en options)

| Module | Isolation actuelle | Effort découplage | Priorité |
|---|---|---|---|
| **Véhicules** | Bonne (`app/vehicules/**`) | Faible | Cœur |
| **Chauffeurs** | Bonne, mais couplée Yango (`chauffeurs_yango_snapshot`) | Faible→Moyen | Cœur |
| **Loyers clients (asset mgmt)** | **Très bonne** (`lib/clients/*`, `loyerEcheance.ts`, cascade dédiée) | Faible | Haute (différenciateur rare) |
| **Finances / marges** | Centralisée propre (`margeConsolidee.ts`), mais Bloc 3 = Yango, Bloc 2 = module Clients | Moyen | Haute |
| **Comptabilité SYSCOHADA** | Module cohérent, mais plan + libellés + états = OHADA/CI | Moyen→Élevé | Cœur |
| **Rapports PDF** | Bonne (en-tête déjà paramétrée), reste footer/logo | Faible | Inclus |
| **Intégration Yango** | Bien isolée (`app/api/yango/**`, `lib/yangoSync.ts`), credentials globaux | Moyen | Option |
| **Paiements (Wave)** | Faible — schéma BD couplé au CSV Wave | **Élevé** | Haute (à abstraire) |
| **Bot Telegram / BoyahBot** | **La plus faible** — prompt+lexique+règles en dur, mémoire sans tenant | **Élevé** | Option (add-on) |

**Abstractions à créer** : `VtcProvider` (Yango → interface générique, credentials par tenant), `PaymentProvider` (Wave/OM/MTN/Stripe → modèle de transaction normalisé), `tenant.branding` (nom/logo/couleurs — aujourd'hui pas de tokens, couleurs Tailwind dispersées), templates de plan comptable par référentiel pays. L'identité société (`societe_parametres`) est **déjà** la fondation à dé-singletoniser — effort faible.

---

## Annexe — Méthode, sources & limites
- **Sources** : (A) **[VÉRIFIÉ EN BASE]** — schéma de prod inspecté en lecture seule via MCP Supabase le 11/06/2026 : RLS par table, policies, fonctions (`prosecdef`/`proconfig`/corps), triggers, index, FK, buckets. (B) **déduit du code** — routes API, logique métier, migrations du repo (tout le reste).
- **Read-only respecté** : aucun fichier de code modifié, aucune écriture/migration en base — **uniquement des `SELECT`** sur le catalogue système. Le fichier mot de passe temporaire et les scripts d'introspection créés en cours de route ont été **supprimés**. Seul `AUDIT_REPORT.md` a été créé puis mis à jour.
- **Vérifications manuelles** : tous les constats **P0/P1** relus dans le code (`fichier:ligne`) ; un faux positif (« write-on-render ») écarté (§2.4) ; **P1-4 infirmé par la base** (FK présentes en prod).
- **Limite restante** : les **données applicatives** (volumes, contenu des lignes) n'ont pas été lues — structure/catalogue uniquement. L'**advisor sécurité** Supabase (résultat volumineux) n'a pas été dépouillé ligne à ligne, mais ses items principaux — RLS off, `function_search_path_mutable`, `security_definer_view` — sont **confirmés** par les requêtes catalogue directes ci-dessus.
