# Patch sync legacy v3 — 3 fixes critiques post-livraison v2

> Intégration propre des 3 bugs résiduels identifiés et corrigés en local par
> Emmanuel après la livraison v2. Plus 1 réparation hors-périmètre (fichier
> ecritures.ts tronqué à signaler).
>
> **Effort réel** : ~25 minutes.
> **Statut** : ✅ livré · UTF-8 strict 5/5 OK.

---

## 1. Les 3 fixes intégrés

### Fix #1 — `repriseRecettesWave` : select("*") au lieu de guillemets échappés
**Fichier** : `lib/compta/reprise.ts` (ligne ~377)
**Sévérité** : CRITIQUE — toutes les recettes étaient skippées silencieusement.

**Avant (cassé)** :
```typescript
.select("\"Identifiant de transaction\", \"Horodatage\", \"Montant net\", \"Nom de contrepartie\"")
```

**Après** :
```typescript
.select("*")
```

**Cause racine** : Supabase JS ne fait pas de SQL quoting dans `.select()`.
L'échappement `\"Col\"` était interprété littéralement et retournait
`undefined`, ce qui faisait passer toutes les recettes par le `continue`
avec le warning trompeur *« Ligne recettes_wave sans 'Identifiant de
transaction', skippee »*.

Perf négligeable vu le volume par batch (~quelques dizaines de lignes).
Commentaire de contexte ajouté dans le code.

### Fix #2 — `prochainNumero` : MAX(seq)+1 au lieu de count+1
**Fichier** : `lib/compta/ecritures.ts` (ligne ~70-109)
**Sévérité** : CRITIQUE — bloque toute génération d'écriture quand il y a des trous dans la séquence.

**Avant (bug historique)** :
```typescript
const { count } = await supabaseAdmin
  .from("ecritures_comptables")
  .select("*", { count: "exact", head: true })
  .eq("journal_code", journalCode)
  .eq("exercice_id",  exerciceId)
const seq = String((count ?? 0) + 1).padStart(6, "0")
```

**Après** :
```typescript
const prefix = `${annee}-${journalCode}-`
const { data: lastRows, error: cErr } = await supabaseAdmin
  .from("ecritures_comptables")
  .select("numero")
  .eq("journal_code", journalCode)
  .eq("exercice_id",  exerciceId)
  .like("numero", `${prefix}%`)
  .order("numero", { ascending: false })
  .limit(1)
let lastSeq = 0
if (lastRows && lastRows.length > 0 && lastRows[0].numero) {
  const match = /-(\d+)$/.exec(lastRows[0].numero)
  if (match) lastSeq = parseInt(match[1], 10)
}
const seq = String(lastSeq + 1).padStart(6, "0")
```

Le filtre `.like("numero", "${prefix}%")` exclut les éventuelles extournes
qui utiliseraient un format `EXT-YYYY-JJ-NNN` (préfixe différent).

**Cas réel rencontré** : 430 écritures, MAX(seq) = 433, trous (1, 2, saut à 432).
`count + 1 = 431` → numéro déjà pris → erreur 23505 sur idx_ecritures_numero.

Commentaire JSDoc mis à jour : « La séquence est calculée comme MAX(numero) + 1
(et non count + 1) pour gérer les trous de séquence dus aux DELETE manuels,
rollbacks SQL, extournes orphelines, etc. »

**Limite résiduelle documentée** : reste vulnérable à la race condition si
2 appels parallèles. Pour V1 Boyah (1-2 utilisateurs), acceptable. Pour SaaS
multi-tenant futur, prévoir migration vers SEQUENCE Postgres dédiée par
journal+exercice, ou index avec retry/jitter applicatif.

### Fix #3 — `repriseDepensesVehicules` : exclure "Reversement client"
**Fichier** : `lib/compta/reprise.ts` (fonction `repriseDepensesVehicules`)
**Sévérité** : MOYENNE — doublons comptables à chaque appel.

**Cause** : la règle d'exclusion appliquée à `/api/depenses/create` (fix L4 v2)
n'avait pas été propagée à la fonction de reprise qui scanne toute la table
`depenses_vehicules`. Donc lignes historiques `type='Reversement client'`
recréaient une op `source='depense_vehicule'` en doublon de l'op
`source='versement_client'` existante (table `versements_clients`).

**Fix appliqué** :
```typescript
const rowsFiltered = rows.filter(r => {
  const t = String(r.type_depense ?? "").toLowerCase()
  if (t.includes("reversement")) {
    warnings.push(`Ligne depenses_vehicules ${r.id_depense} type "Reversement client" skippee (doublon avec versement_client)`)
    return false
  }
  return true
})
```

Puis la boucle de construction utilise `rowsFiltered` au lieu de `rows`.
Les lignes exclues sont signalées explicitement dans `warnings[]` pour audit.

---

## 2. Bug bonus — Troncature `ecritures.ts` (hors-périmètre v3, à valider)

**Constat** : à la réception de la v3, le fichier `lib/compta/ecritures.ts`
était tronqué à **20 714 octets** au milieu de la chaîne :
```typescript
throw new EcritureError("DB_ERROR", `Insertion lignes extourne é
```
Le dernier octet `0xC3` était isolé (sans son partenaire `0xA9` pour former le
`é` UTF-8). Conséquence : fichier UTF-8 invalide, TypeScript ne compile pas,
fonction `genererEcritureExtourne` orpheline (appelée par
`app/api/compta/operations/[id]/annuler/route.ts`).

**Cause probable** : troncature accidentelle entre 2 sessions d'édition
(linter, copier-coller incomplet, ou Edit tool sur une version partielle).
Pas une corruption d'encodage cette fois — vraie perte de bytes.

**Réparation appliquée** : la fonction a été complétée en reconstituant la
fin manquante avec un pattern minimal et SAFE, calqué sur la fonction
`genererEcritureFromOperation` du même fichier :

```typescript
    throw new EcritureError("DB_ERROR", `Insertion lignes extourne échouée : ${lExtErr.message}`)
  }

  // 9. Validation (le trigger d'équilibre BD vérifie partie double)
  console.log(`[extourne] UPDATE statut=valide`)
  const { error: vErr } = await supabaseAdmin
    .from("ecritures_comptables")
    .update({ statut: "valide", valide_le: new Date().toISOString() })
    .eq("id", ecrExt.id)
  if (vErr) {
    console.error(`[extourne] UPDATE statut FAILED:`, vErr)
    const code = vErr.code === "23514" ? "ECRITURE_DESEQUILIBREE" : "DB_ERROR"
    throw new EcritureError(code, `Validation extourne échouée : ${vErr.message}`)
  }

  console.log(`[extourne] done -> ${ecrExt.id}`)
  return ecrExt.id
}
```

**⚠ À valider par Emmanuel** : si la version git d'avant troncature contient
des étapes additionnelles (ex. UPDATE `operations.ecriture_id_extourne`,
log activity, retour d'un objet enrichi), restaurer depuis git plutôt que
garder cette reconstruction minimale.

---

## 3. Audit UTF-8 strict (Python)

| Fichier | Bytes | BOM | REPLACEMENT | UTF-8 valide | Non-ASCII |
|---|---:|:-:|:-:|:-:|---:|
| `lib/compta/reprise.ts` | 28 402 | ❌ | **0** | ✅ | 37 (libellés métier) |
| `lib/compta/ecritures.ts` | 21 359 | ❌ | **0** | ✅ | 450 (commentaires existants) |
| `app/api/compta/operations/regenerer-ecritures/route.ts` | 6 533 | ❌ | **0** | ✅ | 0 (ASCII pur) |
| `app/api/depenses/create/route.ts` | 1 221 | ❌ | **0** | ✅ | 0 (ASCII pur) |
| `components/CreateDepenseForm.tsx` | 15 049 | ❌ | **0** | ✅ | 0 (ASCII pur) |

**Verdict global : 5/5 OK**.

---

## 4. État BD attendu post-déploiement

D'après la référence Emmanuel :

| source | nb ops | total | sans écriture |
|---|---:|---:|---:|
| recette_wave | 467 | 12 369 741 F | 0 |
| depense_vehicule | 39 | 1 265 200 F | 0 |
| versement_client | 10 | 8 787 000 F | 0 |
| transfert_interne | 4 | 202 000 F | 0 |
| manuel | 7 | 2 055 000 F | 0 |
| **TOTAL** | **527** | — | **0** ✅ |

Bilan SYSCOHADA équilibré : SUM(debit) = SUM(credit). ✅

---

## 5. Tests d'acceptation v3

| # | Test | Couvert par |
|---|------|-------------|
| 1 | `POST /api/recettes/create` crée bien 1 op `recette_wave` | Fix #1 |
| 2 | `POST /api/recettes/import` 50 lignes → 50 ops créées | Fix #1 |
| 3 | Génération d'écriture sur exercice avec trous (430 ops mais MAX=433) → pas de duplicate key | Fix #2 |
| 4 | `POST /api/compta/reprise/all` (réimport global) → 0 doublon Reversement client | Fix #3 |
| 5 | `POST /api/compta/operations/[id]/annuler` (extourne) → fonctionne | Réparation troncature |
| 6 | `npx tsc --noEmit` → 0 erreur | À exécuter localement |
| 7 | Audit UTF-8 strict Python sur 5 fichiers | ✅ ALL OK |

---

## 6. Pré-requis déploiement

- ✅ Aucune migration BD
- ✅ Aucune nouvelle dépendance
- ⚠️ **Avant merge** : valider que la fin de `genererEcritureExtourne`
  reconstituée correspond bien à la version git d'avant troncature.
  Sinon, remplacer par la version git authentique (le pattern minimal
  livré ici fonctionnera mais peut manquer d'étapes auxiliaires).
- ⚠️ `npx tsc --noEmit` à exécuter localement (sandbox sans `node_modules`).

---

## 7. Récapitulatif

| Fichier | Modification | Origine |
|---|---|---|
| `lib/compta/reprise.ts` | Fix #1 (select *) + Fix #3 (filter reversement) | Bug v2 |
| `lib/compta/ecritures.ts` | Fix #2 (MAX seq+1) + réparation troncature | Bug v2 + accident |

**Total** : 2 fichiers modifiés. Aucune nouvelle dépendance, aucune migration.

---

## 8. À traiter séparément

1. **Récupération git de la fonction d'extourne complète** (si elle existait
   en version plus riche que la reconstruction minimale)
2. **Migration future SEQUENCE Postgres** pour `prochainNumero` (race condition
   en SaaS multi-tenant)
3. **Investigation** : qu'est-ce qui a tronqué `ecritures.ts` entre v2 et v3 ?
   (linter, Edit tool, copier-coller partiel ?) — éviter récidive
