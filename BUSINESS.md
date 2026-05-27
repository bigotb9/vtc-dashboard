# VTC-DASHBOARD — Documentation métier

Plateforme de gestion de flotte VTC pour la Côte d'Ivoire. Ce document explique **comment ça marche côté métier** — qui fait quoi, comment l'argent circule, quels sont les concepts qu'il faut connaître pour comprendre les choix produit.

---

## 1. Le métier de gestionnaire de flotte VTC

Un gestionnaire de flotte VTC (la **direction**, ex: Boyah Group) :

1. **Possède ou loue des véhicules** (Toyota Yaris, Suzuki Swift, etc.)
2. **Recrute des chauffeurs** (qui n'ont pas leur propre voiture)
3. **Met chauffeur + voiture sur Yango** (ou Bolt, Uber, …) — la plateforme VTC qui apporte les clients
4. **Encaisse une partie des revenus** des chauffeurs sous forme de **versement quotidien fixe**

### Le cycle d'une journée type

1. Le chauffeur prend la voiture le matin et travaille la journée (lundi → samedi en général, dimanche non ouvré)
2. Les clients lui paient les courses sur Yango (en espèces ou par carte/Wave)
3. À la fin de la journée, le chauffeur **reverse** un montant fixe (ex: 22 000 FCFA) au gestionnaire **par Wave** (mobile money très utilisé en Côte d'Ivoire)
4. Le reste est la rémunération du chauffeur
5. Si le chauffeur ne fait pas son versement → c'est tracké comme **manquant**, à justifier ou à régler

### Comment le gestionnaire gagne de l'argent

- **Marge sur le versement** : il paie le carburant/maintenance/assurance/crédit voiture, garde la différence
- **Volume** : plus il a de voitures qui roulent tous les jours, plus il fait de marge
- **Optimisation** : moins de pannes, moins de jours d'inactivité, meilleurs chauffeurs = meilleure rentabilité

---

## 2. Les utilisateurs de la plateforme

| Rôle | Qui c'est | Ce qu'il fait |
|---|---|---|
| **Directeur** | Le patron / décideur | Accès complet. Voit tout, configure les permissions des autres rôles. |
| **Admin** | Gestionnaire opérationnel | Crée chauffeurs/véhicules, saisit les dépenses, valide les justifications. Permissions configurables. |
| **Dispatcher** | Personne au quotidien | Suivi des chauffeurs, rapide check des recettes, alertes. Permissions limitées. |

Les **chauffeurs eux-mêmes ne sont pas utilisateurs** de l'app. Ils utilisent uniquement Yango pour rouler et Wave pour faire leurs versements. La plateforme est purement un **outil de pilotage** pour la direction.

---

## 3. Concepts clés à connaître

### Versement
Montant fixe quotidien (ex: 22 000 FCFA pour une berline, 15 000 pour une plus petite) que **le chauffeur doit reverser** à la direction. C'est le contrat. C'est ce que la direction attend chaque jour ouvré.

### Jour d'exploitation
La semaine de travail = **lundi à samedi**. Dimanche = jour non ouvré, pas de versement attendu. Les jours fériés sont tarifés à un montant réduit (15 000 FCFA par défaut).

### Recette Wave
Quand un chauffeur fait un versement par Wave, c'est une "recette" qu'on importe dans la plateforme. Chaque recette est associée à un numéro Wave (le tél du chauffeur).

### Attribution
Comme une recette Wave arrive avec une horodatage (par exemple lundi 10h), il faut décider : **à quel jour d'exploitation et quel véhicule cette recette correspond-elle ?** Réponses :

- Reçue **lundi matin** → c'est généralement le versement de **samedi** (le chauffeur a roulé samedi, payé le lundi, dimanche non ouvré)
- Reçue **mardi** → versement de **lundi**
- Reçue **dimanche** → versement de **samedi** (rattrapage)
- 2 versements le même jour → 1ère = jour précédent, 2ème = même jour (cas où un chauffeur paie 2 jours d'un coup)
- Versement double du montant attendu → split sur 2 jours ouvrés

L'algorithme d'attribution gère tout ça automatiquement. Le résultat : pour chaque (véhicule, jour ouvré), on sait si **le versement attendu a été fait** ou non.

### Affectation chauffeur ↔ véhicule
Une affectation = "le chauffeur X conduit la voiture Y du JJ/MM/AAAA au JJ/MM/AAAA" (ou en cours, sans date de fin). Permet à l'algorithme d'attribution de savoir à quel véhicule rattacher la recette d'un chauffeur.

### Statut versement (suivi)
Pour chaque (véhicule × jour ouvré) :

- **Payé complet** : versement reçu au moins à 99% du montant attendu (1% de tolérance pour les frais Wave)
- **Insuffisant** : reçu mais < 99% du montant
- **Manquant** : aucun versement reçu
- **Justifié** : insuffisant ou manquant + une justification saisie (panne, accident, hospitalisation, etc.)
- **Jour férié** : justifié automatiquement
- **En cours** : c'est aujourd'hui, on attend encore
- **Hors flotte** : avant l'arrivée du véhicule dans la flotte
- **Dimanche** : jour non ouvré

### Statut chauffeur (AI Insights)
- **Actif** : a fait des courses cette semaine
- **À risque** : a fait des courses ce mois mais aucune cette semaine → risque de désengagement, à contacter
- **Inactif** : aucune course ce mois → soit nouveau jamais lancé, soit perdu

---

## 4. Les sections de l'application

### Dashboard
Vue d'ensemble pour la direction :

- **CA total / aujourd'hui / mensuel** : chiffre d'affaires de la flotte (somme des recettes encaissées)
- **Dépenses totales / Profit net** : KPIs financiers
- **Véhicules / Chauffeurs** : compteurs flotte
- **Chiffre d'affaires journalier / 30j** : graphique tendance
- **Top chauffeurs / Top véhicules** : qui rapporte le plus
- **Alertes paiements** : véhicules avec manquants à traiter
- **Alertes documents** : assurance/visite technique qui expire bientôt

### Véhicules
Liste de tous les véhicules avec immatriculation, modèle, statut, photo. Chaque véhicule a une **fiche détaillée** :

- Photos, infos administratives (carte grise, assurance, visite technique avec dates d'expiration)
- KPIs financiers (CA généré, dépenses, profit)
- Affectation chauffeur courante
- Historique des entretiens et tâches
- Recettes du véhicule

### Chauffeurs
Liste des chauffeurs avec photo, nom, numéro Wave, statut actif/inactif. Chaque chauffeur a une **fiche détaillée** :

- Photo, contact, situation (CNI, permis, garant)
- Véhicule actuel + historique d'affectations
- CA généré sur la période
- Suivi versements

### Recettes
Liste des recettes Wave importées. Pour chaque recette :

- Date / horodatage Wave
- Numéro de téléphone source
- Montant
- Véhicule attribué (résolu par l'algorithme)
- Jour d'exploitation attribué

Permet aussi d'**importer un CSV Wave** pour bulk-uploader les versements.

### Recettes / Suivi (calendrier)
**LE point central de pilotage**. Une grille de cases : véhicules en lignes, jours en colonnes. Chaque case affiche le statut versement (vert = payé, rouge = manquant, ambre = insuffisant, etc.). Permet en un coup d'œil de voir :

- Les véhicules problématiques (beaucoup de rouge)
- Les jours problématiques (beaucoup de manquants un même jour = alerte qui ne fonctionne pas ?)
- Cliquer sur une case manquante → ouvrir une justification

### Dépenses
Saisie et liste des dépenses de la flotte : carburant, entretien, réparation, fournitures, assurance, contraventions, etc. Catégorisé par type. Possible aussi de marquer une dépense d'**immobilisation** (le véhicule était hors-service du JJ/MM au JJ/MM, donc pas de versement attendu sur cette période).

### AI Insights
Analyse hebdomadaire générée par IA (Claude). Propose :

- Synthèse des performances de la flotte
- Véhicules en retard de paiements
- Tendances (baisse / hausse vs semaine dernière)
- Recommandations actionnables

### Journal d'activité
Trace toutes les actions des utilisateurs (qui a créé/modifié/supprimé quoi, et quand). Pour audit et traçabilité.

### Paramètres
- **Profil** utilisateur (nom, avatar, mot de passe)
- **Utilisateurs** (directeur uniquement) : créer/désactiver des comptes
- **Permissions** (directeur uniquement) : matrice rôles × actions
- **Jours fériés** (directeur uniquement) : ajouter les fériés CI avec montant attendu spécifique

---

## 5. La sous-section Boyah Transport

C'est une **vertical métier spécifique** (différente de la flotte principale). Boyah Transport gère des **prestataires** (chauffeurs qui ont leur propre voiture, ne dépendent pas de la flotte direction) qui roulent sur Yango sous le compte de la société.

Le modèle économique est différent de la flotte principale :
- Le prestataire utilise SA voiture
- Il roule sous le compte Yango de Boyah Transport
- Boyah Transport perçoit une **commission** sur chaque course (typiquement 2,5%)
- Le prestataire garde le reste

### Pages spécifiques

- **Dashboard Boyah Transport** : CA, commissions, taux de complétion, top chauffeurs/véhicules. Période 30j de courbes revenus + commission.
- **Commandes** : liste des courses Yango avec recherche, filtres par statut, plage de dates
- **Prestataires** (= chauffeurs Boyah Transport) : CRUD spécifique
- **Véhicules** Boyah Transport : CRUD spécifique
- **AI Insights Boyah Transport** :
   - Score de santé de la flotte
   - Top performers
   - Alertes décisionnelles ("X prestataires à risque", "Y% inactifs", etc.)
   - **Bouton WhatsApp par chauffeur** : génère un message personnalisé avec ses chiffres réels (X courses ce mois, dernière activité, offre d'aide). Ouvre WhatsApp Web/mobile prêt à envoyer.
   - **Générateur de posts Facebook/Instagram/LinkedIn** : produit des posts marketing avec les KPIs du moment

### Synchronisation Yango
Bouton "Sync" qui appelle l'API Yango et récupère :
- La liste des chauffeurs (profils + soldes + statuts)
- La liste des véhicules
- **Toutes les courses** (en cours, terminées, annulées) sur la période demandée

Le sync est incrémental : la 1ère fois on remonte sur tout l'historique, ensuite seulement les nouvelles courses depuis la dernière sync.

---

## 6. Intégrations externes

| Intégration | Rôle métier |
|---|---|
| **Yango Fleet API** | Source de vérité pour les chauffeurs/véhicules/courses du Boyah Transport. Aussi utilisé pour créer/modifier ces entités côté Yango directement depuis l'app. |
| **Wave** | Source des recettes (versements des chauffeurs). Import CSV manuel ou via webhook. |
| **Claude AI** | Génération des AI Insights, des posts marketing, du chat assistant. |
| **n8n** (workflow externe) | Orchestre les analyses planifiées (cron quotidien d'AI Insights). |
| **Telegram** | Bot d'analyse à la demande — l'admin peut envoyer une question au bot pour avoir un compte-rendu instantané. |
| **Resend** | Envoi des emails (invites, rappels, etc.) |

---

## 7. Concepts qu'il faut absolument intérioriser

1. **Tout tourne autour du versement quotidien**. C'est le KPI principal. Manquant = problème → action.

2. **Le chauffeur n'utilise pas l'app**. Il utilise Yango pour rouler et Wave pour payer. La plateforme c'est pour la **direction qui supervise**.

3. **Yango ≠ la plateforme**. Yango c'est l'agrégateur qui apporte les clients. La plateforme c'est l'outil de gestion interne. Les deux sont distincts mais reliés via l'API Yango.

4. **Côte d'Ivoire = Wave**. Wave est le mobile money dominant. C'est par là que les chauffeurs paient. **Pas Stripe, pas Visa.** Si on parle "paiement", on parle Wave en priorité.

5. **Le sous-domaine Boyah Transport est différent**. Modèle économique différent (commission sur prestataire au lieu de versement quotidien). Ne pas mélanger les deux dans les calculs ou les vues.

6. **Le calendrier de suivi est l'outil n°1**. C'est là que la direction passe le plus de temps. Toute amélioration sur ce flux a un impact direct.

7. **Les dimanches et fériés sont sacrés**. Le code distingue strictement les jours ouvrés (lun-sam, hors fériés) des autres. Toute logique financière doit le respecter.

8. **L'historique des affectations est important**. Un chauffeur peut avoir conduit 3 voitures différentes sur 6 mois. Une recette Wave reçue aujourd'hui peut concerner une voiture qu'il ne conduit plus depuis 2 semaines. L'algorithme d'attribution gère cette complexité.

9. **Les permissions sont fines**. Chaque rôle a une matrice d'actions autorisées. Un dispatcher ne peut pas créer de chauffeur, un admin ne peut pas modifier les permissions, etc. À toujours vérifier avant de proposer un nouveau bouton.

10. **Tous les textes utilisateur sont en français**. Pas de mélange français/anglais dans l'UI. Les commentaires de code peuvent rester en anglais.

---

## 8. Glossaire rapide

| Terme | Définition |
|---|---|
| **VTC** | Voiture de Transport avec Chauffeur |
| **CA** | Chiffre d'affaires |
| **Versement** | Montant quotidien fixe qu'un chauffeur reverse à la direction |
| **Jour d'exploitation** | Jour de travail effectif (lun-sam, hors férié) |
| **Recette Wave** | Paiement reçu par Wave d'un chauffeur |
| **Attribution** | Algorithme qui associe une recette Wave à un (véhicule, jour) précis |
| **Affectation** | Liaison chauffeur ↔ véhicule sur une période |
| **Manquant** | Versement attendu non reçu |
| **Justification** | Raison métier validant un manquant ou un insuffisant |
| **FCFA** | Franc CFA, devise locale (1 € ≈ 655 FCFA) |
| **Prestataire** | Chauffeur Boyah Transport avec voiture personnelle (pas de la flotte) |
| **Yango** | Plateforme VTC majoritaire en CI (l'équivalent local d'Uber) |
| **Wave** | Mobile money dominant en CI |
