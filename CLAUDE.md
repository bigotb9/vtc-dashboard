# Fleet Boyah Group - Guide projet pour Claude Code

## Projet

**Fleet** est l'application interne de Boyah Group (Abidjan, Côte d'Ivoire) pour la gestion de flotte VTC. Elle gère :

- **Boyah Transport** : flotte VTC partenaire Yango (chauffeurs, véhicules, recettes Wave)
- **Module Clients** : asset management (Clients investisseurs confient des véhicules, Boyah exploite, reverse loyer mensuel net)
- **Module Comptabilité SYSCOHADA** : conforme aux normes OHADA (Bilan, Compte de Résultat, Flux de trésorerie, Notes annexes)

L'utilisateur principal est Emmanuel, fondateur de Boyah Group. Communication en français, terse, directe, concrète.

## Stack technique

- **Framework** : Next.js 15 App Router + TypeScript strict
- **BD** : Supabase (Postgres) avec RLS sur certaines tables (versements_clients en particulier)
- **PDF** : Puppeteer-core local + @sparticuz/chromium sur Vercel via helper `lib/pdf/generatePdf.ts`
- **Auth** : Supabase Auth, propagation via cookies/headers selon les routes
- **Déploiement** : Vercel (prod), localhost:3000 (dev)
- **OS dev** : Windows 11 + PowerShell

## Conventions de code

- TypeScript strict, **0 erreur** sur `npx tsc --noEmit` requise avant push
- Indentation 2 espaces
- Encodage UTF-8 sans BOM, sans REPLACEMENT char, sans NUL byte
- Format monétaire : F CFA avec espaces de milliers (`1 240 000 F`), pas de décimales
- Date format BD : `YYYY-MM-DD` pour les dates, `YYYY-MM` pour les mois
- Libellés opérations cascade : `'Reversement client (mois YYYY-MM)'`, `'Recette Wave - <contrepartie>'`, `'Sortie Wave - <contrepartie>'`

## Commandes utiles

```powershell
# Lancement dev
npm run dev

# Smoke test TypeScript (obligatoire avant push)
npx tsc --noEmit

# Build prod local
npm run build

# Migrations DB : source unique = supabase/migrations/ (CLI Supabase db dump / db push).
# Voir la section "Migrations DB (source unique)" ci-dessous.
```

## Migrations DB (source unique)

**La seule source de migrations DB est `vtc-dashboard/supabase/migrations/`.** Depuis le
re-baseline du 12/06/2026, ce dossier ne contient qu'un fichier :
`00000000000000_baseline.sql` = **état complet de la prod** (53 tables, 37 vues
security_invoker, 36 fonctions, 15 triggers, RLS du 12/06 + helpers
`is_dashboard_user`/`is_dashboard_directeur`, 105 policies public + 28 storage, rôles
`boyahbot_*`, 8 buckets).

- L'ancien `legacy_baseline.sql` + les 38 migrations datées historiques sont dans
  `supabase/migrations/_archive/` (hors chemin actif, conservés pour l'historique).
- **Le repo mobile `app-drivers-fleet-boyahgroup` ne porte plus de migrations DB** :
  ses Phase 2/3 sont dans son propre `_archive/`, ses objets `app_*` sont DANS la
  baseline. Il ne garde que ses Edge Functions (`auth-chauffeur`, `acci-sso-ticket`).
- `supabase/_pending/` = migrations rédigées mais **NON déployées** (ex. Phase 5
  « Signaler ») — hors chemin actif, jamais embarquées par `db push`.
- **Ne JAMAIS `supabase db push` la baseline sur la prod Fleet** (elle décrit un état
  déjà présent). Toute nouvelle migration = nouveau fichier daté **après** la baseline.

## Schéma BD essentiel

### Tables principales

- `caisses` (5 caisses : Wave Boyah, Caisse principale siège, Petite caisse, MTN MoMo, Orange Money) — colonne nom = `libelle`, pas `nom`
- `comptes` (3 comptes bancaires : SGCI, Ecobank, NSIA)
- `operations` : table maîtresse de la compta, type='entree'|'sortie', statut='valide' par défaut, contient `ecriture_id` (lien vers ecritures_comptables)
- `ecritures_comptables` + `lignes_ecritures` : double partie comptable SYSCOHADA
- `recettes_wave` : import CSV Wave brut, colonnes `"Identifiant de transaction"`, `"Horodatage"` (timestamp), `"Montant net"`, `"Nom de contrepartie"`
- `versements_clients` : versements Clients (asset management), avec contrainte UNIQUE(id_client, mois)
- `categories_operations` : catégorisation des opérations, mapping vers comptes SYSCOHADA
- `clients` : 6 Clients investisseurs (Koffi Kouassi, Keita, Fin'elle, Tsoh Eric, Lengue Vanessa, Koffi Aire Edith)
- `vehicules` : 21 véhicules dont sous_gestion=true pour la flotte client
- `tiers` : table compta des contreparties (clients, fournisseurs), avec compte SYSCOHADA 411-XX pour les clients

### Triggers actifs (créés en mai 2026)

1. `trg_cascade_recette_wave` AFTER INSERT/UPDATE sur `recettes_wave`
   - Cas Montant > 0 → operation type='entree' catégorie 'Versement quotidien chauffeur' (7061)
   - Cas Montant < 0 → operation type='sortie' catégorie 'Sortie Wave - à reclasser' (471)
   - Cas Montant = 0 → skip

2. `trg_cascade_versement_to_operation` AFTER INSERT sur `versements_clients`
   - Crée op sortie avec catégorie 'Reversement client sous gestion' (4119)
   - Anti-récursion via vérification NOT EXISTS source_ref

3. `trg_cascade_operation_to_versement` AFTER INSERT sur `operations` WHEN source='versement_client'
   - Crée versement de rattrapage si pas déjà existant
   - Anti-récursion par 2 clés (source_ref + (id_client, mois))

## Pièges connus

### Erreurs PostgreSQL à éviter

- `SUBSTRING(NEW."Horodatage" FROM 1 FOR 10)::DATE` plante car Horodatage est timestamp. Utiliser `NEW."Horodatage"::DATE`
- `ROW_COUNT` direct n'existe pas en PL/pgSQL. Utiliser `GET DIAGNOSTICS v_count = ROW_COUNT` avec déclaration `v_count INT` dans DECLARE
- `ON CONFLICT DO NOTHING` sans cible ne déclenche que sur la primary key. Pour viser une autre colonne, faire `ON CONFLICT (colonne) DO NOTHING` après s'être assuré qu'un index UNIQUE existe

### Erreurs TypeScript courantes

- Coercition `Number()` systématique sur les IDs venant de Supabase (peuvent arriver en string parfois)
- `clientQ` (query builder) ≠ `clients` (résultat de la query). Toujours faire `const clients = (clientsRaw ?? []) as ClientRow[]` après l'await

### RLS et auth

- `versements_clients` a une policy RLS `auth.role() = 'authenticated'`. Pour les routes API server-side qui n'ont pas le contexte user, **utiliser `supabaseAdmin`** (depuis `@/lib/supabaseAdmin`)
- Les autres tables (operations, vehicules, clients, depenses_vehicules) n'ont pas RLS activée

### Puppeteer / PDF

- Sur Vercel/serverless, utiliser `@sparticuz/chromium`
- Sur Windows local, Chrome/Edge système (auto-détecté par `lib/pdf/generatePdf.ts`)
- Option `displayHeaderFooter: false` pour les PDFs Client (Relevé, Justificatif, État des comptes) pour retirer le footer "Page X / Y"
- `puppeteer-core` n'accepte que `waitUntil: "load"` ou `"domcontentloaded"`. Pas `"networkidle0"` qui plante au typecheck.

## Workflow

1. **Spec** : Emmanuel décrit le besoin en langage métier
2. **Brief** : on rédige un brief technique pour Cowork (autre agent) ou on attaque direct
3. **Migrations** : Cowork génère, je lis le SQL, exécute en Supabase Studio, vérifie les NOTICE
4. **Code** : modifications de fichiers Next.js
5. **Smoke test** : `npx tsc --noEmit` obligatoire
6. **Test local** : `npm run dev` + tour visuel
7. **Push** : commit propre avec message multi-lignes

## Important

- **Ne JAMAIS push automatiquement** sans validation explicite d'Emmanuel
- **Ne JAMAIS exécuter une migration SQL** sans avoir d'abord lu le contenu complet et alerté sur les risques
- **Toujours préciser les risques de doublons / récursion** avant un trigger ou un backfill
- **Toujours faire un baseline (COUNT/sum)** avant un backfill pour pouvoir vérifier l'effet après
- Préférer les fichiers existants à la création de nouveaux fichiers quand c'est possible
- **Pas de smoke test automatisé** dans le projet (pas de Jest/Vitest configuré). Le smoke test = `npx tsc --noEmit` + tour visuel manuel
