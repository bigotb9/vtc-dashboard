# Correctif P0-1 (RLS) — Runbook de déploiement & rapport de validation

> Projet Fleet `iixpsfsqyfnllggvsvfl`. Préparé **sans aucune écriture en prod** (introspection lecture seule via MCP), **sans branch** (donc rien de facturé). Tu appliques tout toi-même.
>
> Livrables :
> - **`RLS_P0-1_apply.sql`** — le correctif final, prêt prod (helper → policies → flip vues → ENABLE).
> - **`RLS_P0-1_selftest.sql`** — auto-test transactionnel (BEGIN…ROLLBACK, ne persiste rien) à lancer **avant** l'apply.
> - Ce fichier — rapport, listes exactes, et **dépendances applicatives à traiter avant le flip**.

---

## 1. Modèle de policies retenu

- **Helper `is_dashboard_user()`** (SECURITY DEFINER, cast `auth.uid()` gardé) : `true` ssi le `sub` du JWT correspond à une ligne `profiles`. Un **token chauffeur** (sub entier) ⇒ `false` (il ne doit jamais lire la flotte en direct ; il passe par les RPC `app_chauffeur_*`).
- **Tables flotte** : `SELECT` → `is_dashboard_user()` ; écriture (`ALL`) → `is_directeur()`.
- **`boyahbot_reader` / `boyahbot_writer`** : policies calquées sur leurs **GRANTS réels** (reader lit la flotte + écrit `alertes_envoyees`/`boyahbot_memory` ; writer écrit `alertes_envoyees`/`chauffeurs_yango_snapshot`/`records_flotte`).
- **`service_role`** (routes API en `supabaseAdmin`) et **RPC `app_chauffeur_*`** (DEFINER owner=postgres) : **bypass RLS**, inchangés.
- **37 vues** passées en `security_invoker = on` (sinon elles continueraient de contourner la RLS).
- Les **6 tables `app_*`** (RLS déjà OK, scopée par claim `id_chauffeur`) ne sont **pas** touchées.

---

## 2. Périmètre exact traité

### 2.1 — 23 tables `ENABLE ROW LEVEL SECURITY` (jamais FORCE)
`clients`, `vehicules`, `chauffeurs`, `recettes_wave`, `depenses_vehicules`, `versement_attribution`, `commandes_yango`, `justifications_versement`, `jours_feries`, `entretiens`, `affectation_chauffeurs_vehicules`, `taches_suivi`, `versements_chauffeurs`, `calendrier`, `wave_fr`, `clients_documents`, `chauffeurs_yango_snapshot`, `records_flotte`, `alertes_envoyees`, `agent_analyses`, `agent_conversations`, `agent_memory`, `boyahbot_memory`.

### 2.2 — 37 vues → `security_invoker = on`
`alerte_assurance`, `alerte_pneus`, `alerte_vidange`, `alerte_visite_technique`, `alertes_vehicules`, `chauffeurs_actifs`, `chauffeurs_inactifs`, `classement_chauffeurs`, `cout_reel_vehicule`, `depenses_anormales`, `depenses_recurrentes`, `prevision_ca_mensuel`, `prevision_depenses`, `vue_ca_chauffeur_jour`, `vue_ca_journalier`, `vue_ca_mensuel`, `vue_ca_vehicule_aujourdhui`, `vue_ca_vehicule_jour`, `vue_ca_vehicule_mois`, `vue_ca_vehicules`, `vue_chauffeurs_vehicules`, `vue_dashboard_depenses`, `vue_dashboard_recettes`, `vue_dashboard_vehicules`, `vue_depenses_aujourdhui`, `vue_depenses_categories`, `vue_depenses_journalieres`, `vue_depenses_mensuelles`, `vue_depenses_mois`, `vue_depenses_par_categorie`, `vue_depenses_par_vehicule`, `vue_objectif_vehicules`, `vue_profit_journalier`, `vue_recettes_chauffeurs`, `vue_recettes_vehicules`, `vue_top_vehicule_depenses`, `vue_voitures_payees`.

Tables de base sous-jacentes (toutes couvertes par les policies) : `vehicules`, `recettes_wave`, `chauffeurs`, `depenses_vehicules`, `affectation_chauffeurs_vehicules`, `versements_chauffeurs`.

---

## 3. 🔴 PRÉ-REQUIS APPLICATIF — à traiter AVANT/AVEC le flip (sinon l'app casse)

L'auto-test valide la couche **base** (rôles, RLS, vues, RPC). Il ne voit pas la couche **HTTP**. Or **des routes API lisent/écrivent les tables flotte via le client _anon_** (`@/lib/supabaseClient`) et non `supabaseAdmin`. Une fois la RLS active, le rôle `anon` n'a **aucune policy** → ces routes renvoient **vide** (lectures) ou **échouent** (écritures).

**18 routes concernées** (importent le client anon et l'utilisent pour des opérations données) :
`app/api/clients/route.ts`, `app/api/clients/list/route.ts`, `app/api/vehicules/list/route.ts`, `app/api/vehicules/create/route.ts`, `app/api/vehicules/update/route.ts`, `app/api/chauffeurs/list/route.ts`, `app/api/chauffeurs/create/route.ts`, `app/api/chauffeurs/update/route.ts`, `app/api/affectations/route.ts`, `app/api/taches/route.ts`, `app/api/entretiens/route.ts`, `app/api/depenses/create/route.ts`, `app/api/recettes/create/route.ts`, `app/api/recettes/import/route.ts`, `app/api/yango/orders/route.ts`, `app/api/yango/sync-orders/route.ts`, `app/api/boyah-transport/dashboard-stats/route.ts`, `app/api/boyah-transport/driver-stats/route.ts`.

**Cas RPC aggravant** : `boyah_dashboard_stats`, `boyah_driver_stats`, `boyah_commission_for_month` sont **`SECURITY INVOKER`** et lisent `commandes_yango`. Appelées via le client anon (`dashboard-stats`, `driver-stats`), elles renverront **0** sous RLS → dashboard Boyah Transport vide.

**Remède (recommandé)** : basculer ces routes sur **`supabaseAdmin`** (elles gardent leur garde `requirePermission` pour l'autorisation ; le service_role bypass la RLS et la RPC en hérite). Alternative pour les RPC : les passer `SECURITY DEFINER` + `SET search_path = public, pg_temp` (elles ne font que de la lecture agrégée). 

> Les 2 routes `vehicules/update` & `chauffeurs/update` sont de toute façon déjà à corriger (P0-2 : mutation sans auth) — profite-en pour les passer en `supabaseAdmin` + `requirePermission`.

**Ordre de bascule conseillé** : (1) convertir/auditer les 18 routes → `supabaseAdmin` ; (2) déployer l'app ; (3) lancer l'auto-test ; (4) appliquer `RLS_P0-1_apply.sql` ; (5) tour visuel (dashboard, véhicules, chauffeurs, Boyah Transport, app mobile).

---

## 4. Rapport de validation — résultats ATTENDUS

Baselines mesurées sur la prod réelle (lecture seule, 12/06/2026) :
`clients=7 · vehicules sous_gestion=10 · commandes_yango=65804 · vue_recettes_vehicules=618 · entretiens huile_moteur=18 · alertes_envoyees=210 · versements_clients M-1=0`.

L'auto-test imprime ces lignes (NOTICE). **Tout doit être `[PASS]`** :

| Test | Rôle | Attendu | Sens |
|---|---|---|---|
| T1a | anon | `clients = 0` | **fuite colmatée** (était 7 en lecture libre) |
| T1b | anon | `vue_recettes_vehicules = 0` | vue ne fuit plus (security_invoker) |
| T2a–f | boyahbot_reader | `7 / 10 / 65804 / 618 / 18 / 210` | bot **inchangé** (mêmes comptes) |
| T3a | boyahbot_writer | INSERT `alertes_envoyees` OK | écriture bot préservée |
| T3b | boyahbot_writer | `clients = 0` | writer ne lit pas la flotte |
| T4a–c | dashboard (directeur) | `7 / 618 / 0` | dashboard **inchangé** (tables + vues) |
| T5a | token chauffeur | `clients = 0` | un chauffeur ne lit pas la flotte en direct |
| T5b | token chauffeur | `app_chauffeur_home ok=true`, véhicule présent | **RPC app intacte** (DEFINER bypass) |
| T5c | token chauffeur | `app_chauffeur_versements ok=true` | RPC app intacte |

Si **un seul** test affiche `[FAIL]`, ne pas appliquer : me renvoyer la sortie NOTICE, je corrige le SQL.

---

## 5. Non-persistance

L'auto-test est **un seul `BEGIN … ROLLBACK`** (aucun `COMMIT`). Rien ne survit. Après exécution, la section commentée en bas de `RLS_P0-1_selftest.sql` (à dé-commenter) prouve l'absence de résidu : `rls_on=false`, helper absent, 0 policy `_selftest`.

---

## 6. Durcissement optionnel (après coup)

`anon`/`authenticated` ont aujourd'hui **tous les droits DML** sur les tables flotte (ex. `clients` : INSERT/UPDATE/DELETE). La RLS les neutralise déjà (aucune policy `anon`), mais un `REVOKE` des grants superflus (bloc commenté en fin de `RLS_P0-1_apply.sql`) ajoute une défense en profondeur.

---

## 7. Récap exécution

```
1. Convertir les 18 routes anon → supabaseAdmin (+ corriger P0-2 update routes)   [code]
2. Déployer l'app
3. psql/Studio : exécuter RLS_P0-1_selftest.sql  → vérifier 100 % [PASS]           [DB, rollback]
4. psql/Studio : exécuter RLS_P0-1_apply.sql      → COMMIT                          [DB, fenêtre calme]
5. Tour visuel : dashboard, véhicules, chauffeurs, Boyah Transport, app mobile
6. (optionnel) REVOKE des grants anon superflus
```

Aucune branch créée → rien à supprimer, rien de facturé.
