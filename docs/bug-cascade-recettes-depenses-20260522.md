# Bug critique cascade legacy → operations — 22 mai 2026

**Statut** : diagnostic complet · fix proposé · attente validation Emmanuel avant application.

---

## 1. Diagnostic — il n'y a PAS de bug logiciel

### 1.1 État du code applicatif

Les 3 routes API qui devraient déclencher la cascade sont **TOUTES intactes et correctes** :

| Route | Code cascade | Dernière modification |
|---|---|---|
| `app/api/recettes/import/route.ts` | Appelle `repriseRecettesWave(auth.user.id, { date_from: minHorodatage, date_to: maxHorodatage })` après l'`upsert` legacy. Log warnings/failed via `logActivity`. | **17 mai 23:42** (patch v3 sync legacy) |
| `app/api/recettes/create/route.ts` | Idem (cascade sur la journée de l'horodatage) | **17 mai 23:42** |
| `app/api/depenses/create/route.ts` | Appelle `repriseDepensesVehicules` après l'INSERT legacy | **18 mai 14:19** |

**Aucun commit code entre le 19/05 22:51 et aujourd'hui 22/05** (dernière modif applicative = `lib/compta/reprise.ts` à 22:51 le 19/05 = les 3 fixes v3). Le code n'a donc pas changé entre le moment où la cascade fonctionnait (recette `T_AZGJWJTIV3RNJE6N` du 20/05 07:15) et le moment où elle a "cessé" (recette `T_AQR3XODPLR2CZX4G` du 20/05 08:34).

### 1.2 État des triggers SQL — la cascade n'est PAS côté Postgres

- **Sur `recettes_wave`** : aucun trigger (confirmé par Emmanuel via `information_schema.triggers`)
- **Sur `depenses_vehicules`** : à confirmer mais quasi-certainement aucun (les migrations Fleet ne créent rien dessus)
- **Sur `operations`** : `trg_sync_operation_to_legacy` (Vague 3.6) existe et fonctionne dans le sens **inverse** (operations → legacy), uniquement pour `source='manuel'`. Ce trigger ne crée PAS d'op à partir d'une recette/dépense legacy.

→ **Le mécanisme de cascade est exclusivement applicatif** (passe par les routes API Next.js). Si une recette est insérée dans `recettes_wave` par un AUTRE moyen que `/api/recettes/import` ou `/api/recettes/create`, la cascade ne se déclenche jamais.

### 1.3 Preuve de la cause racine

**La recette `T_AQR3XODPLR2CZX4G`** (première orpheline selon le brief, Horodatage Wave = 2026-05-20 08:34:27) :
- A été **insérée dans `recettes_wave` à `created_at = 2026-05-20 13:40:09`** — soit ~5h après son Horodatage Wave et plus de 2h après le passage du bouton sparkle de 11:14
- **Aucun log `compta.reprise_auto.*` dans `activity_logs` autour de 13:40** → ce qui veut dire que la route `/api/recettes/import` n'a pas été appelée (sinon elle aurait loggué `compta.reprise_auto.warnings` ou `compta.reprise_auto.failed` au minimum, et `attributions_count` via toast)
- **Aucun log `create_recette` dans `activity_logs`** à ce moment → ce qui veut dire que la route `/api/recettes/create` n'a pas été appelée non plus

**Donc la recette a été insérée directement dans la BD** via un canal qui n'est ni `/api/recettes/import`, ni `/api/recettes/create`.

### 1.4 Source possible de l'INSERT direct

| Source candidate | Probabilité | Notes |
|---|---|---|
| **Supabase Studio (insert manuel SQL)** | élevée | Emmanuel a manipulé la BD manuellement plusieurs fois ces derniers jours (rattrapages, suppressions, ajouts). Si un INSERT direct dans `recettes_wave` a été fait, aucune cascade ne s'est déclenchée. |
| **Workflow n8n externe** | faible | Aucun des 4 workflows dans `n8n-workflows/*.json` ne touche à `recettes_wave` (vérifié par grep). |
| **Webhook Wave Business externe** | faible-moyenne | Aucun endpoint Wave webhook n'est défini dans le code Fleet. Mais un webhook configuré côté Wave qui POST directement vers Supabase REST API (PostgREST) bypasserait l'API Fleet et la cascade. |
| **Edge Function Supabase** | nulle | Aucun dossier `supabase/functions/` dans le repo |
| **pg_cron** | inconnue | À vérifier (commande `SELECT * FROM cron.job;` si l'extension est installée) |
| **Script Python/bash externe** | élevée | Si un script tourne sur un serveur externe pour importer des recettes Wave périodiquement, il a probablement été modifié ou simplement utilisé sans passer par l'API Fleet |

**Hypothèse principale** : un workflow externe (cron sur serveur tiers, script Python, n8n hors repo, ou webhook Wave directement vers PostgREST) a commencé à insérer les recettes_wave **directement en BD** à partir du 20/05 ~13h. Avant cela, c'était probablement l'utilisateur qui uploadait manuellement le CSV via `/recettes/create` (page UI qui appelle `/api/recettes/import`), donc la cascade se déclenchait.

---

## 2. Flux 2 — Dépenses véhicules

### 2.1 Vérification à mener côté Emmanuel

À exécuter dans Supabase SQL Editor (« No limit » obligatoire) :

```sql
-- Détection des dépenses orphelines (absence d'op correspondante)
SELECT 
  COUNT(*) AS total_depenses,
  COUNT(o.id) AS avec_operation,
  MAX(d.date_depense) FILTER (WHERE o.id IS NOT NULL) AS derniere_depense_avec_op,
  MIN(d.date_depense) FILTER (WHERE o.id IS NULL AND d.date_depense >= '2026-05-15') AS premiere_depense_orpheline_post_15
FROM depenses_vehicules d
LEFT JOIN operations o ON o.source = 'depense_vehicule'
                       AND o.source_ref = d.id_depense::varchar
WHERE d.date_depense >= '2026-02-09';

-- Liste détaillée des dépenses orphelines
SELECT d.id_depense, d.date_depense, d.montant, d.type_depense, d.description,
       d.id_vehicule, d.created_at
FROM depenses_vehicules d
WHERE NOT EXISTS (
  SELECT 1 FROM operations o
  WHERE o.source = 'depense_vehicule' AND o.source_ref = d.id_depense::varchar
)
ORDER BY d.created_at;
```

### 2.2 Ce que mes données indiquent (CSV jusqu'au 18/05)

Mon export CSV `operations` s'arrête à `created_at = 2026-05-20 11:14:18` (l'exécution du bouton sparkle). Mais Aurea a créé **5 dépenses le 20/05 entre 13:02 et 13:26** (vu dans `activity_logs` : Pneus 24k, dép administrative 5k, Batterie 25k, Kit d'embrayage 80k, Huile de boite 5k). Ces dépenses **devraient avoir leurs ops** si `/api/depenses/create` a fonctionné — mais elles sont hors de la fenêtre de mon CSV operations, donc je ne peux pas vérifier sans le SQL ci-dessus.

**Indice positif** : aucun log `compta.reprise_auto.failed` n'apparaît dans `activity_logs` à 13:02-13:26 → si la cascade avait planté côté Aurea, on aurait un log. Donc soit la cascade a réussi (op créée), soit le `try/catch` a avalé silencieusement (peu probable car le `catch` log toujours).

→ **Vérifier avec le SQL §2.1**. Mon hypothèse : les ops d'Aurea du 20/05 13h existent bien (le Flux 2 fonctionne dans le sens `/api/depenses/create`), mais le bug est asymétrique → Flux 1 cassé par la source d'INSERT externe, Flux 2 OK car personne n'insère directement dans `depenses_vehicules` hors API.

---

## 3. Flux 3 — Sens inverse `operations → depenses_vehicules`

### 3.1 Qui est la source de vérité

D'après la migration `20260517000000_sync_operations_to_legacy.sql` (Vague 3.6) :

```sql
CREATE TRIGGER trg_sync_operation_to_legacy
  AFTER INSERT OR UPDATE OR DELETE ON public.operations
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_operation_to_legacy();
```

Le trigger est **AFTER sur `operations`** et synchronise vers `depenses_vehicules` / `recettes_wave` uniquement quand `source='manuel'`. Donc :

| Sens | Trigger | Quand |
|---|---|---|
| `depenses_vehicules` → `operations` | **Code applicatif** (`/api/depenses/create` ou reprise) | À chaque INSERT dans `depenses_vehicules` via l'API Fleet |
| `operations` → `depenses_vehicules` | **Trigger SQL** `trg_sync_operation_to_legacy` | À chaque INSERT/UPDATE/DELETE sur `operations` avec `source='manuel'` |

**Conclusion** : c'est BIDIRECTIONNEL mais ASYMÉTRIQUE :
- Côté `depenses_vehicules` → `operations` : déclenché par le code (API Fleet)
- Côté `operations` → `depenses_vehicules` : déclenché par le trigger SQL (pour `source='manuel'` uniquement)

L'ajustement manuel de 3,66 M F (le 19/05 sur Wave Boyah) que tu as vu hier dans les 2 tables avec le même UUID : c'était une op `source='manuel'` créée dans `operations`, et le trigger SQL a propagé vers `depenses_vehicules` côté sortie (cohérent).

→ **Pour les recettes/dépenses légitimes (non-manuel)** : la source de vérité est la table legacy (`recettes_wave` ou `depenses_vehicules`), et la cascade vers `operations` doit être faite explicitement par le code applicatif. **C'est précisément ce qui s'est cassé** : si l'INSERT dans `recettes_wave` est fait hors API, aucune cascade n'a lieu.

---

## 4. Approche pour rattraper les orphelines

### 4.1 Méthode recommandée — réutiliser la route existante

Plutôt qu'un script SQL ad-hoc, **réutiliser la route `/api/compta/reprise/recettes-wave`** qui appelle `repriseRecettesWave` avec gestion des warnings et idempotence garantie par la dédup manuelle (fix v3 du 19/05).

```bash
# Trigger via curl (token directeur requis)
curl -X POST https://fleet.boyahgroup.com/api/compta/reprise/recettes-wave \
  -H "Authorization: Bearer $TOKEN_DIRECTEUR" \
  -H "Content-Type: application/json" \
  -d '{"date_from":"2026-05-20","date_to":"2026-05-22"}'
```

OU plus simple, le bouton sparkle dans le widget `SuiviVersementsWidget` du dashboard (icône Sparkles) qui fait la même chose.

**Avantages** :
- Idempotent (UNIQUE source/source_ref + dédup manuelle dans `lib/compta/reprise.ts`)
- Aucun risque de doublon
- Crée les 4 éléments cascade (operation + ecriture + 2 lignes) en mode Avancé
- Cas particulier "Moussa K" (T_OM6JQTPNPQAVGT3R) : sera skippée avec `skipped_no_chauffeur=1` → comportement attendu, à traiter séparément si tu veux la rattraper

### 4.2 Pour les dépenses orphelines (si le diagnostic §2.1 en révèle)

```bash
curl -X POST https://fleet.boyahgroup.com/api/compta/reprise/depenses \
  -H "Authorization: Bearer $TOKEN_DIRECTEUR" \
  -d '{"date_from":"2026-05-20","date_to":"2026-05-22"}'
```

### 4.3 Pour rattraper les écritures comptables manquantes

Si la cascade Flux 1 a créé l'op mais pas l'écriture (mode Avancé désactivé temporairement, ou échec de génération) :

```bash
curl -X POST https://fleet.boyahgroup.com/api/compta/operations/regenerer-ecritures \
  -H "Authorization: Bearer $TOKEN_DIRECTEUR" \
  -d '{"source":"recette_wave","date_from":"2026-05-20","date_to":"2026-05-22"}'
```

(Endpoint livré dans le patch v2 sync legacy le 18/05)

---

## 5. Proposition de fix durable

3 options classées par robustesse :

### Option A — Trigger SQL `BEFORE INSERT ON recettes_wave` (la plus robuste)

Créer un trigger Postgres qui matérialise la cascade indépendamment du chemin d'INSERT.

**Avantage** : fonctionne quelle que soit la source (API Fleet, Supabase Studio, n8n, webhook Wave direct, script externe). C'est la solution standard en architecture event-sourcing.

**Inconvénient** : duplique la logique de `repriseRecettesWave` (fixtures, exercices, dédup) en PL/pgSQL. Maintenir 2 versions synchronisées est risqué.

**À écrire** : ~150 lignes de PL/pgSQL + 1 migration.

### Option B — Cron Vercel toutes les 15 min (pragmatique)

Configurer un Vercel Cron qui appelle automatiquement `/api/compta/reprise/all` toutes les 15 minutes pour rattraper les orphelines.

```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/cascade-rattrapage", "schedule": "*/15 * * * *" }
  ]
}
```

**Avantage** : pas de duplication de code, latence max 15 min, zéro modification de la logique métier.

**Inconvénient** : latence (les orphelines existent 15 min max avant rattrapage). Solde Wave Boyah temporairement faux pendant la fenêtre.

**À écrire** : ~30 lignes (route `/api/cron/cascade-rattrapage` qui wrap les fonctions existantes) + entry `vercel.json`.

### Option C — Identifier la source d'INSERT externe et la rediriger vers l'API (process)

Trouver ce qui insère dans `recettes_wave` sans déclencher la cascade, et le faire passer par `/api/recettes/import`.

**Avantage** : zéro nouveau code, garde l'architecture simple.

**Inconvénient** : nécessite d'identifier le workflow externe (qui peut être un script Python sur un serveur tiers, un n8n caché, etc.). Sans accès à cette infrastructure, impossible.

### Ma recommandation

**Option B + Option C en parallèle** :
1. **Court terme** (aujourd'hui) : exécuter manuellement le bouton sparkle pour rattraper les 16 + dépenses orphelines (cf. §4.1)
2. **Court terme** (cette semaine) : ajouter le **Cron Vercel** comme garde-fou (Option B, ~30 min de dev)
3. **Moyen terme** : enquête côté Emmanuel pour identifier la source d'INSERT externe et la corriger (Option C)
4. **Long terme** (Wave Business intégration future, cf. analyse comparative Wave du 18/05) : webhook officiel Wave qui POST vers `/api/webhooks/wave/recette` (au lieu de PostgREST direct), avec idempotence + signature HMAC → ce sera la solution permanente.

---

## 6. Smoke test post-fix

Après application des correctifs (rattrapage + Cron) :

```sql
-- Vérification post-rattrapage : 0 orpheline
WITH orph AS (
  SELECT rw."Identifiant de transaction"
  FROM recettes_wave rw
  LEFT JOIN operations o ON o.reference_externe = rw."Identifiant de transaction"
                         AND o.source = 'recette_wave'
  WHERE o.id IS NULL AND rw."Horodatage" >= '2026-05-20'
)
SELECT COUNT(*) AS recettes_orphelines FROM orph;
-- Attendu : 0 (ou 1 = Moussa K si skippée volontairement)

-- Vérification écritures comptables liées
SELECT o.id, o.reference_externe, o.ecriture_id,
       (SELECT COUNT(*) FROM lignes_ecritures WHERE ecriture_id = o.ecriture_id) AS nb_lignes
FROM operations o
WHERE o.source = 'recette_wave'
  AND o.date_operation >= '2026-05-20'
ORDER BY o.date_operation;
-- Attendu : chaque op a ecriture_id non null et nb_lignes = 2
```

Test d'INSERT live (à exécuter au moment du fix Option B/C) :

```bash
# 1. Insérer une recette de test dans recettes_wave
INSERT INTO recettes_wave ("Identifiant de transaction", "Horodatage", "Montant net", "Nom de contrepartie")
VALUES ('T_TEST_CASCADE_20260522', NOW(), 1000, 'Test cascade');

# 2. Attendre 15 min max (si Cron) ou trigger le bouton sparkle

# 3. Vérifier que l'op existe
SELECT * FROM operations WHERE reference_externe = 'T_TEST_CASCADE_20260522';

# 4. Cleanup
DELETE FROM operations WHERE reference_externe = 'T_TEST_CASCADE_20260522';
DELETE FROM recettes_wave WHERE "Identifiant de transaction" = 'T_TEST_CASCADE_20260522';
```

---

## 7. Récapitulatif des actions

| # | Action | Qui | Quand | Effort |
|---|--------|-----|-------|-------:|
| 1 | Exécuter SQL diagnostic Flux 2 (§2.1) pour confirmer si dépenses orphelines | Emmanuel | Aujourd'hui | 1 min |
| 2 | Cliquer bouton sparkle (ou appel curl §4.1) pour rattraper les 16 recettes orphelines | Emmanuel | Aujourd'hui | 1 min |
| 3 | (Si Flux 2 confirmé orphelines) Idem pour les dépenses (§4.2) | Emmanuel | Aujourd'hui | 1 min |
| 4 | (Si écritures manquantes) Appel `/api/compta/operations/regenerer-ecritures` (§4.3) | Emmanuel | Aujourd'hui | 2 min |
| 5 | Vérification smoke test §6 | Emmanuel | Aujourd'hui | 2 min |
| 6 | **Décision sur l'Option de fix durable** (A / B / C / mix) | Emmanuel | Cette semaine | discussion |
| 7 | Implémentation de l'option choisie | Cowork | Sur validation | A=2h / B=30min / C=variable |
| 8 | Identifier la source d'INSERT externe (Supabase Studio ? n8n caché ? webhook ? script ?) | Emmanuel | Cette semaine | enquête |

---

## 8. Hors périmètre confirmé

- ❌ Pas de modification de `recettes_wave` ou `depenses_vehicules`
- ❌ Pas de modification du trigger `trg_sync_operation_to_legacy`
- ❌ Pas de modification du code applicatif des routes API (elles sont correctes)
- ❌ Pas de résurrection de `AlertesPaiements.tsx` ou `PaiementVehicules.tsx`

---

## 9. Annexe — Données de référence collectées

| Élément | Valeur |
|---|---|
| Dernière recette avec op (cascade OK) | T_AZGJWJTIV3RNJE6N · 20/05 07:15:49 |
| Première orpheline | T_AQR3XODPLR2CZX4G · 20/05 08:34:27 (Horodatage) · **created_at 20/05 13:40:09** |
| Total orphelines (recettes) | 16 · 369 971 F |
| Solde Wave Boyah actuel | 1 896 077 F |
| Solde Wave Boyah cible | 2 266 048 F (après cascade des 16) |
| Dernière op `source='depense_vehicule'` créée (mon CSV) | 18/05 11:21:09 (date_op = 15/05) |
| Dépenses Aurea du 20/05 13h (5 ops) | À vérifier dans Flux 2 |
| Trigger SQL sur `recettes_wave` | **0** (confirmé) |
| Trigger SQL sur `operations` | `trg_sync_operation_to_legacy` (sens inverse, source='manuel' uniquement) |
| Dernier commit code applicatif cascade | 19/05 22:51 (`lib/compta/reprise.ts` patch v3) |
| Action utilisateur entre 07:15 et 08:34 le 20/05 dans activity_logs | **AUCUNE** |
