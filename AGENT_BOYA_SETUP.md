# BOYA – Guide de mise en place de l'Agent IA

## Ce qui a été créé

| Fichier | Rôle |
|---------|------|
| `supabase/migration-agent.sql` | Tables Supabase pour la mémoire et conversations |
| `app/api/agent/process/route.ts` | Cerveau de l'agent (Next.js) |
| `n8n-workflows/01-agent-telegram.json` | Conversation Telegram temps réel |
| `n8n-workflows/02-rapport-matinal.json` | Rapport automatique à 7h |
| `n8n-workflows/03-alertes-auto.json` | Alertes intelligentes toutes les 4h |
| `n8n-workflows/04-veille-marche.json` | Veille marché chaque dimanche |

---

## Étape 1 – Supabase : créer les tables

1. Ouvrir **Supabase Dashboard** → **SQL Editor**
2. Copier-coller le contenu de `supabase/migration-agent.sql`
3. Cliquer **Run**

---

## Étape 2 – Créer le Bot Telegram

1. Ouvrir Telegram, chercher **@BotFather**
2. Envoyer `/newbot`
3. Nom du bot : `Boya Assistant`
4. Username : `boyah_boya_bot` (ou autre disponible)
5. BotFather te donne un **token** → copier (ex: `7234567890:AAFxxx...`)

**Obtenir ton Chat ID :**
1. Chercher `@userinfobot` sur Telegram
2. Envoyer n'importe quel message → il t'affiche ton Chat ID (ex: `123456789`)

---

## Étape 3 – Variables d'environnement (.env.local)

Ajouter dans `vtc-dashboard/.env.local` :
```
ANTHROPIC_API_KEY=sk-ant-api03-... (déjà présent ✅)
TELEGRAM_BOT_TOKEN=7234567890:AAFxxx...
TELEGRAM_CHAT_ID=123456789
```

---

## Étape 4 – n8n : installer et configurer

### Sur ton VPS (Docker) :
```bash
docker run -d \
  --name n8n \
  -p 5678:5678 \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=boyah2025 \
  -e NEXTJS_URL=https://ton-domaine.com \
  -e TELEGRAM_CHAT_ID=123456789 \
  -v n8n_data:/home/node/.n8n \
  n8nio/n8n
```

### Variables d'environnement n8n :
Dans **n8n → Settings → Variables** :
| Clé | Valeur |
|-----|--------|
| `NEXTJS_URL` | `https://ton-domaine.com` (ou `http://localhost:3000` en dev) |
| `TELEGRAM_CHAT_ID` | `123456789` (ton chat ID) |

---

## Étape 5 – n8n : Credential Telegram

1. **n8n → Credentials → New → Telegram API**
2. Nom : `Boyah Bot`
3. Access Token : coller le token BotFather
4. Sauvegarder → noter l'ID de la credential

5. Dans chaque workflow JSON, remplacer `TELEGRAM_CREDENTIAL_ID` par l'ID réel

---

## Étape 6 – Importer les 4 workflows

Pour chaque fichier `n8n-workflows/*.json` :
1. **n8n → Workflows → Import from File**
2. Sélectionner le fichier JSON
3. Activer le workflow (toggle **Active**)

---

## Étape 7 – Tester

1. Ouvrir Telegram → ton bot
2. Envoyer `/start` puis un message : `Quelle est la performance d'aujourd'hui ?`
3. BOYA doit répondre en analysant tes données en temps réel

### Commandes disponibles :
| Commande | Action |
|----------|--------|
| `/rapport` | Génère un rapport complet maintenant |
| `/alerte` | Vérifie les anomalies maintenant |
| `/marche` | Lance une veille marché |
| `/memoire` | Affiche ce que BOYA a mémorisé |
| Message libre | Conversation intelligente avec accès aux données |

---

## Capacités de BOYA

### Accès aux données (temps réel)
- ✅ Revenus (CA journalier, mensuel, annuel)
- ✅ Dépenses par catégorie
- ✅ Classement et performance des chauffeurs
- ✅ État de la flotte de véhicules
- ✅ Commandes Yango + commissions 2,5%

### Automatisations
- ✅ Rapport matinal 7h chaque jour
- ✅ Surveillance anomalies toutes les 4h
- ✅ Veille marché hebdomadaire (dimanche)

### Mémoire et apprentissage
- ✅ Se souvient des décisions importantes
- ✅ Mémorise les préférences et contexte
- ✅ Historique des conversations Telegram
- ✅ Archive tous les rapports et analyses

---

## Architecture technique

```
Tu (Telegram)
    ↓ message
n8n (Workflow 01)
    ↓ POST
/api/agent/process (Next.js)
    ↓ fetch en parallèle
Supabase (toutes les vues + commandes_yango + mémoire)
    ↓ contexte complet
Claude claude-opus-4-6 (cerveau)
    ↓ réponse + mémoires extraites
n8n → Telegram (réponse)
Supabase (sauvegarde conversation + mémoire)
```
