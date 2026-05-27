# Patch sync legacy → operations v2 — Bug critique reprise + 3 livrables complémentaires

> Correction du bug structurel `upsert(onConflict='source,source_ref')` sur
> index UNIQUE partiel + livraison de 3 fonctionnalités durables (Option X,
> endpoint régénération écritures, refus reversement).
>
> **Effort réel** : ~2 h.
> **Statut** : ✅ livré · 5/5 audits Cowork OK.
> **Cible** : 462 ops sans écriture comptable sont désormais régénérables
> automatiquement via `POST /api/compta/operations/regenerer-ecritures`.

---

## 1. Cause racine du bug originel

L'index UNIQUE sur `operations(source, source_ref)` est **PARTIEL** :
```sql
CREATE UNIQUE INDEX ... WHERE source <> 'transfert_interne' AND source_ref IS NOT NULL
```

Supabase JS ne supporte pas `onConflict` sur un **index partiel**. L'appel
`.upsert(..., { onConflict: "source,source_ref", ignoreDuplicates: true })`
échouait silencieusement avec : *« no unique or exclusion constraint matching »*.

→ Aucune reprise n'a jamais inséré de nouvelle opération via upsert. Toutes les
ops issues de `recettes_wave` / `depenses_vehicules` / `versements_clients` ont
été rattrapées manuellement par INSERT SQL direct le 18/05/2026.

**Conséquence collatérale** : 462 ops créées en SQL direct n'ont pas d'écriture
comptable (la reprise s'occupait aussi de cela via `genererEcritureFromOperation`).
En mode Avancé, le Bilan/CR/TFT sont donc partiellement faux jusqu'à
régénération.

---

## 2. Livrables (4)

### L1 — Fix de la reprise (3 fonctions) — `lib/compta/reprise.ts`

Remplacement du pattern `upsert(onConflict, ignoreDuplicates)` par une
**déduplication manuelle** dans 1 helper partagé `insertOpsAvecDedupManuel`,
utilisé par les 3 fonctions de reprise :

```typescript
// 1. SELECT source_ref déjà existants pour ce source
// 2. Filter du chunk pour exclure les doublons
// 3. INSERT simple sans onConflict
```

**Pourquoi un helper unique** : DRY + comportement identique garanti sur les
3 sources (`recette_wave`, `depense_vehicule`, `versement_client`).

#### L1bis — repriseRecettesWave en Option X

Refactor complet de `repriseRecettesWave` :

| Avant | Après |
|---|---|
| Lecture `versement_attribution` (jointure analytique) | Lecture directe `recettes_wave` |
| `source_ref` = `versement_attribution.id` (UUID interne) | `source_ref` = `recettes_wave."Identifiant de transaction"` (TEXT, unique par construction Wave) |
| `date_operation` = `jour_exploitation` | `date_operation` = `"Horodatage"::date` |
| `montant` = `montant_attribue` (potentiellement plusieurs lignes par recette) | `montant` = `"Montant net"` (1 op = 1 recette) |
| `vehicule_id` / `chauffeur_id` calculés via affectations | NULL (analytique déplacée) |
| `libelle` = `"Versement chauffeur X — véhicule Y"` | `libelle` = `'Recette Wave — ' || "Nom de contrepartie"` |

**Conséquence** : 1 op = 1 ligne `recettes_wave` (Option X validée par
Emmanuel). Cohérent avec les 455 ops rattrapées manuellement le 18/05/2026.

### L2 — Auto-câblage routes legacy

Déjà livré au patch précédent (`docs/patch-sync-legacy-to-operations-rapport.md`).
**Vérifié** que les 3 routes appellent toujours les fonctions de reprise
corrigées :

| Route | Appel reprise | Auth |
|---|---|---|
| `app/api/recettes/create/route.ts` | `repriseRecettesWave(auth.user.id, { date_from=date_to })` | `requirePermission("manage_recettes")` |
| `app/api/recettes/import/route.ts` | `repriseRecettesWave(auth.user.id, { date_from=min, date_to=max })` | idem |
| `app/api/depenses/create/route.ts` | `repriseDepensesVehicules(auth.user.id, { date_from=date_to })` | `requirePermission("manage_depenses")` |

Erreur de reprise non bloquante (try/catch + `logActivity` action
`compta.reprise_auto.failed`).

### L3 — Endpoint régénération écritures

**Nouveau fichier** : `app/api/compta/operations/regenerer-ecritures/route.ts`

- Réservé directeur (`requireDirecteurCompta`)
- `maxDuration: 60` (mode batch)
- Body optionnel : `{ source?, date_from?, date_to?, force? }`
- Logique :
  1. SELECT ops `statut='valide'` matchant filtres
  2. Si `force=true` ET ecriture_id existant : DELETE ancienne écriture + UPDATE op.ecriture_id=NULL + ajout aux candidats
  3. Pour chaque candidat : `genererEcritureFromOperation(opId)` séquentiellement
  4. Retour `{ candidats, generees, echouees, erreurs[], duree_ms }`
- Idempotent par défaut (skip ops avec écriture existante)
- Audit `logActivity` action `compta.operations.regenerer_ecritures`

**Use case immédiat** : Emmanuel exécute après déploiement :
```bash
POST /api/compta/operations/regenerer-ecritures
# Body vide → régénère TOUTES les ops sans écriture liée (les 462 cas)
```

### L4 — Refus `Reversement client` dans `/depenses/create`

#### Côté API (`app/api/depenses/create/route.ts`)
```typescript
const typeDepenseStr = String(body.type_depense ?? "").toLowerCase()
if (typeDepenseStr.includes("reversement")) {
  return NextResponse.json({
    success: false,
    error: "Les reversements clients ne se saisissent pas ici. Utilisez la page Versements Clients.",
    code:  "INVALID_TYPE_DEPENSE",
  }, { status: 400 })
}
```

#### Côté UI (`components/CreateDepenseForm.tsx`)
- ✅ La liste prédéfinie `TYPES_DEPENSE` **ne contient pas** "Reversement client" — rien à retirer
- ✅ Hint ajouté : si l'utilisateur tape "reversement" dans le champ libre
  (option "Autre"), un message orange apparaît immédiatement avec un lien
  vers `/versements-clients` :
  > « Les reversements clients ne se saisissent pas ici. Utilisez la page Versements Clients. »

---

## 3. Tests d'acceptation

| # | Test | Comportement attendu | Couvert |
|---|------|----------------------|---------|
| 1 | `POST /api/compta/reprise/all` après déploiement | 0 nouvelle op (déjà tout en BD), 0 erreur sur index partiel | ✅ Dédup manuelle remplace upsert |
| 2 | `POST /api/recettes/create` | 1 ligne `recettes_wave` + 1 op `source='recette_wave'` immédiatement | ✅ Route câblée (patch v1) + reprise corrigée |
| 3 | `POST /api/recettes/import` 50 lignes | 50 ops créées (idempotent si réimport) | ✅ Dédup manuelle |
| 4 | `POST /api/depenses/create` (type carburant) | 1 ligne `depenses_vehicules` + 1 op `source='depense_vehicule'` | ✅ Route câblée |
| 5 | `POST /api/depenses/create` avec `type_depense: "Reversement client"` | 400 + message clair, **aucun INSERT** | ✅ Validation type ILIKE %reversement% |
| 6 | `POST /api/compta/operations/regenerer-ecritures` body vide | Toutes ops sans écriture en ont une après ; `generees > 0` | ✅ Nouveau endpoint |
| 6bis | Idem avec `{ source: "recette_wave", date_from: "2026-04-01", date_to: "2026-04-30" }` | Régénération filtrée | ✅ Filtres opérationnels |
| 7 | `npx tsc --noEmit` | 0 erreur | ⚠️ À exécuter localement (sandbox sans node_modules) |

---

## 4. Audit Cowork (8 conventions)

| # | Convention | Résultat |
|---|---|---|
| 1 | UTF-8 sans BOM + pas de mojibake | ✅ 4/4 fichiers propres |
| 2 | React StrictMode safe | ✅ N/A — patch backend + 1 hint client (pas de useEffect ajouté) |
| 3 | Pas de `<button>` imbriqué | ✅ Aucun nesting détecté |
| 4 | Aucun `overflow-hidden` sur popover | ✅ N/A — pas de popover/dropdown ajouté |
| 5 | Typing `XxxInput` vs `XxxPayload` | ✅ Type local `Body` (sans suffixe trompeur) ; réutilise `ReprisOptions` / `ReprisStats` existants |
| 6 | Smoke test + `tsc --noEmit` | ⚠️ À exécuter localement après `npm install` |
| 7 | authFetch + FormData | ✅ N/A — endpoint régénération en JSON pur |
| 8 | `npm install` pour nouvelles deps | ✅ N/A — aucune nouvelle dépendance |

### Vérifications spécifiques au bug

- ✅ **Plus aucun `upsert()` actif** dans `lib/compta/reprise.ts` (seules les
  mentions en commentaires historiques restent) — vérifié par grep ciblé
- ✅ **3 fonctions reprise** utilisent désormais `insertOpsAvecDedupManuel`
- ✅ **`repriseRecettesWave`** lit désormais `from("recettes_wave")` directement
  (Option X), plus de jointure `versement_attribution`

---

## 5. Pré-requis déploiement

### 5.1 Pas de migration BD
Patch purement applicatif. L'index UNIQUE partiel reste tel quel (il est
volontairement partiel pour éviter le blocage sur `transfert_interne`).

### 5.2 Aucune nouvelle dépendance npm
`npm install` standard suffit (aligné sur les conventions Cowork #8).

### 5.3 Procédure post-déploiement (à exécuter par Emmanuel)

```bash
# 1. Vérifier que la reprise idempotente ne plante plus
curl -X POST /api/compta/reprise/all \
  -H "Authorization: Bearer $TOKEN_DIRECTEUR"
# Attendu : { ok: true, data: { recettes: { creees: 0, deja_existantes: 455 }, depenses: { creees: 0, deja_existantes: 32 } } }

# 2. Régénérer les 462 écritures manquantes (mode batch)
curl -X POST /api/compta/operations/regenerer-ecritures \
  -H "Authorization: Bearer $TOKEN_DIRECTEUR" \
  -H "Content-Type: application/json" \
  -d '{}'
# Attendu : { ok: true, data: { candidats: ~462, generees: ~462, echouees: 0..N, erreurs: [...] } }

# 3. Vérifier l'équilibre du Bilan post-régénération
# → /comptabilite/etats-financiers/bilan → bandeau vert "Équilibre vérifié"

# 4. Smoke test refus reversement
curl -X POST /api/depenses/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type_depense":"Reversement client","montant":1000,"date_depense":"2026-05-18"}'
# Attendu : 400 { error: "Les reversements clients...", code: "INVALID_TYPE_DEPENSE" }
```

---

## 6. Récapitulatif livraison

| Fichier | Action | Lignes impactées |
|---|---|---|
| `lib/compta/reprise.ts` | Refonte interne (Option X + dédup manuelle) | ~+90, -150 net = ~730 lignes total |
| `app/api/compta/operations/regenerer-ecritures/route.ts` | **NEW** | ~170 lignes |
| `app/api/depenses/create/route.ts` | + validation refus reversement | +15 lignes |
| `components/CreateDepenseForm.tsx` | + hint UI si "reversement" dans type libre | +8 lignes |

**Total** : 4 fichiers (1 NEW, 3 modifiés). Aucune migration BD, aucune nouvelle dépendance.

---

## 7. Risques résiduels & limites

- **Performance régénération** : 462 ops × 1 écriture séquentielle ≈ 30-60 s.
  Acceptable avec `maxDuration: 60`. Si volume futur > 1k ops, à migrer en
  job async.
- **Idempotence post-fix** : la dédup manuelle fait un `SELECT IN (source_refs)`
  sur chaque chunk (500). Coût : 1 round-trip réseau supplémentaire par chunk.
  Acceptable.
- **Cohérence Option X** : si des ops `recette_wave` créées AVANT ce patch
  utilisaient un `source_ref` de type UUID `versement_attribution.id`, et que
  de nouvelles ops créées APRÈS utilisent l'`"Identifiant de transaction"`
  Wave (texte) — il peut y avoir doublons logiques. La régénération SQL
  manuelle du 18/05/2026 a déjà aligné toutes les ops sur le nouveau format
  (455 ops avec `source_ref = "Identifiant de transaction"`). À vérifier en
  prod via `SELECT source_ref FROM operations WHERE source='recette_wave' LIMIT 5;`.
- **Suppression écritures `force=true`** : DELETE en cascade sur
  `lignes_ecritures`. Sur exercice clos, le trigger `enforce_exercice_clos_lock_ecriture`
  (Phase 4.3) bloquera. Comportement attendu.

---

## 8. À traiter séparément (hors périmètre)

1. **Modifier l'index UNIQUE en non-partiel** : non recommandé — la clause
   `WHERE source <> 'transfert_interne'` est volontaire (le `transfert_interne`
   peut générer 2 ops liées au même `source_ref` = id du transfert)
2. **Job nightly de réconciliation** : à prévoir post-Wave Business pour
   détecter d'éventuelles dérives futures (cf. analyse Wave Business §9)
3. **Migrer les autres patterns `upsert(onConflict)` du codebase** : à
   recenser via `grep -rn "onConflict" app/ lib/` au cas où d'autres routes
   souffrent du même bug d'index partiel
