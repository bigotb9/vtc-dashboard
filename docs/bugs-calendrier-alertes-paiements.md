# Investigation Bug 1 (Calendrier sparkle) + Bug 2 (Alertes paiements)

**Date** : 21 mai 2026
**Statut** : analyse + propositions de correction (non appliquées sans validation)
**Périmètre** : lecture seule sur données métier · modifs code possibles après validation

---

## Bug 1 — Bouton sparkle "Calendrier paiements" affiche "2 sans chauffeur"

### Composant identifié

`components/SuiviVersementsWidget.tsx`, lignes 102-108 (icône `<Sparkles size={13} />`).

Le clic sur le bouton appelle `recalculer()` qui fait `POST /api/recettes/attribution`. La réponse contient `{ attributions_count, skipped_no_phone, skipped_no_chauffeur, skipped_no_affectation }` et le toast formate ces 4 valeurs (lignes 56-60).

### Logique tracée — fichier `app/api/recettes/attribution/route.ts`

```typescript
// Lignes 22-26 : normalisation téléphone = 8 derniers chiffres
function normPhone8(raw: string | null | undefined): string {
  if (!raw) return ""
  return raw.replace(/[^0-9]/g, "").slice(-8)
}

// Lignes 94-100 : index chauffeurs par téléphone (numero_wave + numero_wave_2)
const chByPhone = new Map<string, number>()
for (const c of chauffeurs || []) {
  const p1 = normPhone8(c.numero_wave)
  if (p1) chByPhone.set(p1, c.id_chauffeur)
  const p2 = normPhone8((c as Record<string, unknown>).numero_wave_2 as string)
  if (p2) chByPhone.set(p2, c.id_chauffeur)
}

// Lignes 106-124 : boucle attribution
for (const r of recettes) {
  const tel8 = normPhone8(r["Numéro de téléphone de contrepartie"])
  if (!tel8) { skipped_no_phone++; continue }

  const id_chauffeur = chByPhone.get(tel8)
  if (!id_chauffeur) { skipped_no_chauffeur++; continue }   // ← LE COMPTEUR EN CAUSE

  const dateISO = r["Horodatage"].slice(0, 10)
  const id_vehicule = findVehicleAt(id_chauffeur, dateISO)
  if (!id_vehicule) { skipped_no_affectation++; continue }
  ...
}
```

### Différence cruciale avec la jointure d'Emmanuel

| Diagnostic Emmanuel | Logique bouton sparkle |
|---|---|
| Source : `versement_attribution` (résultat de l'attribution) | Source : **`recettes_wave`** (paiements bruts) |
| Match : véhicule + jour ↔ `affectation_chauffeurs_vehicules` (date_debut ≤ jour ≤ date_fin) | Match : **`recettes_wave."Numéro de téléphone de contrepartie"`** ↔ `chauffeurs.numero_wave` OR `chauffeurs.numero_wave_2` (8 derniers chiffres normalisés) |
| Corrigé en étendant les `date_debut` (id 23 et id 4) | Les corrections d'Emmanuel impactent `skipped_no_affectation`, **pas** `skipped_no_chauffeur` |

→ Les 2 "sans chauffeurs" sont 2 entrées **`recettes_wave`** dont le **numéro de téléphone de contrepartie** ne correspond à AUCUN `chauffeurs.numero_wave` ni `numero_wave_2`.

### Requête SQL diagnostic — à exécuter dans Supabase

```sql
-- Identifie les recettes_wave dont le téléphone n'a aucune correspondance chauffeur
WITH chauffeur_phones AS (
  SELECT id_chauffeur, nom,
         RIGHT(REGEXP_REPLACE(COALESCE(numero_wave, ''), '[^0-9]', '', 'g'), 8) AS tel8,
         'numero_wave' AS source_col
    FROM chauffeurs
   WHERE numero_wave IS NOT NULL
  UNION ALL
  SELECT id_chauffeur, nom,
         RIGHT(REGEXP_REPLACE(COALESCE(numero_wave_2, ''), '[^0-9]', '', 'g'), 8) AS tel8,
         'numero_wave_2' AS source_col
    FROM chauffeurs
   WHERE numero_wave_2 IS NOT NULL
),
recettes_with_tel AS (
  SELECT
    r.id, r."Identifiant de transaction" AS id_tx, r."Horodatage",
    r."Montant net", r."Nom de contrepartie",
    r."Numéro de téléphone de contrepartie" AS tel_brut,
    RIGHT(REGEXP_REPLACE(COALESCE(r."Numéro de téléphone de contrepartie", ''), '[^0-9]', '', 'g'), 8) AS tel8
  FROM recettes_wave r
  WHERE r."Montant net" IS NOT NULL AND r."Montant net" > 0
)
SELECT
  r.id, r.id_tx, r."Horodatage", r."Montant net",
  r."Nom de contrepartie", r.tel_brut, r.tel8
FROM recettes_with_tel r
WHERE r.tel8 IS NOT NULL AND r.tel8 <> ''
  AND NOT EXISTS (
    SELECT 1 FROM chauffeur_phones cp
    WHERE cp.tel8 = r.tel8 AND cp.tel8 <> ''
  )
ORDER BY r."Horodatage";
```

Cette requête doit retourner **exactement 2 lignes**, qui sont les 2 recettes signalées par le bouton sparkle.

### Causes possibles pour chaque recette signalée

Après exécution de la requête, 3 cas typiques :

1. **Nouveau chauffeur pas encore enregistré** : le téléphone existe mais le chauffeur n'a pas été créé dans `chauffeurs`. Action : créer la fiche chauffeur + remplir `numero_wave`.
2. **Chauffeur existant avec téléphone secondaire non rempli** : le chauffeur paie depuis un 2e compte Wave. Action : remplir `chauffeurs.numero_wave_2`.
3. **Faux versement (paiement non-chauffeur)** : un client, un fournisseur, un test, etc. Action : laisser tel quel — le `skipped_no_chauffeur` est légitime.

### Proposition de correction Bug 1

**Pas de bug de code — bug de données.** La logique du bouton sparkle est correcte. Il faut :

- (a) Exécuter la requête SQL diagnostic ci-dessus
- (b) Pour chacune des 2 recettes retournées, identifier laquelle des 3 causes s'applique
- (c) Soit corriger `chauffeurs.numero_wave[_2]`, soit accepter le `skipped_no_chauffeur` comme légitime

Optionnel — améliorer l'UX du bouton sparkle pour montrer **les IDs des recettes orphelines** au lieu du seul compteur, afin qu'Emmanuel n'ait plus besoin de SQL la prochaine fois. Exemple :

```typescript
// Dans /api/recettes/attribution/route.ts, ajouter dans le return :
return NextResponse.json({
  ok:                     true,
  attributions_count:     attributions.length,
  recettes_total:         recettes.length,
  recettes_enrichies:     recettesEnrichies.length,
  skipped_no_phone,
  skipped_no_chauffeur,
  skipped_no_affectation,
  // NOUVEAU : remonter les détails pour debug
  details_orphelins: {
    recettes_no_chauffeur: recettes_no_chauffeur_list,   // [{id, tel8, montant, horodatage}]
    recettes_no_affectation: recettes_no_affectation_list,
  },
})
```

Pas obligatoire pour fixer le bug, mais utile pour les futures investigations.

---

## Bug 2 — Bloc "Alertes paiements" affiche faux

### Composant identifié

`components/AlertesPaiements.tsx`, utilisé dans :
- `app/dashboard/page.tsx` ligne 72
- `components/PaiementVehicules.tsx` ligne 4

### Logique tracée — ÉNORME bug de placeholder

`components/AlertesPaiements.tsx` lignes 16-38 :

```typescript
useEffect(() => {
  const load = async () => {
    const today = new Date().toISOString().split("T")[0]
    const [{ data: vehData }, { data: recettes }] = await Promise.all([
      supabase.from("vehicules").select("id_vehicule, immatriculation"),
      supabase.from("recettes_wave").select("Horodatage"),
    ])
    const transactionsAujourdhui = new Set(
      (recettes || [])
        .filter(r => r.Horodatage?.startsWith(today))
        .map((_, i) => i)
    )
    // Approche : les N premières recettes du jour correspondent aux N premiers véhicules
    const nbPayes = (recettes || []).filter(r => r.Horodatage?.startsWith(today)).length
    const liste   = (vehData || []).map((v, i) => ({
      immatriculation: v.immatriculation,
      paye: i < nbPayes,
    }))
    setVehicules(liste)
  }
  load()
}, [])
```

### Analyse du bug

| Étape | Ce qui est fait | Ce qui devrait être fait |
|---|---|---|
| 1 | Charge tous les véhicules (sans `ORDER BY`, sans filtre `statut='ACTIF'`) | Charger uniquement les véhicules `ACTIF` |
| 2 | Charge **toutes** les recettes_wave (sans projection sur l'identifiant ni le téléphone) | Charger les recettes du jour avec téléphone + ID |
| 3 | Compte les recettes du jour : `nbPayes` | Pour chaque véhicule, vérifier s'il a au moins une attribution dans `versement_attribution` pour aujourd'hui |
| 4 | **Marque les N premiers véhicules comme "payés"** dans l'ordre arbitraire de `vehData` | Joindre chaque véhicule à ses attributions du jour |

**Le commentaire ligne 28 est explicite** : *« Approche : les N premières recettes du jour correspondent aux N premiers véhicules »*. C'est un **placeholder qui n'a jamais été remplacé par la vraie logique de matching**. La variable `transactionsAujourdhui` est créée puis jamais utilisée. Le `Set` n'a aucun sens (mapping index → index).

### Conséquence visible

- Si aujourd'hui 12 véhicules ont reçu des versements et que la flotte compte 20 véhicules actifs : le bloc affichera les **12 premiers véhicules** comme "payés" (ordre arbitraire Postgres = souvent ordre d'insertion `id_vehicule` ASC), et les 8 suivants comme "en retard", **sans aucun lien avec la réalité**.
- Si l'ordre Postgres change (re-création, restore, vacuum), le classement change aussi : un véhicule peut basculer "payé"↔"en retard" sans changement réel des versements.

### Vérification sur les CSV disponibles (audit du 21/05)

À partir du CSV `recettes_wave` ingéré dans DuckDB (471 lignes sur 2026-02-09 → 2026-05-20), pour la date **2026-05-20** :

```sql
-- Recettes Wave Boyah du 20/05 (basée sur les CSV audit)
SELECT "Horodatage", "Montant net", "Nom de contrepartie", "Numéro de téléphone de contrepartie"
FROM recettes_wave
WHERE DATE("Horodatage") = '2026-05-20'
ORDER BY "Horodatage";
```

Cette requête donne le **nombre réel** de versements du jour. Avec la logique actuelle, le bloc dit que les N premiers véhicules de la table sont payés — sans vérifier que ces véhicules ont effectivement reçu un de ces N versements.

### Proposition de correction Bug 2

Refactor du composant `AlertesPaiements.tsx` pour utiliser la table `versement_attribution` qui contient le vrai mapping véhicule ↔ versement. Voici le code proposé :

```typescript
"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { CheckCircle, AlertTriangle, Bell } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

type Filter = "retard" | "payes" | "tous"
type VehiculeEtat = {
  id_vehicule:     number
  immatriculation: string
  paye:            boolean
  montant_recu:    number
  montant_attendu: number
}

export default function AlertesPaiements({ data }: { data?: unknown }) {
  const [vehicules, setVehicules] = useState<VehiculeEtat[]>([])
  const [filter,    setFilter]    = useState<Filter>("retard")

  useEffect(() => {
    const load = async () => {
      const today = new Date().toISOString().split("T")[0]

      // 1. Véhicules ACTIFS uniquement
      const { data: vehData } = await supabase
        .from("vehicules")
        .select("id_vehicule, immatriculation, montant_recette_jour, statut")
        .eq("statut", "ACTIF")
        .order("immatriculation")

      // 2. Attributions véritables du jour (vraie source de vérité)
      const { data: attribs } = await supabase
        .from("versement_attribution")
        .select("id_vehicule, montant_attribue")
        .eq("jour_exploitation", today)

      // 3. Agréger par véhicule
      const recuByVeh = new Map<number, number>()
      for (const a of attribs || []) {
        if (a.id_vehicule == null) continue
        recuByVeh.set(a.id_vehicule, (recuByVeh.get(a.id_vehicule) || 0) + Number(a.montant_attribue || 0))
      }

      // 4. Classer chaque véhicule
      const liste: VehiculeEtat[] = (vehData || []).map(v => {
        const recu     = recuByVeh.get(v.id_vehicule) || 0
        const attendu  = Number(v.montant_recette_jour || 0)
        return {
          id_vehicule:     v.id_vehicule,
          immatriculation: v.immatriculation,
          paye:            recu >= attendu && attendu > 0,
          montant_recu:    recu,
          montant_attendu: attendu,
        }
      })
      setVehicules(liste)
    }
    load()
  }, [])

  const payes  = vehicules.filter(v => v.paye)
  const retard = vehicules.filter(v => !v.paye)
  const total  = vehicules.length

  // ... reste du composant (filtres + rendu) inchangé
}
```

**Changements clés** :
1. Filtrer `statut='ACTIF'` sur `vehicules`
2. Utiliser `versement_attribution` (vraie source de vérité du mapping véhicule↔versement) au lieu de `recettes_wave` (paiements bruts)
3. Pour chaque véhicule, **sommer** ses attributions du jour
4. Comparer au `montant_recette_jour` attendu pour ce véhicule

**À discuter avant application** :
- Faut-il considérer "payé" si `montant_recu >= montant_attendu` (seuil) ou `montant_recu > 0` (au moins quelque chose) ? La page `/recettes/suivi` utilise des statuts plus fins (`paye_complet`, `paye_insuffisant`, etc.) via `/api/completude`. Le bloc Alertes pourrait réutiliser ce calcul plutôt que refaire le sien.

### Alternative recommandée : réutiliser `/api/completude`

Plus propre : appeler la même API que `SuiviVersementsWidget` qui calcule déjà le statut complet de chaque véhicule pour le jour. Le bloc Alertes affiche juste un sous-ensemble (compact) de ce que SuiviVersements calcule.

```typescript
// Au lieu de calculer localement, réutiliser /api/completude
const res = await fetch(`/api/completude?from=${today}&to=${today}`)
const { cases } = await res.json()
// cases = [{ date, immatriculation, statut, montant_attendu, montant_recu, ... }]
const liste = cases
  .filter(c => c.date === today)
  .map(c => ({
    immatriculation: c.immatriculation,
    paye: c.statut === "paye_complet" || c.statut === "paye_justifie" || c.statut === "jour_ferie_auto",
    ...c,
  }))
```

Avantage : 1 seule logique de classement (celle de `/api/completude`), pas de divergence entre les 2 blocs du dashboard.

---

## Lien entre les 2 bugs

**Aucun lien direct** :
- Bug 1 = bug de **données** dans `chauffeurs.numero_wave[_2]` (2 téléphones manquants), pas de bug de code
- Bug 2 = bug **de code** dans `AlertesPaiements.tsx` (placeholder jamais remplacé), pas de bug de données

**Lien indirect possible** :
- Si Emmanuel corrige Bug 1 (ajout des 2 téléphones manquants) + relance le bouton sparkle, les attributions seront complètes. Mais le bloc Alertes paiements affichera quand même faux car il ne lit pas `versement_attribution`.
- Donc même fix complet Bug 1 ⇒ Bug 2 reste cassé.

---

## Recommandations d'action

| # | Bug | Action | Effort | Risque |
|---|-----|--------|-------:|:-:|
| 1 | Bug 1 | Exécuter le SQL diagnostic pour identifier les 2 recettes orphelines | 1 min | Aucun (SELECT) |
| 2 | Bug 1 | Décider : ajouter les 2 téléphones manquants dans `chauffeurs.numero_wave[_2]` OU accepter le compteur si versements légitimement non-chauffeurs | 5 min | Faible (UPDATE ciblé) |
| 3 | Bug 2 | Refactor `components/AlertesPaiements.tsx` selon la proposition (utiliser `versement_attribution` ou `/api/completude`) | 30 min | Faible (composant isolé) |
| 4 | Bug 2 | Tests : vérifier sur 3-5 véhicules concrets que le classement reflète la réalité | 10 min | Aucun |

### Validation à demander avant application

- Faut-il appliquer le refactor de `AlertesPaiements.tsx` tel quel, ou préfères-tu l'option « réutiliser `/api/completude` » ?
- Confirme-tu que le critère "payé" = `montant_recu >= montant_attendu` est OK ? Ou tu veux plus de granularité (insuffisant, justifié, etc.) ?

---

## Annexe — Fichiers consultés

| Fichier | Rôle |
|---|---|
| `components/SuiviVersementsWidget.tsx` | Composant Calendrier paiements (bouton sparkle ligne 102) |
| `app/api/recettes/attribution/route.ts` | Logique d'attribution (compte `skipped_no_chauffeur` ligne 111) |
| `lib/attributionAlgo.ts` (non lu en détail) | Algo d'attribution importé par la route |
| `components/AlertesPaiements.tsx` | Bloc Alertes paiements (bug placeholder ligne 28-33) |
| `app/dashboard/page.tsx` | Page dashboard qui utilise le composant Alertes (ligne 72) |
| `components/PaiementVehicules.tsx` | Autre composant qui importe Alertes (ligne 4) |
