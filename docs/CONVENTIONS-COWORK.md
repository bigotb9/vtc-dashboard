# Conventions Cowork Fleet Boyah — Checklist obligatoire

> Source de vérité : `correctif_cowork_vague3_patch42.docx` (v1.0, 16 mai 2026).
> Aucune livraison ne doit être considérée "finie" sans validation des 8 points.

---

## Les 8 conventions

| # | Convention | Source bug |
|---|------------|------------|
| 1 | **UTF-8 sans BOM** — encodage explicite + check pré-livraison automatique | Vague 2 (4 fichiers cassés) |
| 2 | **React StrictMode safe** — capturer la ref AU DÉBUT, jamais re-lire après `await` | Vague 2 (CategorieSelector affichait caisses) |
| 3 | **Pas de `<button>` imbriqué** dans `<button>` ou `<a>` | Vague 2 (TiersSelector hydration error) |
| 4 | **Aucun `overflow-hidden`** sur composants hébergeant popover / dropdown | Vague 2 (× 2 occurrences) |
| 5 | **Typing strict** — `XxxInput` (Zod local) vs `XxxPayload` (API exposé) | Vague 2 (TransfertInput vs TransfertPayload) |
| 6 | **Smoke test reproductible** obligatoire avant livraison + `tsc` Windows | Toutes vagues |
| 7 | **authFetch + FormData** — ne PAS forcer `Content-Type` si `body instanceof FormData` | Vague 3 (uploads échouaient) |
| 8 | **npm install obligatoire** pour toute nouvelle dépendance importée | Patch QR (qrcode manquant) |

---

## Les 5 scripts d'audit pré-livraison

À exécuter dans l'ordre, dernière étape avant tout commit / livraison.

### 1. Encodage UTF-8 (BOM + mojibake)

```bash
# Doit retourner vide — pas de BOM
grep -l $'\xef\xbb\xbf' src/**/*.{ts,tsx}

# Doit aussi retourner vide — pas de mojibake (é → Ã©)
grep -lE 'Ã©|Ã¨|Ãª|Ã |Ã§' src/**/*.{ts,tsx}
```

### 2. Button-in-button

```bash
# Doit retourner vide (ou cas justifiés explicitement)
grep -PzoE '<button[^>]*>(?:(?!</button>).)*<button' src/**/*.tsx
```

### 3. Overflow-hidden sur composants popover

```bash
# Identifie les composants à audit visuel manuel
grep -l 'overflow-hidden' src/components/**/*Selector*.tsx
grep -l 'overflow-hidden' src/components/**/*Popover*.tsx
grep -l 'overflow-hidden' src/components/**/*Dropdown*.tsx
```

### 4. TypeScript compile

```bash
npx tsc --noEmit   # doit retourner code 0, aucune erreur
```

### 5. Dépendances manquantes

```bash
# Lister tous les imports non-relatifs
grep -hE "^import .* from ['\"]([^@.][^'\"]+)['\"]" **/*.{ts,tsx} \
  | sed -E "s/.*from ['\"]([^'\"]+)['\"].*/\\1/" \
  | sort -u

# Pour chaque résultat → vérifier présence dans package.json (deps OU devDeps)
# Si absent : `npm install <pkg>` + (si types) `npm install --save-dev @types/<pkg>`
```

---

## Section obligatoire à inclure dans chaque rapport de livraison

```markdown
## Pré-requis déploiement

1. `npm install`   ← OBLIGATOIRE si nouvelles deps
2. Nouvelles dépendances :
   - `<pkg>` ^X.Y.Z
   - `@types/<pkg>` ^X.Y.Z (dev)
3. Migrations SQL à jouer : `<liste>`
4. Variables d'environnement à configurer : `<liste>`
```

---

## Conventions détaillées (cas particuliers)

### #7 — authFetch et FormData (pattern correct)

```typescript
export async function authFetch(url: string, options: RequestInit = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  // Ne PAS forcer Content-Type quand le body est FormData :
  // le browser doit calculer lui-même "multipart/form-data; boundary=..."
  const isFormData = options.body instanceof FormData

  return fetch(url, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
}
```

Cas à respecter :

- **FormData** → laisse le browser gérer `multipart/form-data`
- **Blob / ArrayBuffer / File** → laisse le browser ou Content-Type explicite
- **URLSearchParams** → `application/x-www-form-urlencoded` automatique
- **JSON simple** → forcer `Content-Type: application/json` (par défaut OK)

### #8 — Procédure d'installation des nouvelles dépendances

1. Identifier toute `import X from "Y"` où `Y` n'est pas un chemin relatif
2. Vérifier `package.json` (dependencies + devDependencies)
3. Si absente :
   - `npm install Y` (lib runtime)
   - `npm install --save-dev @types/Y` (si types externes)
4. Ajouter dans le rapport :
   ```markdown
   ## Dépendances ajoutées
   - `Y` ^X.Y.Z
   - `@types/Y` ^A.B.C (dev)
   ```

---

## Historique d'application

| Vague / Patch | Conventions vérifiées | Bugs résiduels |
|---------------|----------------------|----------------|
| Vague 1 Transferts | 1-5 | 0 |
| Vague 2 Tiers | 1-5 (12 bugs corrigés) | 0 |
| Vague 3 Justificatifs | 1-6 (bug #13 sur #7 manquante à l'époque) | Bug #13 corrigé |
| Phase 4.2 Logo + Bilan + CR | 1-6 | 0 |
| Patch 4.2 QR + URL courte | 1-8 (bug #14 sur #8 manquante à l'époque) | Bug #14 corrigé |
| Phase 4.3 États financiers complets | 1-8 (audit pré-livraison ✅ 5/5) | 0 |
| **Vagues futures** | **1-8 (toutes obligatoires)** | — |
