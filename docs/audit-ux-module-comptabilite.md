# Audit UX du module Comptabilité

> Analyse UX du module `/comptabilite/*` du point de vue d'un patron PME novice.
> Aucune implémentation, aucune refonte — uniquement un audit factuel.
>
> **Périmètre** : le module Comptabilité Fleet Boyah uniquement. Le module
> caisses/paiements/budgets (futur Wave) est **hors périmètre**.
>
> Date : 18 mai 2026 · Auteur : Cowork pour Boyah Group.

---

## Section 1 — Cartographie complète

### 1.1 Liste exhaustive des 23 pages (+ 6 sous-pages)

| Route | Lignes | Rôle | Fréquence usage estimée | Public cible |
|-------|-------:|------|-------------------------|--------------|
| `/comptabilite` | 142 | Dashboard agrégé (KPIs, charts, bannière santé) | **Quotidien** | Directeur |
| `/comptabilite/operations` | 347 | Liste + filtres des écritures comptables | **Quotidien** | Directeur + comptable |
| `/comptabilite/operations/nouveau` | 451 | Formulaire saisie d'une opération manuelle | Quotidien à hebdo | Directeur |
| `/comptabilite/operations/[id]` | 182 | Détail + actions (valider, dupliquer, annuler) | À la demande | Directeur |
| `/comptabilite/comptes-caisses` | 135 | Liste caisses + comptes bancaires | Hebdo | Directeur |
| `/comptabilite/comptes-caisses/nouveau` | 85 | Création caisse/compte | Rarement | Directeur |
| `/comptabilite/comptes-caisses/[id]` | 221 | Détail caisse + dernières opérations | Hebdo | Directeur |
| `/comptabilite/comptes-caisses/[id]/modifier` | 151 | Édition | Rarement | Directeur |
| `/comptabilite/categories` | 147 | Liste catégories opérations | Hebdo | Directeur |
| `/comptabilite/categories/nouvelle` | 78 | Création catégorie | Mensuel | Directeur |
| `/comptabilite/categories/[id]` | 108 | Détail catégorie + stats | Rarement | Directeur |
| `/comptabilite/categories/[id]/modifier` | 102 | Édition catégorie | Rarement | Directeur |
| `/comptabilite/tiers` | 97 | Liste clients/fournisseurs/salariés | Hebdo | Directeur |
| `/comptabilite/tiers/nouveau` | 70 | Création tiers (modal quick-create + page complète) | Hebdo (création rapide depuis op) | Directeur |
| `/comptabilite/tiers/[id]` | 149 | Fiche tiers + historique ops | À la demande | Directeur |
| `/comptabilite/tiers/[id]/modifier` | 111 | Édition tiers | Rarement | Directeur |
| `/comptabilite/exercices` | 242 | Gestion des exercices comptables (clôture) | **Annuel** | Directeur + comptable |
| `/comptabilite/etats-financiers` | 187 | Hub états financiers + bouton "Dossier complet" | Annuel à mensuel | Directeur + DGI/banque |
| `/comptabilite/etats-financiers/bilan` | 237 | Bilan SYSCOHADA + export PDF | Mensuel | Comptable + banque |
| `/comptabilite/etats-financiers/compte-resultat` | 204 | Compte de résultat (9 SIG) | Mensuel | Comptable |
| `/comptabilite/etats-financiers/tft` | 250 | Tableau Flux de Trésorerie | Trimestriel | Comptable |
| `/comptabilite/etats-financiers/notes-annexes` | 383 | 6 notes annexes (méthodes, immo, créances…) | Annuel | Comptable + DGI |
| `/comptabilite/parametres-societe` | 123 | Identité légale + logo + méthodes comptables | Une fois | Directeur |
| `/comptabilite/parametres` | 56 | 5 sections : Mode, Exercice, Workflow, Société, Danger | Rarement | Directeur (expert) |
| `/comptabilite/health` | 129 | Audit santé compta : équilibre, mappings, cohérence | À la demande | **Expert seul** |
| `/comptabilite/health/[section]` | 126 | Détail d'une anomalie | Sur diagnostic | Expert |
| `/comptabilite/plan-comptable` | 190 | Plan SYSCOHADA en lecture (9 classes accordéon) | Rarement | **Expert seul** |
| `/comptabilite/exports` | 261 | Génération PDF (Grand Livre, Balance, Journaux…) | Mensuel | Comptable |
| `/comptabilite/onboarding` | 18 | Wizard premier login (force le bootstrap) | **Une fois** | Directeur |

**Total** : 4 982 lignes de code UI réparties sur 23 pages distinctes (+ 6 variantes [id]).

### 1.2 Densité par profil

| Public | Pages adaptées | Pages exposées |
|--------|---------------:|---------------:|
| Patron PME (Emmanuel) — usage quotidien | 4-5 | 13 dans la sidebar |
| Comptable externe | 8-10 | 13 |
| Expert SYSCOHADA | 3 (health, plan-comptable, parametres) | 3 |

Conclusion : **un patron PME novice voit 13 entrées sidebar dont 8 ne lui parleront pas** au quotidien.

### 1.3 Navigation : entrée dans le module

- **Sidebar `components/Sidebar.tsx`** : section "Finances" (lignes 233-254)
  - Entrée principale `/comptabilite` ("Comptabilité", icône BookOpen)
  - 12 sous-entrées directement listées au même niveau (pas de groupement collapsible)
- **Dashboard `/dashboard`** : aucun lien direct vers le module compta (à vérifier — pas trouvé dans Sidebar.tsx)
- **Page d'accueil compta `/comptabilite`** : c'est un **vrai dashboard agrégé**, pas un menu :
  - `HealthBanner` (statut santé globale)
  - `MissingProofBanner` (alerte ops sans justificatif)
  - 4 KPIs (CA, dépenses, marge, trésorerie)
  - Graphique CA vs Dépenses 12 mois (2/3 largeur) + donut entrées par caisse (1/3)
  - 3 cards : top véhicules, dernières écritures, soldes caisses
  - Bar chart dépenses par catégorie (full width)

→ La page d'accueil est **dense mais visuelle** : c'est un point fort. Mais elle ne sert pas de hub navigationnel — pour aller "saisir une dépense", il faut passer par la sidebar ou les liens contextuels des cards.

### 1.4 Liens entre pages

Analyse des cross-links détectés dans les pages :

| Depuis | Vers | Type lien |
|--------|------|-----------|
| `/comptabilite` (dashboard) | `/comptabilite/operations` (via card "Dernières écritures") | implicite (click row) |
| `/comptabilite` | `/comptabilite/health` (via HealthBanner) | bouton "Voir détails" |
| `/comptabilite/comptes-caisses/[id]` | `/comptabilite/operations/nouveau?caisse_id=…` | bouton "Ajouter une op" |
| `/comptabilite/categories/[id]` | `/comptabilite/operations/nouveau?categorie_id=…` | bouton "Ajouter une op" |
| `/comptabilite/etats-financiers` | les 4 états enfants | grille de cards |
| Toutes les autres pages | breadcrumb retour `/comptabilite` | navigation classique |

**Constat** : les pages sont **majoritairement en silo**. Pas de cross-link explicite entre Tiers et Opérations, entre Catégories et Plan comptable, ni entre Exercices et États financiers. L'utilisateur doit revenir à la sidebar à chaque changement de contexte.

---

## Section 2 — Analyse du toggle Simple / Avancé

### 2.1 Localisation

- **Champ BD** : `parametres_module_compta.mode_actif` (TEXT NOT NULL, CHECK `IN ('simple', 'avance')`, défaut `'simple'`)
  Source : `supabase/migrations/20260510120000_compta_module.sql` lignes 38-39
- **Où on le change** : `/comptabilite/parametres` → section "Mode" (1re des 5 sections)
- **Composant** : `components/compta/ModeSection.tsx` (deux cards radio Simple / Avancé)
- **Hook** : `hooks/compta/useToggleMode.ts` (polling 5s pendant la régénération rétroactive)

### 2.2 Ce que le toggle change réellement

D'après `lib/compta/ecritures.ts`, `lib/compta/reprise.ts`, et `components/compta/EcriturePreview.tsx` :

| Action / Élément | Mode Simple | Mode Avancé |
|---|---|---|
| Saisie d'une opération | OK, identique | OK, identique |
| Écriture comptable SYSCOHADA générée | **Non** | Oui (double partie) |
| Aperçu écriture dans le formulaire `/operations/nouveau` | "Mode Simple actif — pas d'écriture générée" | Aperçu détaillé débit/crédit |
| Pages `/etats-financiers/*` | Accessibles, mais Bilan/CR vides | Accessibles et remplies |
| Page `/plan-comptable` | Toujours visible | Toujours visible |
| Page `/health` | Toujours visible (mais checks vides) | Toujours visible |
| Sidebar compta | **Identique** dans les 2 modes (13 entrées) | Identique |

### 2.3 Le toggle simplifie-t-il vraiment ?

**Non, et il est trompeur.** Voici pourquoi :

1. **La sidebar ne change pas** : en mode Simple, l'utilisateur voit toujours "Bilan SYSCOHADA", "Compte de résultat", "Flux de trésorerie", "Notes annexes", "Plan comptable", "Santé compta" — pages qui n'ont aucune utilité en mode Simple (elles sont vides).

2. **Le mode Simple n'est PAS un mode novice** : c'est un mode "tracking sans compta". Pour un patron PME qui veut juste suivre ses entrées/sorties, c'est bien — mais ça ne masque rien.

3. **Basculer est anxiogène** :
   - Modal de confirmation à **double saisie** (taper "CONFIRMER")
   - Warning ambre : « **régénération rétroactive** de toutes les écritures (~N actuellement). Opération longue (~10 min) et irréversible »
   - Liste à 4 puces sur ce qui va se passer
   - Polling 5s post-basculement

   Pour un novice qui a tâtonné et veut « revenir en arrière », c'est un mur psychologique majeur.

4. **Le mode par défaut est `'simple'`** mais l'onboarding (`/comptabilite/onboarding`) propose probablement aussi le mode Avancé. À vérifier — risque qu'un patron passe en Avancé sans comprendre puis se retrouve devant des Bilans qu'il ne sait pas lire.

5. **Aucun message contextuel selon le mode** : sur la page Bilan, en mode Simple, il n'y a pas de message « Vous êtes en mode Simple, le Bilan ne contient pas vos écritures. Basculez en Avancé pour le générer. » L'utilisateur voit juste une page vide ou des zéros, sans comprendre pourquoi.

### 2.4 Résumé toggle

| Critère | Évaluation |
|---------|-----------|
| Le toggle existe-t-il ? | ✅ Oui |
| Est-il accessible facilement ? | ⚠️ Dans `/parametres` (3 clics minimum depuis le dashboard) |
| Le mode Simple cache-t-il les fonctionnalités expert ? | ❌ Non, la sidebar reste identique |
| Le mode Simple est-il sans risque (réversible) ? | ❌ Anxiogène : régénération rétroactive, double confirmation, irréversible psychologiquement |
| L'utilisateur sait-il dans quel mode il est ? | ⚠️ Pas d'indicateur permanent en haut de page (uniquement dans `/parametres`) |

---

## Section 3 — Tableau du vocabulaire

Termes comptables relevés dans les pages compta (occurrences brutes via grep) :

| Terme actuel UI | Occ. | Compréhensible novice ? | Alternative simple proposée |
|-----------------|-----:|-------------------------|------------------------------|
| **SYSCOHADA** | 31 | Non | « Norme comptable Afrique de l'Ouest » (sous-titre une fois) |
| **Bilan** | 22 | Oui (vague) | OK, garder + tooltip "Photo du patrimoine à une date" |
| **Écriture / Écritures** | 17 | Non | « Mouvement comptable » |
| **Journaux** | 10 | Non | « Carnets de saisie » ou simplement « Journaux d'achats / ventes / banque » |
| **Brouillon** | 8 | Oui | OK |
| **TFT** | 7 | Non | Toujours déplier en « Tableau des flux de trésorerie » |
| **SIG / 9 SIG** | 10 | Non | « Étapes du calcul du résultat » + tooltip |
| **Compte de résultat** | 7 | Oui (vague) | OK + sous-titre "Ce qui rentre vs ce qui sort" |
| **Clôture** | 2 | Oui | OK |
| **Partie double** | 1 | Non | « Écriture équilibrée (débit = crédit) » |
| **Soldes Intermédiaires de Gestion** | 1 | Non | « Étapes intermédiaires du résultat » |
| **EBE** | 2 | Non | « Excédent brut d'exploitation » + tooltip "Bénéfice avant amortissements et impôts" |
| **VA** | 2 | Non | « Valeur ajoutée » + tooltip |
| **RAO** | 1 | Non | « Résultat des activités ordinaires » |
| **HAO** | 1 | Non | « Activités exceptionnelles » |
| **CAFG** | 0 (TFT seulement) | Non | « Capacité d'autofinancement » + tooltip |
| **Dotation** | (catégorie) | Non | « Amortissement annuel » |
| **Reprise (sur amortissement)** | (catégorie) | Non | « Annulation d'amortissement » |
| **Provision** | — | Non | « Réserve pour risque futur » |
| **Lettrage** | (BD seulement, pas UI exposé) | Non | « Marquage facture ↔ paiement » |
| **Plan comptable** | 1 (titre page) | Non | « Catalogue des numéros de comptes » |
| **Mapping SYSCOHADA** | (Health) | Non | « Association compte ↔ poste de bilan » |
| **Auto-écriture résultat (compte 13)** | Phase 4.3 | Non | « Calcul automatique du résultat » |
| **Compte 891 / 130 / 139** | Phase 4.3 backend | Non | Ne devrait pas apparaître à l'UI |
| **Exercice clos / ouvert** | 4 | Oui | OK + tooltip "Période fiscale" |
| **RCCM** | 3 | Non (mais légal) | « Numéro registre du commerce » |
| **N° CC (Contribuable)** | 3 | Non | « Numéro d'identification fiscale » |
| **NIF** | 1 | Oui (en Afrique de l'Ouest) | OK |
| **Engagement hors bilan** | (Note 6) | Non | « Promesse non payée encore (cautions, garanties) » |
| **Capitaux propres** | (Bilan) | Non | « Argent appartenant à l'entreprise » |
| **Trésorerie-Actif / Trésorerie-Passif** | (Bilan) | Non | « Argent disponible » / « Argent à rembourser » |
| **Mapping** | (Health) | Non | « Association » |
| **Mode Avancé / Simple** | (Mode) | Mode Avancé : non, Mode Simple : oui | « Avec compta SYSCOHADA » vs « Suivi des entrées/sorties » |
| **Mode actif** | (header parametres) | Non | « Mode actuel » |
| **Mode de fonctionnement** | (titre section) | Oui | OK |

**Verdict** : sur **~30 termes spécialisés**, environ **20 sont incompréhensibles à un novice** sans tooltip ou sous-titre.

---

## Section 4 — Frictions UX par page

### 4.1 `/comptabilite` (dashboard)

- **But** : vue d'ensemble santé + chiffres clés
- **Clics min pour action principale** : 0 (lecture seule)
- **Champs obligatoires** : aucun
- **Friction** :
  - HealthBanner peut afficher un score sans expliquer ce qu'il mesure ("Santé compta : 72/100" → 72 sur quoi ?)
  - "Dernières écritures" : libellés type "OD-2026-0042" peuvent dérouter le novice
  - Aucun call-to-action visible "Saisir une opération" (pas de bouton primaire en haut)

### 4.2 `/comptabilite/operations` (liste)

- **But** : retrouver une opération
- **Clics min pour filtrer** : 1-3 (filtres en haut)
- **Friction** :
  - 9 filtres simultanés (date_from/to, type, statut, compte, caisse, catégorie, source, véhicule, chauffeur, client, tiers)
  - Colonne "Source" affiche des codes techniques (`recette_wave`, `transfert_interne`, `dotation_amort`) sans tooltip
  - Statut "brouillon" vs "valide" vs "annule" : sans formation comptable, on ne sait pas si "brouillon" est un état attendu ou une erreur

### 4.3 `/comptabilite/operations/nouveau` (saisie)

- **But** : enregistrer une entrée/sortie
- **Clics min pour valider** : 7-9 (type, montant, date, libellé, caisse, catégorie, [tiers], notes, valider)
- **Champs obligatoires** : type, montant, libellé (3+ car.), date, caisse, catégorie
- **Friction majeure** :
  - **Workflow Vague 3** : sortie + tiers → obligatoire d'enregistrer en **brouillon** puis uploader justif puis valider. **3 étapes**, mais le message « (sortie vers tiers — enregistre en brouillon puis uploade) » est petit et tardif (apparaît dans `missingForValidate`, pas au moment du choix tiers).
  - **EcriturePreview** : encart "Aperçu écriture SYSCOHADA" affiché par défaut en mode Avancé. Pour un novice, voir « DEBIT 6052 / CREDIT 5311 » est intimidant et inutile.
  - **CategorieSelector** : si la catégorie a un sens incompatible (ex catégorie "Recette" sur type "Sortie"), elle disparaît silencieusement de la liste. L'utilisateur peut chercher pourquoi « sa » catégorie n'apparaît plus.
  - **Tiers** : popover quick-create permet de créer un tiers à la volée mais nécessite quand même de saisir le compte parent SYSCOHADA (401/411). À nouveau du jargon.

### 4.4 `/comptabilite/comptes-caisses` et `/comptabilite/categories` et `/comptabilite/tiers`

- **But** : gestion CRUD
- **Friction** :
  - Sur chaque création, champ obligatoire `compte_syscohada_code` ou `compte_syscohada_parent`. Pour un patron, choisir "5711" ou "5712" pour une caisse, c'est de la divination.
  - Les libellés des comptes sont visibles via le PlanCompteSelect, mais c'est encore une liste de 200+ codes à parcourir.

### 4.5 `/comptabilite/etats-financiers/*`

- **But** : générer Bilan, CR, TFT, Notes pour la DGI/banque
- **Clics min** : 2 (sélectionner exercice → "Exporter PDF officiel")
- **Friction** :
  - Pages purement comptables, **inadaptées à un patron** qui ne sait pas interpréter un Bilan
  - Aucun encart "Que faire de ce PDF ?" / "À qui le donner ?" / "Quand ?"
  - Pas de garde-fou : on peut générer un Bilan déséquilibré (encart rouge ✗ Déséquilibre s'affiche, mais le PDF est tout de même téléchargeable)

### 4.6 `/comptabilite/exercices`

- **But** : créer + clôturer les exercices annuels
- **Friction** :
  - Le bouton **"Clôturer"** ouvre `ClotureModal` avec un workflow lourd. Pour un novice qui ne sait pas si "clôturer" = "fermer" (sens commun) ou "passage à l'exercice suivant" (sens comptable), c'est anxiogène.
  - Aucune simulation "à blanc" avant clôture (le résultat net + auto-écriture sont créés, mais on ne peut pas pre-visualiser le PDF Bilan AVANT de clôturer).
  - Vague 3 / Phase 4.3 : la clôture déclenche `ajusterResultatExercice` automatiquement — bonne chose, mais aucun feedback visuel "Calcul du résultat en cours..." dans la modal.

### 4.7 `/comptabilite/parametres`

- **But** : paramétrer le module
- **Friction** :
  - 5 sections scrollées (Mode, Exercice, Workflow, Société, Zone dangereuse)
  - "Zone dangereuse" : termes comme `reset_demo`, `purge_old_drafts` exposés à l'utilisateur. Erreur destructrice possible.
  - Section "Workflow" : flag `workflow_validation_actif` (vrai/faux) mais aucune explication concrète de ce que ça change.

### 4.8 `/comptabilite/health`

- **But** : audit santé compta
- **Friction** :
  - **Page d'expert pure**. 5 accordéons : Équilibre / Cohérence ops↔écritures / Mappings SYSCOHADA / Cohérence journaux / Statistiques globales.
  - Score sur 100 (« 87/100 ») sans détail des seuils
  - Anomalies type "Écriture #OD-2026-0042 déséquilibrée de 12 F" — exigent une compréhension comptable pour décider quoi faire
  - **Pas réservée au mode Avancé** — visible aussi en mode Simple où elle n'a aucun sens

### 4.9 `/comptabilite/plan-comptable`

- **But** : consulter le plan SYSCOHADA
- **Friction** :
  - **Page d'expert pure**. 9 classes accordéon (1 Capitaux, 2 Immo, 3 Stocks, 4 Tiers, 5 Trésorerie, 6 Charges, 7 Produits, 8 HAO, 9 Analytique).
  - ~200 comptes affichés. Recherche fonctionne mais sans contexte (chercher "carburant" trouve 6052 mais l'utilisateur n'a aucune idée si c'est le bon).
  - **Visible en mode Simple** où elle est totalement inutile.

### 4.10 `/comptabilite/exports`

- **But** : générer des PDF (Grand Livre, Balance, Journaux, Relevés, Rapport mensuel)
- **Friction** :
  - 5 types de rapports → 5 cards. Sans formation, "Grand Livre" et "Balance" se ressemblent.
  - Multi-sélection journaux/caisses : OK ergonomiquement, mais le novice ne sait pas quels journaux il veut.

### 4.11 `/comptabilite/onboarding`

- **But** : wizard premier login, force le bootstrap (création des 5 caisses + 14 catégories standards)
- **Friction** :
  - Forçage : `parametres_module_compta.premier_login_effectue=false` → redirige systématiquement vers `/comptabilite/onboarding` jusqu'à validation.
  - L'utilisateur ne peut pas dire "je veux juste explorer". Tout-ou-rien.

---

## Section 5 — Points forts à préserver

### 5.1 Le dashboard `/comptabilite`

- Très bien construit visuellement : KPIs, charts, donut, bar chart
- HealthBanner + MissingProofBanner = signaux faibles bien remontés
- Lecture immédiate sans formation comptable (on voit les chiffres, on comprend la tendance)
- Comparatif périodes (Ce mois / Mois précédent / 3 mois / Tout)
- **À garder absolument tel quel** pour un patron PME

### 5.2 Le workflow brouillon → justificatif → valider (Vague 3)

- Force la complétude des dépenses sortie+tiers (pas de fausse manip)
- Cohérent avec un usage SaaS multi-tenants futur
- À garder mais à mieux signaler dans l'UI

### 5.3 L'EcriturePreview en temps réel

- En mode Avancé, montrer l'aperçu de l'écriture pendant la saisie est pédagogique
- Permet à un patron qui veut apprendre la compta de comprendre ce que ses gestes produisent
- À garder mais avec un toggle "afficher/masquer l'aperçu technique"

### 5.4 La hiérarchie des PDFs officiels (Phase 4.2 + 4.3)

- Bilan / CR / TFT / Notes individuels + Dossier complet unifié = pile fonctionnelle complète
- QR code + URL courte + hash = traçabilité solide
- À garder

### 5.5 Le système Tiers (Vague 2)

- Compte parent SYSCOHADA + suffixe = ergonomie correcte pour la compta
- Quick-create dans le formulaire d'opération = bonne UX
- Filtrage par type (client/fournisseur/salarié/autre) cohérent

### 5.6 La gestion d'exercices (Phase 4.2)

- Workflow clôture protégé par triggers (statut clos = immutable)
- Cohérence Vague 1+2+3 préservée
- À garder, à mieux expliquer

### 5.7 Le hub `/etats-financiers` (Phase 4.3)

- Carte "Dossier complet" très lisible
- 4 cards états individuels avec icônes parlantes
- Bon exemple d'architecture "menu visuel" pour les autres sections

---

## Section 6 — Recommandations UX (5-10)

Classement par **impact** (gros / moyen / petit) × **effort** (facile / moyen / lourd).

### Reco #1 — Refondre le mode Simple en vrai mode "Patron novice" 🟢
**Impact : Gros · Effort : Moyen**

En mode Simple actuel, la sidebar montre 13 entrées dont 8 sont expert (Plan comptable, Health, États financiers, Notes annexes, TFT, Exercices, Exports, Paramètres). Décision à prendre :

- **Option A** : masquer ces 8 entrées en mode Simple → sidebar à 5 entrées (Dashboard, Comptes/Caisses, Catégories, Tiers, Opérations). Le toggle reprend son sens.
- **Option B** : créer un 3e mode "Patron débutant" entre Simple et Avancé, qui montre uniquement Dashboard + Opérations + Comptes/Caisses + Tiers.

Cohérent avec la stratégie SaaS future (multi-tenants : chaque tenant choisit son niveau).

### Reco #2 — Indicateur de mode permanent en haut de page 🟢
**Impact : Gros · Effort : Facile**

Pill en haut de chaque page compta : « Mode Simple » (icône Pencil, fond gris) ou « Mode Avancé » (icône BookOpen, fond violet). Click → ouvre direct la section Mode dans `/parametres`. Évite l'effet « je ne sais plus dans quel mode je suis ».

### Reco #3 — Tooltips systématiques sur les termes techniques 🟢
**Impact : Gros · Effort : Facile**

Ajouter `<Tooltip>` sur tous les termes du tableau Section 3 (~20 termes). Implémentation : composant `<TermAide term="SYSCOHADA">SYSCOHADA</TermAide>` qui affiche un popover avec définition courte (1-2 lignes). Réutilisable dans toute l'application. Pas de refonte du contenu.

### Reco #4 — Réorganiser la sidebar compta en groupes collapsibles 🟡
**Impact : Moyen · Effort : Moyen**

Aujourd'hui 13 entrées plates. Proposition :
```
COMPTABILITÉ
  📊 Tableau de bord       → /comptabilite
  💸 Mes opérations        → /comptabilite/operations
  🏦 Mes comptes et caisses → /comptabilite/comptes-caisses
  👥 Mes tiers             → /comptabilite/tiers
  📁 Mes catégories        → /comptabilite/categories
  ▼ États & exports (expert)
      ├ États financiers
      ├ Exports PDF
      └ Plan comptable
  ▼ Paramètres
      ├ Société (logo, RCCM)
      ├ Exercices
      ├ Paramètres compta
      └ Santé compta
```
Le groupe "États & exports" est replié par défaut en mode Simple, déplié en mode Avancé.

### Reco #5 — Bouton "Saisir une opération" persistent 🟢
**Impact : Gros · Effort : Facile**

Aujourd'hui, pour saisir une dépense, il faut : sidebar → Opérations → bouton "+ Nouvelle" → formulaire. **4 clics**. Solution : FAB (Floating Action Button) en bas-droite sur toutes les pages compta, ou bouton primaire permanent dans `DashboardHeader`. **1 clic**.

### Reco #6 — Pré-remplissage intelligent des `compte_syscohada_code` 🟡
**Impact : Moyen · Effort : Moyen**

Lors de la création d'une caisse, d'une catégorie ou d'un tiers, **deviner** le compte SYSCOHADA selon le libellé saisi :
- "Caisse principale" → suggérer 5711
- "Carburant" → suggérer 6052
- Tiers nom = "GA" + type=fournisseur → suggérer 401 (auto-rempli, modifiable)

Le novice ne voit le code qu'en lecture seule ("Compte SYSCOHADA : 5711 — Caisses en monnaie nationale"). Un expert peut éditer.

### Reco #7 — Ajouter une page "Aide & glossaire" 🟡
**Impact : Moyen · Effort : Facile**

Une page `/comptabilite/aide` qui regroupe :
- Qu'est-ce qu'un Bilan ? Un Compte de résultat ? Un TFT ?
- Quand clôturer un exercice ?
- Comment lire un PDF officiel ?
- Glossaire (les 20 termes du tableau Section 3)

Lien depuis la sidebar (icône ❓) et depuis chaque page d'état financier ("En savoir plus").

### Reco #8 — Workflow Brouillon → Justif → Valider mieux signalé 🟡
**Impact : Moyen · Effort : Facile**

Sur `/operations/nouveau`, dès que `type=sortie + tiers≠null`, afficher un **encart bleu permanent** :
```
ℹ️ Pour cette opération (sortie vers tiers), une procédure spéciale s'applique :
   1. Enregistrer en brouillon (bouton ci-dessous)
   2. Uploader un justificatif (étape suivante)
   3. Valider l'opération
```
Aujourd'hui le message est tardif et caché dans une liste `missingForValidate`.

### Reco #9 — Simulateur "à blanc" pour la clôture d'exercice 🟡
**Impact : Moyen · Effort : Moyen**

Avant de cliquer "Clôturer", proposer un bouton "Simuler" qui :
- Calcule le résultat net
- Pré-visualise le PDF Bilan
- Liste les ops brouillon bloquantes
- N'écrit rien en BD

Réduit l'angoisse de l'opération irréversible.

### Reco #10 — Désamorcer le toggle Mode (réécriture du copy) 🟢
**Impact : Gros · Effort : Facile**

Aujourd'hui les copy disent : « régénération rétroactive (~10 min) et irréversible. Confirmation à double saisie requise. »

Pour un novice, c'est terrorisant. Réécrire :
- Mode Avancé : « Active la comptabilité complète. Tous vos mouvements seront classés en partie double (norme SYSCOHADA). Recommandé pour fournir un Bilan officiel. »
- Mode Simple : « Suivi simplifié de vos entrées/sorties. Pas de comptabilité SYSCOHADA. Vous pouvez basculer en Avancé à tout moment. »

Garder la double confirmation pour le passage Avancé → Simple (perte d'écritures), mais simplifier pour Simple → Avancé (création d'écritures, réversible).

---

## Synthèse priorisée

| # | Reco | Impact | Effort | Priorité |
|--:|------|:-:|:-:|:-:|
| 1 | Vrai mode Simple = sidebar épurée | 🟢 Gros | Moyen | **P0** |
| 2 | Indicateur mode permanent | 🟢 Gros | Facile | **P0** |
| 3 | Tooltips termes techniques | 🟢 Gros | Facile | **P0** |
| 5 | Bouton "Saisir opération" persistent | 🟢 Gros | Facile | **P0** |
| 10 | Réécriture copy toggle Mode | 🟢 Gros | Facile | **P0** |
| 4 | Sidebar compta en groupes | 🟡 Moyen | Moyen | P1 |
| 6 | Pré-remplissage SYSCOHADA | 🟡 Moyen | Moyen | P1 |
| 8 | Workflow Brouillon→Justif visible | 🟡 Moyen | Facile | P1 |
| 7 | Page Aide & glossaire | 🟡 Moyen | Facile | P2 |
| 9 | Simulateur clôture | 🟡 Moyen | Moyen | P2 |

**5 quick wins P0** (gros impact, effort faible à moyen) peuvent transformer l'expérience d'un patron PME novice sans toucher au backend.

---

## Conclusion

Le module Comptabilité est **fonctionnellement riche et techniquement solide** (4 982 lignes UI, 23 pages, écritures double partie, états financiers SYSCOHADA, traçabilité hash+QR…). Mais il a été conçu d'abord **pour le comptable**, pas pour le **patron PME**.

Les frictions UX principales :
1. La sidebar montre **trop de choses à la fois** quel que soit le mode
2. Le **toggle Simple/Avancé est trompeur** : il ne masque rien, il bloque juste la génération d'écritures
3. Le **vocabulaire est massivement technique** sans tooltip
4. Les **codes SYSCOHADA bruts** (5711, 401, 6052…) sont exigés à la saisie
5. Les **page d'expert** (Health, Plan comptable, TFT, Notes annexes) sont visibles même quand inutiles

Les points forts à préserver : le **dashboard d'accueil**, le **workflow Brouillon→Justif→Valider** (Vague 3), l'**EcriturePreview pédagogique**, et la **hiérarchie PDF officiels** (Phase 4.2+4.3).

**5 quick wins P0** suffisent à transformer l'UX sans refonte profonde.
