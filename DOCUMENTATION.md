# VTC-Dashboard — Documentation technique complète

> Plateforme web de pilotage d'une flotte VTC pour Boyah Group (Abidjan, Côte d'Ivoire).
> Stack : Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 3 + Supabase + Anthropic Claude + n8n + API Yango Fleet.

---

## 1. Vision d'ensemble

Le projet est une application web de gestion de flotte VTC qui couvre **deux activités distinctes** d'un même groupe :

1. **Boyah Group (flotte propre)** — la direction loue ses véhicules à des chauffeurs salariés/partenaires qui doivent reverser un montant fixe quotidien (Wave money). L'app suit chaque versement, détecte les manquants, calcule la rentabilité par véhicule, gère les dépenses et alerte sur les documents qui expirent.
2. **Boyah Transport (intermédiation Yango)** — gestion de prestataires qui utilisent leur propre voiture mais roulent sous le compte Yango de Boyah. Le revenu est une commission de 2,5% par course. Synchronisation périodique avec l'API Yango Fleet.

À cela s'ajoute une couche IA (Claude) pour :
- générer des rapports stratégiques périodiques (matin, alertes 4h, veille marché dimanche),
- répondre en chat à des questions financières/opérationnelles,
- piloter un agent Telegram (BOYA) avec mémoire long terme,
- générer des messages WhatsApp personnalisés et des posts marketing (Facebook/Instagram/LinkedIn).

L'orchestration des analyses planifiées est confiée à un n8n auto-hébergé qui appelle les routes API Next.js.

---

## 2. Stack technique

| Couche | Choix |
|---|---|
| Framework | Next.js 16.1.6 (App Router, React Server Components + Client Components) |
| UI | React 19.2.3, Tailwind CSS 3.4, framer-motion, lucide-react, recharts |
| Thèmes | `next-themes` (mode dark par défaut, classe `dark` sur `<html>`) |
| Base de données + Auth | Supabase (Postgres, Auth, Storage) — projet `iixpsfsqyfnllggvsvfl` |
| IA | `@anthropic-ai/sdk` (Claude Opus 4.6 / Sonnet 4.6) |
| Web search (agent) | Tavily |
| PDF | jsPDF + html2canvas |
| CSV | papaparse |
| Workflows planifiés | n8n auto-hébergé (Docker, sur VPS) |
| Notifications agent | Telegram Bot API |
| Hébergement | Vercel (`bigotb9s-projects/vtc-dashboard`) |
| Intégrations externes | Yango Fleet API (drivers/cars/orders/work-rules), Wave (CSV), Resend (email), Twilio (WhatsApp prêt mais non configuré), Buffer (réseaux sociaux prêt mais non configuré) |

`tsconfig.json` utilise l'alias `@/*` pour la racine du projet.

---

## 3. Arborescence du dépôt

```
vtc-dashboard/
├── app/                       # Pages Next.js (App Router)
│   ├── page.tsx               # Login (route /)
│   ├── layout.tsx             # Shell global (sidebar, theme, auth, mobile nav)
│   ├── globals.css
│   ├── dashboard/             # Dashboard principal (Boyah Group)
│   ├── vehicules/             # Liste, détail, édition, création, GPS Live
│   ├── chauffeurs/            # Liste, détail, édition, création
│   ├── clients/               # Propriétaires de véhicules sous gestion
│   ├── recettes/              # Liste recettes Wave + suivi calendrier
│   ├── depenses/              # Saisie + listing + analyses
│   ├── cockpit/               # Cockpit Boyah (KPIs + alertes + conversations + flotte)
│   ├── boyah-transport/       # Sous-domaine Boyah Transport
│   │   ├── dashboard/         # Stats agrégées Yango
│   │   ├── ai-insights/       # IA spécifique prestataires (page distincte, conservée)
│   │   ├── commandes/list/    # Commandes Yango
│   │   ├── prestataires/{create,list}/
│   │   └── vehicules/{create,list}/
│   ├── parametres/            # Profil, utilisateurs, permissions, fériés
│   ├── settings/              # (legacy)
│   ├── journal-activite/      # Audit log
│   └── api/                   # Routes API (handlers serverless)
├── components/                # ~50 composants React (charts, tables, widgets)
├── lib/                       # Helpers (Supabase client, attribution, PDF, auth, toast…)
├── hooks/                     # useProfile, useAlerteBadge
├── public/                    # Assets statiques (logo, login-bg, etc.)
├── n8n-workflows/             # 4 workflows JSON exportés
├── supabase/                  # Migrations SQL
├── proxy.ts                   # Stub middleware Next (matcher des routes auth-protected)
├── next.config.ts             # Config images Supabase
├── tailwind.config.js         # Palette VTC + dark mode "class"
├── package.json
├── README.md / BUSINESS.md / AGENT_BOYA_SETUP.md
└── DOCUMENTATION.md           # (ce fichier)
```

`.claude/worktrees/` contient une copie de travail (worktree git) créée par un agent Claude Code et peut être ignorée pour la compréhension du produit.

---

## 4. Variables d'environnement (`.env.local`)

Regroupées en 4 familles :

**Supabase**
- `NEXT_PUBLIC_SUPABASE_URL` — URL publique du projet
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — clé anon utilisée par les composants client
- `SUPABASE_SERVICE_ROLE_KEY` — clé service utilisée côté serveur (`lib/supabaseAdmin.ts`) pour bypasser RLS depuis les routes API

**Yango Fleet API** (5 endpoints, chacun avec sa propre clé)
- `YANGO_DRIVERS_URL` / `YANGO_DRIVERS_API_KEY`
- `YANGO_CARS_URL` / `YANGO_CREATE_CAR_URL` / `YANGO_CARS_API_KEY`
- `YANGO_ORDERS_URL` / `YANGO_ORDERS_API_KEY`
- `YANGO_CREATE_DRIVER_URL` / `YANGO_CREATE_DRIVER_API_KEY`
- `YANGO_WORK_RULES_URL` / `WORK_RULE_API_KEY`
- Communs : `ID_DU_PARTENAIRE` (park id), `CLID` (`taxi/park/<id>`)
- Optionnel : `YANGO_COMMISSION_RATE` (défaut 0.025)

**IA + Agent**
- `ANTHROPIC_API_KEY` — accès Claude
- `TAVILY_API_KEY` — recherche web pour la veille marché
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — bot BOYA
- `N8N_WEBHOOK_ANALYSE_URL` — webhook n8n pour analyses on-demand

**Marketing (préparé, vide pour l'instant)**
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`
- `BUFFER_ACCESS_TOKEN`, `BUFFER_FACEBOOK_ID`, `BUFFER_INSTAGRAM_ID`, `BUFFER_LINKEDIN_ID`

`VERCEL_OIDC_TOKEN` est généré automatiquement par la CLI Vercel.

---

## 5. Concepts métier critiques

(Voir `BUSINESS.md` pour la version longue. Résumé ci-dessous.)

| Concept | Définition technique |
|---|---|
| **Versement** | Montant quotidien attendu d'un chauffeur (`vehicules.montant_recette_jour`, ex 22 000 FCFA). |
| **Jour d'exploitation** | Jour ouvré attaché à une recette. Lun-sam ; dimanche = `non_ouvre` ; jour férié dans `jours_feries` = montant alternatif (15 000 FCFA par défaut). |
| **Recette Wave** | Ligne de `recettes_wave` importée depuis CSV Wave (PK = `id`, colonnes "Horodatage", "Montant net", "Numéro de téléphone de contrepartie"). |
| **Affectation** | Lien chauffeur ↔ véhicule sur une période (`affectation_chauffeurs_vehicules` avec `date_debut`/`date_fin`). Un chauffeur n'a qu'une affectation active à la fois ; un véhicule peut avoir 2 chauffeurs simultanés. |
| **Attribution** | Mapping résolu (recette → véhicule + jour ouvré) écrit dans `versement_attribution`. Type : `normal` / `jour_meme` / `split_2j` / `retard`. |
| **Justification** | Raison métier qui transforme un manquant/insuffisant en "ok" (`justifications_versement`). Type : `panne`, `accident`, `hospitalisation`, `jour_ferie` (auto), … |
| **Statut versement** | Calculé à la volée dans `/api/completude` : `paye_complet`, `paye_insuffisant`, `paye_justifie`, `manquant`, `manquant_justifie`, `jour_ferie_auto`, `en_cours`, `non_ouvre`, `pre_service`, `futur`. |
| **Tolérance Wave** | 1 % (constante `TOLERANCE = 0.99`) sur le montant attendu, pour absorber les frais Wave. |
| **Sous gestion** | Véhicule appartenant à un client (propriétaire externe) confié à Boyah pour exploitation. Boyah verse au client (jamais l'inverse) le 5–10 du mois suivant : `net_client = montant_mensuel - max(0, depenses - 50 000)` ; cap des dépenses absorbées par Boyah = 50 000 FCFA / mois. |
| **Boyah Transport** | Activité distincte ; revenu = 2,5 % des courses Yango des prestataires ; aucun versement quotidien. |

---

## 6. Schéma de données (déduit du code)

Les tables ne sont pas toutes décrites dans une migration unique — la plupart existent déjà côté Supabase et sont consommées par le code. Seule `supabase/migration-agent.sql` ajoute les tables de l'agent IA.

### Tables principales

| Table | Rôle |
|---|---|
| `vehicules` | id_vehicule, immatriculation, type_vehicule, statut (`ACTIF`/`MAINTENANCE`/`INACTIF`), photo, montant_recette_jour, sous_gestion, id_client, montant_mensuel_client, dates d'expiration (assurance, visite, carte_stationnement, patente). |
| `chauffeurs` | id_chauffeur, nom, photo, numero_wave, actif, CNI, permis, garant, domicile. |
| `clients` | Propriétaires des véhicules sous gestion (id, nom, telephone, email, notes). |
| `affectation_chauffeurs_vehicules` | id_affectation, id_chauffeur, id_vehicule, date_debut, date_fin (NULL = active). |
| `recettes_wave` | id (PK), "Horodatage", "Montant net", "Nom de contrepartie", "Numéro de téléphone de contrepartie", "Identifiant de transaction" (clé d'upsert pour l'import CSV). |
| `versement_attribution` | id_recette, id_vehicule, jour_exploitation, montant_attribue, type_attribution. Recalculée par `/api/recettes/attribution`. |
| `justifications_versement` | id_vehicule, jour_exploitation (clé composite), type, motif, montant_attendu, montant_recu, auto_genere, created_by. |
| `versements_clients` | id_client, mois (`YYYY-MM`), montant, date_versement, notes. |
| `jours_feries` | date, libelle, montant (par défaut 15 000). |
| `depenses_vehicules` | id_vehicule, montant, type_depense, date_depense, description, immobilisation. |
| `entretiens` | id, id_vehicule, immatriculation, date_realise, date_prochain (auto +21j), km_vidange, cout, technicien, notes, et booléens par opération (`huile_moteur`, `filtre_huile`, …) + objet `inspection` JSON. |
| `taches_suivi` | id, id_vehicule, immatriculation, description, fait, fait_at, id_entretien (parent). |
| `commandes_yango` | id (PK), short_id, status, created_at, ended_at, raw (JSON brut Yango). |
| `profiles` | id (= auth.users.id), role (`directeur`/`admin`/`dispatcher`), full_name. |
| `role_permissions` | role, action, allowed (matrice). Le directeur bypass tout dans le code. |
| `activity_logs` | user_id, user_name, user_role, action, entity, details, created_at. |

### Tables agent IA (créées par `migration-agent.sql`)

| Table | Rôle |
|---|---|
| `agent_memory` | categorie, cle (UNIQUE), valeur, importance (1-10). Mémoire long terme que Claude alimente via marqueurs `[MEM]…[/MEM]`. |
| `agent_conversations` | telegram_chat_id, telegram_user_id, role (`user`/`assistant`), content. Historique conversationnel paginé/réinjecté. |
| `agent_analyses` | type, titre, contenu, donnees (JSONB). Archive des rapports générés. |

### Vues consommées (lecture seule)

- `vue_dashboard_vehicules` — agrégats par véhicule (CA mensuel/aujourd'hui, profit, statut, chauffeur).
- `vue_recettes_vehicules` — recettes jointes au véhicule attribué.
- `vue_voitures_payees` — état paiements par véhicule.
- `vue_depenses_categories`, `vue_depenses_par_categorie`, `vue_depenses_journalieres`, `vue_dashboard_depenses`.
- `vue_ca_journalier`, `vue_ca_mensuel`, `vue_ca_vehicules`, `vue_ca_vehicule_jour`, `vue_ca_chauffeur_jour`.
- `vue_chauffeurs_vehicules`, `classement_chauffeurs`.
- `vue_profit_journalier` (`vue_ai_insights_today` conservée en archive, plus consommée depuis la suppression du module AI Insights le 27/05/2026).

Storage buckets Supabase utilisés : `vehicules`, `chauffeurs`, `avatars` (10 Mo max, JPEG/PNG/WebP/GIF, voir `app/api/upload/route.ts`).

---

## 7. Auth & permissions

### Authentification

- Supabase Auth (email + mot de passe).
- Page `/` = login (`app/page.tsx`) — affiche aussi des KPIs en temps réel (véhicules actifs, chauffeurs, courses Yango du mois).
- `<AuthGuard>` (utilisé dans `app/layout.tsx`) vérifie `supabase.auth.getSession()` et redirige vers `/` si pas de session.
- `proxy.ts` est un middleware Next.js stub (matcher préparé pour `/dashboard`, `/vehicules`, `/chauffeurs`, `/recettes`, `/depenses`, `/cockpit`, `/parametres`) — il n'applique pas de logique pour le moment.
- Côté API serveur : token Bearer extrait du header `Authorization` puis `supabaseAdmin.auth.getUser(token)`.

### Rôles

Trois rôles dans `profiles.role` : `directeur`, `admin`, `dispatcher`.

- Le directeur bypass toutes les permissions (logique dans `lib/profile.ts` via Proxy + dans `lib/requirePermission.ts`).
- Pour `admin` et `dispatcher`, la matrice `role_permissions` (clé `role`+`action`) est consultée. Liste exhaustive des `action` dans `app/parametres/page.tsx` :
  - Dashboard : `view_dashboard`
  - Finances : `view_recettes`, `manage_recettes`, `view_depenses`, `manage_depenses`, `export_pdf`
  - Flotte : `view_chauffeurs`, `create_chauffeur`, `edit_chauffeur`, `delete_chauffeur`, `view_vehicules`, `create_vehicle`, `edit_vehicle`, `delete_vehicle`, `manage_clients`
  - Boyah Transport : `view_boyah_dashboard`, `view_orders`, `sync_orders`, `create_driver`
  - Système : `view_journal`, `manage_users`

### Helpers

- `useProfile()` (hook) — expose `profile`, `can(action)`, `isDirecteur`, `isAdmin`. Conditionne l'affichage des liens dans `Sidebar`.
- `requirePermission(req, action)` — utilisé dans les routes API qui mutent (POST/PATCH/DELETE) ; renvoie 401/403 sinon le couple `{user, role}`.
- `requireDirecteur(req)` — variante stricte pour `/api/admin/*`.
- `authFetch(url, opts)` — wrapper `fetch` qui injecte automatiquement le Bearer token Supabase.
- `logActivity({token, action, entity, details})` — insère dans `activity_logs`. Utilisé après chaque mutation sensible.

---

## 8. Layout & navigation globale

`app/layout.tsx` monte :

1. `<ThemeProvider>` (next-themes, dark par défaut) ;
2. `<SidebarProvider>` (state collapsed/expanded persisté en `localStorage` via `lib/SidebarContext.tsx`) ;
3. `<AuthGuard>` ;
4. `<Sidebar>` (desktop) + `<MobileNav>` (bottom bar mobile) ;
5. `<AppShell>` qui :
   - écoute l'évènement `open-sidebar` pour ouvrir l'overlay mobile,
   - affiche le contenu de page dans `<main>` avec `<PageTransition>` (animation framer-motion),
   - monte `<GlobalSearch>` (modal de recherche transversale, ouvert via `cmd+k` ou bouton),
   - monte `<Toaster>` (toasts globaux).

Sidebar (`components/Sidebar.tsx`) — animée framer-motion, sliding pill sur l'item actif, expand/collapse, sections :

- **Navigation** : Dashboard, Véhicules, GPS Live, Chauffeurs, Clients
- **Finances** : Recettes, Dépenses
- **Services** : Boyah Transport (sous-arbre Dashboard, AI Insights, Prestataires create/list, Véhicules create/list, Commandes list)
- **Système** : AI Insights, Journal (directeur), Paramètres

L'affichage des liens est filtré par `can(...)` du `useProfile()`. Le bas de la sidebar montre l'avatar (initiale), le nom, l'email et le bouton de déconnexion.

---

## 9. Pages principales (front)

### `/` — Login

Layout 2 colonnes : à gauche, scène isométrique animée + brand + 4 cards de KPIs en temps réel (véhicules actifs, chauffeurs actifs, courses Yango du mois, taux commission 2,5 %). À droite, formulaire email/password avec `supabase.auth.signInWithPassword`. Auto-redirection vers `/dashboard` si session déjà active.

### `/dashboard`

Server component. Charge en parallèle `vue_recettes_vehicules` (20 dernières), `vue_depenses_categories`, `vue_voitures_payees`. Compose le dashboard via :

- `<KpiCards>` (CA total / dépenses / profit + CA jour vs hier, CA mois vs précédent, véhicules, chauffeurs, avec animations counter et trend badges)
- `<CaChart>` + `<CaDepensesChart>` (recharts)
- `<RecettesTable>` (20 dernières)
- `<DepensesCategorieChart>` + `<PaiementVehiculesChart>` + `<AlertesPaiements>`
- `<SuiviVersementsWidget>` (résumé du calendrier)
- `<AlerteDocuments>` + `<TachesSuiviWidget>` (réparations à programmer)

Chaque widget est enveloppé dans un `<ErrorBoundary>` pour isoler les pannes.

### `/vehicules`

Liste des véhicules + 4 KPIs (total, actifs, CA flotte mensuel, profit flotte) + table + chart historique.

- `/vehicules/create` — création
- `/vehicules/[id]` — fiche véhicule (photos, docs, KPIs, affectation, entretiens, recettes, export PDF via `exportVehiculeFichePdf`)
- `/vehicules/[id]/edit` — édition
- `/vehicules/carte` — page GPS Live qui embed un iframe `https://www.gps-go.com` avec contrôles fullscreen, refresh, panneau latéral listant les véhicules actifs, indicateur de connexion live et timer "elapsed since loaded".

### `/chauffeurs`

3 KPIs (total, actifs, inactifs) + chart top performers + carte top chauffeur (avec sparkline des versements) + table.

- `/chauffeurs/create`
- `/chauffeurs/[id]` — fiche détaillée + export PDF (`exportChauffeurFichePdf`)
- `/chauffeurs/[id]/edit`

### `/clients`

Gestion des propriétaires de véhicules sous gestion. Pour chaque client :

- liste de ses véhicules avec revenu / dépenses / boyah_support / surplus / net_client / profit_boyah du mois sélectionné ;
- pour chaque mois (les 6 derniers), statut de versement (`deja_verse`, `a_verser`, `en_retard`, `pas_encore_du`, `en_cours`, `futur`) — fenêtre de paiement = 5–10 du mois suivant ;
- bouton pour enregistrer un versement Wave.

### `/recettes`

Liste de toutes les recettes Wave (server-side fetch sur `vue_recettes_vehicules`) avec colonnes Horodatage / numéro / nom / véhicule attribué / jour d'exploitation / montant.

`/recettes/suivi` (LE point central de pilotage) — calendrier interactif :

- Charge `/api/completude?from=…&to=…`
- Matrice véhicules (lignes) × jours (colonnes) ; chaque case = couleur+icône selon `STATUS_META` ; hover affiche un tooltip riche (montants, transactions, chauffeurs ayant versé, types d'attribution, justification).
- Légende cliquable (filtre/tri) ; toolbar avec fenêtre 15/30/60 jours et navigation période ; bouton "Recalculer" qui POST sur `/api/recettes/attribution`.
- Click sur une case "manquant"/"insuffisant" → ouvre `<JustificationModal>` qui POST sur `/api/justifications`.

### `/depenses`

Server fetch en parallèle : `vue_dashboard_depenses`, `vue_depenses_par_categorie`, `vue_depenses_journalieres`. Délégué à `<DepensesPageClient>` (formulaire de saisie + table + charts catégorie/journalier).

`/depenses/create` — formulaire dédié.

### `/cockpit` (Cockpit Boyah)

Tableau de bord d'action quotidien (remplace l'ancien système AI Insights legacy retiré le 27/05/2026). 4 zones :

- **KPIs vitaux** : cashflow jour, activité flotte (courses Yango / objectif), véhicules en retard (count + montant dû), dette clients
- **Alertes à traiter aujourd'hui** : retards versement (manquant / insuffisant), caisses négatives, marge en baisse, top performers — bouton "Marquer fait" persisté en localStorage par jour
- **Conversations à préparer** : auto-suggestions WhatsApp templatées + liste todos partagée (table `cockpit_todos`, RLS authenticated)
- **Mini-radar flotte** : tuile par véhicule (à jour / retard / pause) — calcul via `lib/completude/calculCompletude.ts` (source de vérité unique partagée avec le widget Suivi versements)

Endpoints : `/api/cockpit/{kpis,alertes,conversations,todos,flotte}`. Refresh auto 60s, refresh manuel, gestion erreur par zone.

### `/boyah-transport/dashboard`

KPIs Yango (revenus today/week/month, commission 2,5 %, taux complétion, panier moyen), charts (revenus 30j, hourly, payments breakdown, completion trend), top 10 chauffeurs Yango, top 6 véhicules Yango. Bouton sync rapide (`shouldAutoSync` toutes les 5 min) + bouton "sync complet depuis date X" qui appelle `/api/yango/sync-orders` en boucle tant que `has_more`.

### `/boyah-transport/ai-insights`

Dashboard IA avec :

- Health Ring (score 0–100)
- Top performers
- Liste des prestataires avec status (actif / risque / inactif) calculé à partir de l'activité semaine/mois
- Bouton WhatsApp par chauffeur — `buildWhatsAppMessage(driver)` génère un message personnalisé selon le statut + chiffres réels (courses du mois, dernière activité, moyenne par course)
- Générateur de posts Facebook/Instagram/LinkedIn — POST `/api/boyah-transport/generate-post` avec stats + plateforme + ton ; Claude Opus renvoie le post prêt à publier

Les autres pages Boyah Transport sont CRUD pour prestataires et véhicules (la création passe par les routes `/api/yango/create-driver` et `/api/yango/create-car` qui poussent côté Yango).

### `/parametres`

3 onglets visibles selon le rôle :

- **Profil** : nom, email, mot de passe, avatar (upload bucket `avatars`), thème
- **Utilisateurs** (directeur uniquement) : liste tous les `auth.users` enrichis du profil, création (POST `/api/admin/users`) avec choix du rôle, modification, désactivation (`ban_duration: "87600h"`)
- **Permissions** (directeur uniquement) : matrice rôle × action toggleable (PATCH `/api/admin/permissions`)
- **Jours fériés** (directeur uniquement) : `<JoursFeriesManager>` → CRUD `/api/jours-feries`

### `/journal-activite`

Lecture de `activity_logs` avec pagination, recherche, filtres par catégorie d'action (utilisateurs, permissions, exports, sync, finances, flotte) et badges par rôle. Réservé directeur (`view_journal`).

---

## 10. Routes API (`app/api/**`)

### Domaine flotte & finances

| Route | Méthodes | Rôle |
|---|---|---|
| `/api/chauffeurs/list` | GET | Liste paginée des chauffeurs |
| `/api/chauffeurs/create` | POST | Crée un chauffeur (perm `create_chauffeur`, détection doublon par numéro Wave normalisé last 8) |
| `/api/chauffeurs/update` | PATCH | Modifie un chauffeur |
| `/api/vehicules/list` | GET | Liste véhicules |
| `/api/vehicules/create` | POST | Crée un véhicule (perm `create_vehicle`) |
| `/api/vehicules/update` | PATCH | Modifie un véhicule |
| `/api/affectations` | GET/POST/DELETE | Affectation active d'un chauffeur ou véhicule + créer/terminer. Règles : un chauffeur a 1 véhicule actif, un véhicule a max 2 chauffeurs ; rouvre une affectation fermée plutôt que créer un doublon |
| `/api/clients` | GET/POST | Clients sous gestion + calcul mensuel revenu/dépenses/boyah_support/net_client/profit_boyah |
| `/api/clients/versements` | (POST) | Enregistre un versement client |
| `/api/depenses/create` | POST | Crée une dépense (perm `manage_depenses`) |
| `/api/recettes/create` | POST | Crée une recette manuelle |
| `/api/recettes/import` | POST | Bulk insert depuis CSV Wave (upsert sur `Identifiant de transaction`, chunks de 500) |
| `/api/recettes/attribution` | POST | Recalcule TOUTES les attributions Wave→jour (algo dans `lib/attributionAlgo.ts`). Supprime puis ré-insère par chunks de 500. Auto-justifie les jours fériés |
| `/api/completude` | GET (?from&to) | Construit la matrice véhicule×jour avec statut, justifications, chauffeurs résolus par téléphone Wave (last 8 digits), stats globales et taux de complétion |
| `/api/justifications` | GET/POST/DELETE | CRUD des justifications (perm `manage_*` selon le verbe) |
| `/api/jours-feries` | GET/POST/DELETE | CRUD jours fériés (admin/directeur) |
| `/api/entretiens` | GET/POST/DELETE | Entretien + génération automatique de tâches depuis l'inspection JSON (éclairage, mécanique, freinage, pneus, documents, équipements) |
| `/api/taches` | GET/POST/PATCH/DELETE | Gestion des tâches de réparation à programmer |
| `/api/upload` | POST (multipart) | Upload image vers Supabase Storage. Buckets autorisés : `vehicules`, `avatars`, `chauffeurs`. Limite 10 Mo, MIME image/* uniquement |

### Domaine Yango (Boyah Transport)

| Route | Méthodes | Rôle |
|---|---|---|
| `/api/yango/drivers` | GET | Liste des chauffeurs Yango (proxy POST vers `YANGO_DRIVERS_URL` avec headers X-API-Key/X-Client-ID/X-Park-ID) |
| `/api/yango/vehicles` | GET | Liste des voitures Yango |
| `/api/yango/orders` | GET | Liste des commandes Yango (proxy direct) |
| `/api/yango/sync-orders` | POST | Sync incrémental ou full (avec `from_date`). Filtre sur `created_at`, fenêtre = (latest-1h)→now, pagination jusqu'à épuisement (cap 100k), retry exponentiel x3, upsert par batches de 500 dans `commandes_yango` (PK = `id`, idempotent) |
| `/api/yango/work-rules` | GET | Récupère les règles de travail |
| `/api/yango/create-driver` | POST | Pousse un nouveau prestataire vers Yango |
| `/api/yango/create-car` | POST | Pousse un nouveau véhicule vers Yango |
| `/api/boyah-transport/dashboard-stats` | GET | Agrège toutes les commandes (paginées par 1000) → KPIs : revenus today/week/month/total, commission, taux complétion (excluant in-flight), panier moyen, daily 30j, hourly aujourd'hui, payment methods, top drivers, top vehicles (par immat), trend semaine vs précédente |
| `/api/boyah-transport/driver-stats` | GET | Stats individuelles par chauffeur (alimente la page AI Insights Boyah Transport) |
| `/api/boyah-transport/generate-post` | POST | Claude Opus génère un post marketing (Facebook/Instagram/LinkedIn) selon plateforme + ton + stats |

### Domaine IA & Agent

| Route | Méthodes | Rôle |
|---|---|---|
| `/api/agent/process` | POST | **Cerveau de BOYA** (voir section 11) |
| `/api/cockpit/kpis` | GET | 4 KPIs vitaux du Cockpit (cashflow, activité, retards, dette clients) |
| `/api/cockpit/alertes` | GET | Alertes consolidées (retard véhicule, caisse négative, marge baisse, top performer) |
| `/api/cockpit/conversations` | GET | Messages WhatsApp templatés (relance retards + félicitations) |
| `/api/cockpit/todos` | GET/POST | Liste partagée d'actions équipe |
| `/api/cockpit/todos/[id]` | PATCH/DELETE | Toggle done / édition / suppression d'une tâche |
| `/api/cockpit/flotte` | GET | Mini-radar flotte (1 entrée par véhicule, statut à jour/retard/pause) |
| `/api/completude` | GET | Calendrier de complétude versements (widget Suivi versements + source partagée Cockpit) |

> Le système legacy AI Insights (`/api/ai-insights*`) a été retiré le 27/05/2026 et remplacé par le Cockpit Boyah. La table `ai_insights` est conservée en archive.

### Domaine Admin / Audit

| Route | Méthodes | Rôle |
|---|---|---|
| `/api/admin/users` | GET/POST/PATCH/DELETE | CRUD users via `supabaseAdmin.auth.admin.*` (création avec `email_confirm: true`, désactivation = ban 87 600 h) — directeur uniquement |
| `/api/admin/permissions` | GET/PATCH | Lecture matrice + upsert d'une permission — directeur uniquement |
| `/api/admin/activity` | GET | Logs paginés |

Toutes les routes qui mutent loggent dans `activity_logs` via `logActivity()` (helper non-bloquant qui ne fait pas échouer la requête si le log rate).

---

## 11. Algorithme d'attribution des versements

Cœur métier dans `lib/attributionAlgo.ts`. Appelé par `POST /api/recettes/attribution`.

### Pré-traitement (route)

1. Charger TOUTES les recettes Wave non vides (pagination 1000 jusqu'à 100 000 pour éviter la limite Supabase).
2. Charger les chauffeurs (`numero_wave`) et indexer par téléphone normalisé last 8.
3. Charger TOUTES les affectations historiques + grouper par chauffeur.
4. Pour chaque recette : retrouver le chauffeur via téléphone (last 8 digits), puis trouver l'affectation **active à la date du versement** (pas aujourd'hui), avec fallback sur affectation courante puis la plus récente.
5. Compter et exposer les skips : `skipped_no_phone`, `skipped_no_chauffeur`, `skipped_no_affectation`.
6. Appeler `attribuerRecettes(recettes, vehicules, feries)`.
7. Supprimer toutes les attributions existantes puis ré-insérer par chunks de 500.
8. Auto-justifier (upsert) les jours fériés passés pour chaque véhicule actif.

### Algorithme (`attribuerRecettes`)

Règles métier :

- Lun-sam = ouvrés ; dimanche = non ouvré.
- Une recette Wave reçue le jour N compte par défaut pour le **jour ouvré précédent** (en sautant le dimanche).
- Plusieurs recettes Wave le même jour pour le même véhicule : la 1ère → jour ouvré précédent, la 2ème → jour de réception lui-même.
- Si le montant ≈ k × montant attendu (k entier ≥ 2, tolérance 5 %) → split sur k jours ouvrés consécutifs (phase 1 : remonter, phase 2 : avancer si tous les jours sont déjà pris).
- Jours fériés : montant attendu = 15 000 FCFA (configurable par férié).
- Tolérance 1 % sur le matching paye/attendu (constante `TOLERANCE = 0.99` dans `/api/completude`).
- Si conflit (jour cible déjà pris) :
  - Dimanche → continue à reculer pour trouver un jour libre.
  - Sinon → tente d'abord un rattrapage 6 jours en arrière (cas typique 2 recettes le même jour, dont une pour vendredi/samedi vide), sinon bascule en avant à partir de dWave (→ `jour_meme`).

Résultat : une liste d'`Attribution { id_recette, id_vehicule, jour_exploitation, montant_attribue, type_attribution }` avec `type_attribution ∈ { normal, jour_meme, split_2j, retard }`.

### Calcul du statut (`/api/completude`)

Pour chaque (véhicule actif × jour de la fenêtre), on combine :

1. La date par rapport à `today` (futur, today=`en_cours`).
2. Le `dow` (dimanche = `non_ouvre`).
3. Si la date est antérieure au 1er versement attribué de ce véhicule → `pre_service` (le véhicule n'était pas encore dans la flotte).
4. Présence d'un jour férié (`jour_ferie_auto` si aucune attribution).
5. Sinon : compare `montant_recu` vs `montant_attendu * TOLERANCE` → `paye_complet` / `paye_insuffisant` / `manquant` ; les justifications transforment en `paye_justifie` / `manquant_justifie`.
6. Pour chaque case : retrouve les chauffeurs ayant versé (via `recettes_wave.id` → téléphone → `chauffeurs.nom`) et expose les types d'attribution.

Le taux de complétion exclut `non_ouvre`, `futur`, `pre_service` du dénominateur.

---

## 12. L'agent IA "BOYA" (`/api/agent/process`)

Pipeline en 6 étapes :

1. **Classification d'intent** (`classifyIntent`) — 11 intents : `daily_report`, `alerts`, `market_research`, `financial_query`, `driver_query`, `vehicle_query`, `client_query`, `operational`, `show_memory`, `conversation`. Slash commands explicites (`/rapport`, `/alerte`, `/marche`, `/memoire`, `/client`, `/chauffeur`, `/vehicule`) court-circuitent la classification ; sinon matching mot-clé sur le texte normalisé (sans accents, lowercase).
2. **Fetch contexte ciblé** (`fetchContext`) — un switch par intent décide quels datasets charger (financier, chauffeurs, véhicules, transport, clients, entretiens, complétude). La mémoire long terme (40 entrées les plus importantes de `agent_memory`) est toujours chargée.
3. **Recherche web** (Tavily) — déclenchée pour `market_research`, `daily_report`, et conversations contenant `marche|concurrent|yango|indriver|bolt|tendance|reglementation`. Renvoie résumé + sources.
4. **Construction du prompt utilisateur** (`buildUserContent`) — un template par intent qui injecte le contexte JSON complet + les directives de format.
5. **Appel Claude** — modèle `claude-opus-4-8` par défaut, surchargeable via la variable d'env `ANTHROPIC_MODEL` (et `ANTHROPIC_MODEL_POSTS` pour la route `/api/boyah-transport/generate-post`, fallback en cascade posts → générale → défaut), `max_tokens` adaptatif (800 pour alerts, 1800 pour market_research, 1024 par défaut), system prompt strict ("⚡ RÈGLE ABSOLUE : Tu reçois une demande → tu l'EXÉCUTES immédiatement. JAMAIS de bonjour, présentation…"). Inclus un lexique métier détaillé pour Boyah Group et Boyah Transport, et le rappel critique : *"C'EST BOYAH QUI VERSE AUX CLIENTS, jamais l'inverse"*.
6. **Post-traitement** :
   - extraction des marqueurs `[MEM]categorie|cle|valeur|importance[/MEM]` → upsert dans `agent_memory` (la cle est UNIQUE) ;
   - strip Markdown (Telegram ne supporte pas correctement les `**gras**` et `## titres`) ;
   - tronque à 3 800 caractères (limite Telegram 4 096) ;
   - sauvegarde async `agent_conversations` (user + assistant) et `agent_analyses` si l'intent n'est pas `conversation`.

Garde-fous :
- garantie d'alternance user/assistant dans l'historique (Claude le requiert),
- filtrage des phrases de salutation des assistants précédents pour éviter qu'elles polluent le contexte,
- timeout `maxDuration = 60` secondes (Vercel Pro plan).

---

## 13. Workflows n8n (`n8n-workflows/*.json`)

Quatre workflows exportés (tous désactivés par défaut, à activer après import) qui orchestrent l'agent BOYA via Telegram :

| Fichier | Trigger | Action |
|---|---|---|
| `01-agent-telegram.json` | `telegramTrigger` (sur message reçu) | POST `${NEXTJS_URL}/api/agent/process` avec `{message, chat_id, telegram_user_id}` → vérifie `ok` → renvoie sur Telegram (réponse ou message d'erreur) |
| `02-rapport-matinal.json` | `scheduleTrigger` (chaque jour 7h) | POST `/api/agent/process` avec `{type: "daily_report"}` → envoie sur le chat ID configuré |
| `03-alertes-auto.json` | `scheduleTrigger` (toutes les 4h) | POST `/api/agent/process` avec `{type: "alerts"}` → IF la réponse contient des alertes (≠ "✅ RAS"), envoie sur Telegram |
| `04-veille-marche.json` | `scheduleTrigger` (chaque dimanche 9h) | POST `/api/agent/process` avec `{type: "market_research"}` → envoie sur Telegram |

Variables n8n requises : `NEXTJS_URL`, `TELEGRAM_CHAT_ID`. Credential `Telegram Boyah Bot` à créer puis remplacer le placeholder `TELEGRAM_CREDENTIAL_ID` dans chaque JSON.

Procédure complète d'installation détaillée dans `AGENT_BOYA_SETUP.md`.

---

## 14. Intégration Yango Fleet API

L'API Yango est invoquée via 5 endpoints distincts (chacun avec sa propre clé) hostés sur `https://fleet-api.yango.tech` :

- **drivers/list** (POST) → liste des `driver_profiles` avec id, nom, téléphone, statut, work_status, voiture, plaque, solde
- **cars/list** + **vehicles/car** (POST) → liste + création de véhicules
- **orders/list** (POST) → liste des courses avec cursor pour la pagination ; `query.park.order.created_at = {from, to}` pour le filtrage temporel
- **contractors/driver-profile** (POST) → création de prestataire
- **driver-work-rules** (POST) → règles de travail

Headers communs :

```
Content-Type: application/json
X-API-Key:    <clé spécifique au endpoint>
X-Client-ID:  taxi/park/<ID_DU_PARTENAIRE>
X-Park-ID:    <ID_DU_PARTENAIRE>      # pour drivers/cars
Accept-Language: fr
```

La sync des commandes (`/api/yango/sync-orders`) :

- mode incrémental par défaut : fenêtre = (latest_created_at - 1 h) → maintenant, avec overlap de 1 h pour rattraper les corrections rétroactives Yango (statut/prix updaté après coup) ;
- mode full (avec `from_date`) : descend jusqu'à `HISTORY_START = 2026-01-01` ;
- pagination cursor jusqu'à épuisement (cap 100 000 commandes par run) ;
- retry exponentiel x3 sur erreurs 5xx / non-JSON / network ;
- upsert idempotent par batches de 500 dans `commandes_yango` (PK = `id`).

Côté front (`lib/yangoSync.ts`) :

- `shouldAutoSync()` : vrai si la dernière sync date de plus de 5 minutes (timestamp en localStorage `yango_last_sync`) ;
- `runQuickSync()` : appelle l'endpoint en mode incrémental ;
- `runFullSync(fromDate, onProgress)` : boucle tant que `has_more === true`, avec progress callback.

---

## 15. Génération de PDF (`lib/exportPdf.ts`)

Helpers exposés :

- `exportChauffeurFichePdf({nom, numeroWave, …, recettes})` — fiche chauffeur
- `exportVehiculeFichePdf({immatriculation, …, recettes})` — fiche véhicule
- `exportRecettesPdf(recettes)` — listing des recettes avec total
- `exportDepensesPdf(depenses)` — listing des dépenses avec total
- `exportChauffeursPdf(chauffeurs)` — annuaire chauffeurs
- `exportFicheInspectionPdf(immatriculation)` — fiche d'inspection physique imprimable, multi-page, multi-sections colorées (éclairage, carrosserie, intérieur, mécanique, pneus, freinage, documents, équipements, vidange) avec checkboxes, observations libres, signatures

Tous utilisent `jsPDF` directement (pas de `jspdf-autotable`). Le helper interne `drawTable` gère la pagination, les zébrures, la troncature de cellules trop larges. Le banner inclut le logo (chargé en base64 depuis `/logo.png`) et un footer "Boyah Group · Confidentiel · Page X/Y" sur chaque page.

Les chiffres sont formatés avec `Math.round(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")` plutôt que `toLocaleString("fr-FR")` car ce dernier produit des espaces insécables que jsPDF/Helvetica ne sait pas rendre.

---

## 16. Composants React notables

- **Charts (recharts)** : `CaChart`, `CaDepensesChart`, `RecettesChart`, `DepensesChart`, `DepensesCategorieChart`, `DepensesJourChart`, `ChauffeursChart`, `TopChauffeurChart`, `VehiculesChart`, `PaiementVehiculesChart`. Tous reçoivent `data` en prop et appliquent un thème (couleurs Tailwind via `tailwind.config.js`).
- **Tables** : `RecettesTable`, `DepensesTable`, `ChauffeursTable`, `VehiclesTable`. Pagination, recherche, tri.
- **Widgets dashboard** : `KpiCards`, `AlertesPaiements`, `AlerteDocuments`, `EntretiensWidget`, `TachesSuiviWidget`, `SuiviVersementsWidget`, `AffectationWidget`, `PaiementVehicules`, `TopChauffeurs`.
- **Forms** : `CreateDepenseForm`, `JoursFeriesManager`, `JustificationModal`, `VehiculeUpdateDocs`.
- **Effets visuels** : `Card3D` (effet 3D au hover), `IsometricScene` (canvas isométrique du login), `AnimatedChart`, `AnimatedCounter`, `AnimatedRow`, `PageTransition`, `Skeleton`.
- **Layout** : `Sidebar` (desktop animée), `MobileNav` (bottom bar mobile), `Header`, `PageHeader`, `Breadcrumbs`, `SearchBar`, `GlobalSearch` (modal cmd+K), `theme-toggle`, `Toaster` (toasts globaux), `ErrorBoundary`.
- **Page-level clients** : `RecettesPageClient`, `DepensesPageClient` (logique riche déportée hors des Server Components).
- **Boutons d'action** : `DashboardActions`, `DashboardRefresh`, `DepensesHeader`, `ExportFicheButton`.

---

## 17. Style & UX

- Palette dans `tailwind.config.js` :
  - `vtc.bg` : `#080C14` (fond), `#0D1424` (cards), `#1E2D45` (border), `#1A2235` (muted)
  - `vtc.profit` (vert), `vtc.expense` (rouge), `vtc.revenue` (indigo), `vtc.vehicle` (sky), `vtc.alert` (amber)
- Polices : Geist + Geist Mono (variables `--font-geist`, `--font-geist-mono` chargées dans `app/layout.tsx`)
- Dark mode = défaut, contrôlé par classe `dark` sur `<html>` (next-themes), pas par `prefers-color-scheme`
- Animations : framer-motion partout (entrées, hovers, sliding pill du sidebar, transitions de page)
- Responsive : desktop sidebar 256/64 px (collapse persisté en localStorage), mobile bottom nav + sidebar overlay
- Toutes les chaînes UI sont en **français** (la convention dit que les commentaires de code restent en anglais ou français selon le développeur, mais l'UI est exclusivement FR)

---

## 18. Build, dev, déploiement

```bash
npm install              # installe les deps (React 19, Next 16, Supabase, Anthropic SDK…)
npm run dev              # next dev (localhost:3000)
npm run build            # next build
npm run start            # next start (prod local)
npm run lint             # eslint (config eslint-config-next)
```

Déployé sur Vercel (`bigotb9s-projects/vtc-dashboard`, plan Hobby). `next.config.ts` autorise les images du bucket Supabase Storage (`iixpsfsqyfnllggvsvfl.supabase.co/storage/v1/object/public/**`).

`maxDuration` est explicitement défini à 60 s sur les routes IA et la sync Yango pour éviter les timeouts (limite Vercel Pro).

---

## 19. Points d'attention pour les évolutions

1. **L'attribution des recettes est destructive** — `POST /api/recettes/attribution` supprime toutes les lignes de `versement_attribution` puis ré-insère. Sûr car idempotent depuis les sources, mais à ne pas paralléliser.
2. **Les téléphones Wave** sont matchés par les **last 8 digits** uniquement (`numero_wave.replace(/[^0-9]/g, "").slice(-8)`) pour absorber les variantes `+225`, `0`, espaces.
3. **L'historique d'affectation est consulté à la date du versement**, pas à aujourd'hui — c'est ce qui permet d'attribuer correctement une recette tardive à la voiture que le chauffeur conduisait à l'époque.
4. **Le directeur bypass tout** — toute nouvelle action doit être ajoutée à `ALL_ACTIONS` dans `app/parametres/page.tsx` ET vérifiée via `requirePermission()` côté API. Sinon les non-directeurs ne pourront jamais voir/exécuter l'action via la matrice.
5. **L'agent BOYA garde une mémoire long terme** en base. Évolution des prompts/lexique = penser à l'historique cumulé. Marqueur d'extraction : `[MEM]cat|cle|valeur|importance[/MEM]` (la cle est UNIQUE → upsert).
6. **Les routes API qui mutent** doivent appeler `logActivity()` après l'opération (pour que le journal d'activité reste exhaustif).
7. **Le module AI Insights a été retiré le 27/05/2026** — remplacé par `/cockpit` (Cockpit Boyah). La table `ai_insights` et la vue `vue_ai_insights_today` sont conservées en archive mais ne sont plus consommées par aucune page.
8. **Sous-domaine Boyah Transport ≠ Boyah Group** — modèle économique différent (commission 2,5 % vs versement quotidien fixe). Ne pas mélanger les KPIs ou le vocabulaire.
9. **Pour toute opération financière sur les clients sous gestion** : se rappeler que **c'est Boyah qui verse de l'argent AU client**, jamais l'inverse. Le calcul `net_client = montant_mensuel - max(0, depenses - 50 000)` doit être respecté partout (cap à 50 000 FCFA pour la part absorbée par Boyah, surplus déduit du dû au client).
10. **`proxy.ts`** est un middleware stub — à enrichir si on veut filtrer les routes côté Edge avant qu'elles atteignent les pages.

---

## 20. Glossaire express

| Terme | Définition |
|---|---|
| VTC | Voiture de Transport avec Chauffeur |
| CA | Chiffre d'affaires |
| FCFA | Franc CFA (devise locale, 1 € ≈ 655 FCFA) |
| Wave | Mobile money dominant en Côte d'Ivoire (par où les chauffeurs versent) |
| Yango | Plateforme VTC majoritaire à Abidjan (équivalent local d'Uber) |
| Versement | Montant quotidien fixe que le chauffeur reverse à la direction |
| Jour d'exploitation | Lun-sam hors fériés, jour métier d'attribution d'une recette |
| Affectation | Lien chauffeur ↔ véhicule sur une période |
| Manquant | Versement attendu non reçu |
| Justification | Raison métier validant un manquant ou un insuffisant |
| Prestataire | Chauffeur Boyah Transport avec voiture personnelle |
| Sous gestion | Véhicule confié par un client externe à Boyah pour exploitation |
| BOYA | Nom de l'agent IA Telegram |

---

*Documentation générée à partir de la lecture exhaustive du code source.*
