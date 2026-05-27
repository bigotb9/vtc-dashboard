# Phase 4.x Vague 2 — Correctif post-livraison (15 mai 2026)

**Statut :** appliqué, prêt pour validation côté Emmanuel
**Référence :** spec correctif `correctif_cowork_vague2.docx` du 15/05/2026
**Effort estimé :** 3-4 h (6 h 30 avec audit + conventions sandbox)

---

## 1. Vue d'ensemble

Le smoke test de la Vague 2 Module Tiers a remonté **10 bugs** (dont 4
bloquants compilation et 4 d'encodage) et **2 évolutions** fonctionnelles
demandées. Tous les bugs avaient été corrigés à la main par Emmanuel
pendant le smoke. Ce correctif :

1. **Intègre les fixes** dans la spec officielle (déjà visibles dans le
   code après actions linter + Edit).
2. **Implémente les 2 évolutions** : bouton Réactiver + colonne Tiers
   sur la liste opérations.
3. **Documente les conventions** à imposer côté sandbox Cowork pour
   éviter la récurrence.

---

## 2. Bugs intégrés (10) — statut

| # | Bug | Statut | Fichier |
|---|------|--------|---------|
| 1 | `TS2305` `TransfertInput` → `TransfertPayload` | ✅ intégré (linter) | `lib/compta/transferts/createTransfert.ts`, `previewTransfert.ts` |
| 2 | `TS2322` `type \| null` non assignable | ✅ intégré (linter) | `components/compta/TiersForm.tsx` ligne 134-137 |
| 3 | Encodage UTF-8 cassé TiersForm.tsx | ✅ déjà fixé manuellement par Emmanuel | `components/compta/TiersForm.tsx` |
| 4 | Encodage UTF-8 cassé generateSuffix.ts | ✅ déjà fixé manuellement | `lib/compta/tiers/generateSuffix.ts` |
| 5 | Combobox caché (`overflow-hidden` Section Écran 4) | ✅ déjà retiré | `app/comptabilite/operations/nouveau/page.tsx` ligne 421 |
| 6 | Race condition StrictMode `useFormReferences` | ✅ déjà fixé (capture `wasStaticLoaded`) | `hooks/compta/useFormReferences.ts` lignes 57, 61, 83, 90, 177 |
| 7 | Encodage UTF-8 cassé page.tsx (Écran 4) | ✅ déjà fixé manuellement | `app/comptabilite/operations/nouveau/page.tsx` |
| 8 | Encodage UTF-8 cassé TiersSelector.tsx | ✅ déjà fixé manuellement | `components/compta/TiersSelector.tsx` |
| 9 | `<button>` imbriqué dans `<button>` | ✅ intégré (linter) — span role="button" | `components/compta/TiersSelector.tsx` ligne 99 |
| 10 | Combobox caché TiersRetroactionCard | ✅ pas d'overflow-hidden dans le composant final | `components/compta/TiersRetroactionCard.tsx` |

**Tous les bugs critiques sont fixés.** Les fichiers actuels reflètent
l'état corrigé. Aucun nouveau bug d'encodage n'a été introduit pendant
la livraison du correctif.

---

## 3. Évolutions implémentées

### 3.1 #11 — Bouton "Réactiver" sur fiche tiers désactivé

**Comportement** :
- Le bouton apparaît UNIQUEMENT si `!detail.actif` (et `onReactivate` fourni).
- Click → `PATCH /api/compta/tiers/[id]` avec `{ actif: true }`.
- Si **CONFLICT 409** (le code SYSCOHADA a été repris par un autre tiers
  actif pendant que celui-ci était désactivé) → toast d'erreur +
  redirect vers `/comptabilite/tiers/[id]/modifier?focus=suffix&hint=collision`.
- Sur la page Modifier, le `hint=collision` affiche un banner ambre
  indiquant la collision + suggère de modifier le suffixe.

**Fichiers modifiés** :
- `components/compta/TiersDetailHeader.tsx` — props `onReactivate`, `reactivating` + bouton conditionnel (icône `Power`, accent emerald)
- `app/comptabilite/tiers/[id]/page.tsx` — handler `handleReactivate()` avec mapping CONFLICT → redirect
- `app/comptabilite/tiers/[id]/modifier/page.tsx` — lecture `?hint=collision` + banner d'alerte

**Workflow utilisateur en cas de collision** :
1. User clique "Réactiver" → toast erreur "Code SYSCOHADA déjà utilisé"
2. Redirect auto vers `/modifier?focus=suffix&hint=collision` (banner ambre)
3. User change le suffixe (le formulaire re-suggère via `useSuggestSuffix`)
4. Save → tiers stays `actif=false`, suffix changé → redirect `/tiers/[id]`
5. User clique "Réactiver" à nouveau → succès (le slot est libre)

### 3.2 #12 — Colonne Tiers + filtre sur liste opérations

**Backend** — `app/api/compta/operations/route.ts` :
- SELECT enrichi : `tiers:tiers_id ( id, nom, type, compte_syscohada_code, actif )` ajouté dans la requête
- Query param `tiers_ids` (CSV) ou `tiers_id` (single) → filtre `.in("tiers_id", [...])`

**Types** — `types/compta-ui.ts` :
- `OperationView.tiers` ajouté (référence enrichie)
- `OperationView.tiers_id` ajouté
- `OperationsFilters.tiers_ids?: string[]` ajouté

**Frontend liste opérations** — modifs cumulées :
- `components/compta/OperationsTable.tsx` — colonne **Tiers** entre Caisse et Source, avec lien `Link href="/comptabilite/tiers/[id]"` + `onClick stopPropagation` (évite la navigation parent) + sub-info code SYSCOHADA en mono violet ; `—` gris si null. Largeurs ajustées + `SkeletonRow` étendu à 9 cellules + `colSpan={9}` empty state.
- `components/compta/OperationsFilters.tsx` — dropdown Tiers (single-select stocké dans tableau pour API multi-friendly) chargé via `/api/compta/tiers?actifs_only=true&page_size=200` ; chip actif "Tiers: NomA, NomB".
- `app/comptabilite/operations/page.tsx` — URL state `tiers_ids` (CSV).
- `hooks/compta/useOperations.ts` — propagation `tiers_ids` en query param.

**Comportement** :
- Cliquer le nom du tiers dans la table navigue vers sa fiche (sans déclencher la navigation vers le détail de l'opération).
- Filtrer par tiers limite la liste aux opérations liées (rétroactivement ou nativement).
- Le filtre est bookmarkable via URL.

---

## 4. Conventions imposées (cf. spec §3)

Les conventions suivantes sont à intégrer côté sandbox de génération
Cowork pour éviter la récurrence des classes de bugs.

### 4.1 Encodage UTF-8 sans BOM (CRITIQUE)
- Tous les `.ts` / `.tsx` / `.sql` / `.md` doivent être écrits en UTF-8 sans BOM
- Check avant livraison : `grep -l $'\xef\xbb\xbf' **/*.{ts,tsx}` doit retourner vide
- Détecter `Ã`, `Â` et autres doubles-encodages avant livraison

### 4.2 Race conditions React StrictMode
- Tout hook custom avec fetch + refs DOIT capturer la valeur des refs AU DÉBUT (avant les `await`)
- Utiliser un `reqId` incrémental pour invalider les requêtes obsolètes
- Pattern de référence : `hooks/compta/useFlowData.ts` (Vague 3.5)
- Application déjà faite : `hooks/compta/useFormReferences.ts` ligne 57

### 4.3 HTML accessibility
- Pas de `<button>` imbriqué — utiliser `<span role="button" tabIndex={-1} onClick={e => e.stopPropagation()}>`
- Pattern de référence appliqué : `TiersSelector.tsx` ligne 99, et la nouvelle cellule Tiers dans `OperationsTable` utilise `Link onClick={e => e.stopPropagation()}` pour éviter la propagation du click ligne.

### 4.4 Composants avec popover / dropdown
- Le wrapper du composant ne doit JAMAIS avoir `overflow-hidden`
- Pour limiter un dépassement, préférer `border` ou `rounded`
- Audit en cours : `grep -l 'overflow-hidden' components/compta/**/*.tsx` puis vérifier visuellement

### 4.5 Types TypeScript
- Convention : `XxxInput` = type Zod local (`z.infer`), `XxxPayload` = type API exposé via `types/compta-ui.ts`
- Ne JAMAIS importer `XxxInput` depuis `types/compta-ui.ts`
- Validation finale `npx tsc --noEmit` toujours sur la machine Windows (le mount Linux remonte des faux positifs documentés)

### 4.6 Smoke test obligatoire
- Vague 2 : créer 2 tiers du même type (Garage Atta + Garage Akli) → collision GA → GA1
- Désactiver le 1er + créer un 3e → vérifier libération slot
- Tester sur 3 itérations le formulaire opération → vérifier que catégories ≠ caisses
- Reproduire en cold start Vercel (StrictMode + premier démarrage)

---

## 5. Fichiers touchés par ce correctif

### Modifs pour les 2 évolutions
- `types/compta-ui.ts` — `tiers` + `tiers_id` dans `OperationView`, `tiers_ids` dans `OperationsFilters`
- `app/api/compta/operations/route.ts` — JOIN tiers + filtre tiers_ids
- `components/compta/OperationsTable.tsx` — colonne Tiers (desktop)
- `components/compta/OperationsFilters.tsx` — dropdown Tiers + chip actif
- `app/comptabilite/operations/page.tsx` — URL state tiers_ids
- `hooks/compta/useOperations.ts` — propagation query param tiers_ids
- `components/compta/TiersDetailHeader.tsx` — bouton Réactiver
- `app/comptabilite/tiers/[id]/page.tsx` — handler handleReactivate + redirect collision
- `app/comptabilite/tiers/[id]/modifier/page.tsx` — banner collision + toast info

**Total : 9 fichiers modifiés. Aucune nouvelle migration BD.**

---

## 6. Tests de validation §4.4 (spec)

Protocole de validation Emmanuel :

1. **Bugs résolus** — Reproduire les 12 cas de bugs ci-dessus → tous doivent être résolus dans la livraison actuelle.
2. **Smoke complet multi-tenants** :
   - Créer Garage Atta (fournisseur) → suffixe GA, code 401-GA
   - Créer Garage Akli (fournisseur) → collision GA → suffixe auto GA1, code 401-GA1
   - Désactiver Garage Atta → code 401-GA libéré
   - Créer 3e tiers "Garage Aboubacar" (fournisseur) → suffixe GA (slot libre)
   - Tenter de réactiver Garage Atta → CONFLICT → redirect vers /modifier?hint=collision → banner ambre visible
   - Modifier suffixe → save → revenir sur fiche tiers → cliquer Réactiver → succès
3. **Cold start Vercel** — Vider `.next` + redémarrer → ouvrir `/comptabilite/operations/nouveau` → vérifier que CategorieSelector affiche les catégories (pas les caisses).
4. **Évolution #12 colonne Tiers** :
   - Aller sur `/comptabilite/operations`
   - Vérifier la colonne Tiers présente entre Caisse et Source
   - Tiers cliquable → redirige vers `/comptabilite/tiers/[id]` SANS naviguer vers le détail de l'op
   - "—" gris si pas de tiers lié
5. **Évolution #12 filtre Tiers** :
   - Sélectionner un tiers dans le dropdown filtres → liste se filtre
   - Chip "Tiers: NomA" visible
   - Cliquer la croix du chip → filtre retiré
   - URL bookmarkable : `?tiers_ids=<uuid>`

---

## 7. Récap

| Catégorie | Avant | Après |
|--|--|--|
| Bugs bloquants compilation (TS) | 2 | 0 |
| Bugs encodage UTF-8 | 4 | 0 |
| Bugs UX (combobox caché) | 2 | 0 |
| Bugs race condition StrictMode | 1 | 0 |
| HTML invalide (`<button>` imbriqué) | 1 | 0 |
| Évolutions demandées | 2 | livrées |

**Total : 10 bugs résolus + 2 évolutions livrées + 6 conventions documentées.**

---

## 8. Prochaines étapes

Vague 3 (déjà spec'ée) : Transferts EXTERNES vers tiers + upload de
justificatifs. Une fois Emmanuel valide ce correctif, on peut enchaîner.

En parallèle, recommander que Cowork :
- Active `grep -l 'overflow-hidden' components/**/*.tsx` dans le rituel pre-livraison
- Active `grep -l 'TransfertInput' lib/**/*.ts` dans le rituel pre-livraison
- Crée un script de check d'encodage UTF-8 sans BOM systématique
