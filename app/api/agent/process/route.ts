import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Tavily Web Search ─────────────────────────────────────────────────────────
const MARKET_KEYWORDS = ["marché", "concurrent", "yango", "indriver", "bolt", "actualité", "tendance", "prix", "réglementation", "afrique", "abidjan", "vtc", "transport", "uber"]

async function tavilySearch(query: string): Promise<string> {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key:      process.env.TAVILY_API_KEY,
        query,
        search_depth: "basic",
        max_results:  5,
        include_answer: true,
      }),
    })
    const data = await res.json()
    if (!data.results?.length) return ""

    const summary = data.answer ? `Résumé : ${data.answer}\n\n` : ""
    const sources = data.results
      .map((r: { title: string; content: string; url: string }) =>
        `• ${r.title}\n  ${r.content?.slice(0, 200)}...\n  Source: ${r.url}`
      )
      .join("\n\n")
    return `${summary}${sources}`
  } catch {
    return ""
  }
}

// ── Personnalité et rôle de l'agent ──────────────────────────────────────────
const SYSTEM_PROMPT = `⚡ INSTRUCTION PRIORITAIRE N°1 :
Tu reçois une demande → tu l'EXÉCUTES immédiatement. Point.
NE JAMAIS commencer par "Bonjour", "Boss", "Salut", une présentation de tes capacités, ou un menu d'options.
Si la demande est un rapport → génère le rapport. Si c'est une analyse de marché → fais l'analyse. Si c'est un bilan → produis le bilan. DIRECTEMENT. SANS INTRODUCTION.

---

Tu es BOYA, l'IA de Boyah Group (VTC, Côte d'Ivoire). Tu analyses les données en temps réel et fais des recommandations stratégiques.

Contexte : Abidjan, marché Yango/InDriver/Bolt. Saisonnalité fêtes. Commission Boyah Transport : 2,5%/course Yango.

💾 MÉMORISATION — quand tu identifies un fait clé à retenir, ajoute en fin de réponse (invisible pour l'utilisateur) :
[MEM]categorie|cle_unique|valeur|importance_1_10[/MEM]
Catégories : entreprise | marche | decision | chauffeur | vehicule | preference | kpi

🗣️ STYLE : Français, emojis Telegram, direct, orienté action, max 600 mots sauf analyse complète demandée.`

type ConvMessage = { role: "user" | "assistant"; content: string }

// ── Agrégation des données ────────────────────────────────────────────────────
async function fetchContext() {
  const today       = new Date().toISOString().slice(0, 10)
  const monthPrefix = new Date().toISOString().slice(0, 7)
  const weekAgo     = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [
    { data: chauffeurs },
    { data: vehicules },
    { data: recettes },
    { data: depenses },
    { data: caJour },
    { data: caMois },
    { data: classement },
    { data: commandesRaw },
    { data: memory },
  ] = await Promise.all([
    sb.from("vue_chauffeurs_vehicules").select("*"),
    sb.from("vue_dashboard_vehicules").select("*"),
    sb.from("recettes_wave").select("*").order("Horodatage", { ascending: false }).limit(100),
    sb.from("vue_depenses_categories").select("*"),
    sb.from("vue_ca_journalier").select("*").order("date", { ascending: false }).limit(30),
    sb.from("vue_ca_mensuel").select("*").order("annee", { ascending: false }).order("mois", { ascending: false }).limit(12),
    sb.from("classement_chauffeurs").select("*").order("ca", { ascending: false }),
    sb.from("commandes_yango").select("raw").order("created_at", { ascending: false }).limit(500),
    sb.from("agent_memory").select("*").order("importance", { ascending: false }).limit(40),
  ])

  const commandes = (commandesRaw || []).map(r => r.raw as Record<string, string>)
  const cmdComplete = commandes.filter(o => o?.status === "complete")
  const cmdRevTotal = cmdComplete.reduce((s, o) => s + parseFloat(o.price || "0"), 0)
  const cmdRevMonth = cmdComplete.filter(o => o.created_at?.startsWith(monthPrefix)).reduce((s, o) => s + parseFloat(o.price || "0"), 0)
  const cmdRevWeek  = cmdComplete.filter(o => (o.created_at?.slice(0, 10) || "") >= weekAgo).reduce((s, o) => s + parseFloat(o.price || "0"), 0)
  const cmdRevToday = cmdComplete.filter(o => o.created_at?.startsWith(today)).reduce((s, o) => s + parseFloat(o.price || "0"), 0)

  const caTotal     = (caJour || []).reduce((s, r) => s + Number(r.chiffre_affaire || 0), 0)
  const depTotal    = (depenses || []).reduce((s, r) => s + Number(r.total_depenses || 0), 0)
  const caAujTotal  = (recettes || []).filter(r => r.Horodatage?.startsWith(today)).reduce((s, r) => s + Number(r["Montant net"] || 0), 0)

  return {
    date: today,
    heure: new Date().toLocaleTimeString("fr-FR"),

    flotte_principale: {
      vehicules_total:   vehicules?.length || 0,
      vehicules_actifs:  vehicules?.filter(v => v.statut === "ACTIF").length || 0,
      chauffeurs_total:  chauffeurs?.length || 0,
      chauffeurs_actifs: chauffeurs?.filter(c => c.actif).length || 0,
      ca_aujourd_hui_fcfa:  caAujTotal,
      ca_30j_fcfa:          caTotal,
      depenses_totales_fcfa: depTotal,
      profit_net_fcfa:       caTotal - depTotal,
      marge_pct:             caTotal > 0 ? ((caTotal - depTotal) / caTotal * 100).toFixed(1) : "0",
      top5_chauffeurs:       classement?.slice(0, 5).map(c => ({ nom: c.nom, ca_fcfa: c.ca, courses: c.nb_courses })) || [],
      evolution_ca_mensuel:  caMois?.slice(0, 6).map(m => ({ periode: `${m.mois}/${m.annee}`, ca: m.chiffre_affaire })) || [],
      depenses_par_cat:      depenses?.map(d => ({ cat: d.categorie, montant: d.total_depenses })) || [],
    },

    boyah_transport_yango: {
      commandes_total:       commandes.length,
      commandes_completes:   cmdComplete.length,
      taux_completion_pct:   commandes.length > 0 ? (cmdComplete.length / commandes.length * 100).toFixed(1) : "0",
      revenu_total_fcfa:     cmdRevTotal,
      revenu_ce_mois_fcfa:   cmdRevMonth,
      revenu_cette_semaine:  cmdRevWeek,
      revenu_aujourd_hui:    cmdRevToday,
      commission_25pct_total: cmdRevTotal * 0.025,
      commission_ce_mois:     cmdRevMonth * 0.025,
      panier_moyen_fcfa:     cmdComplete.length > 0 ? (cmdRevTotal / cmdComplete.length).toFixed(0) : "0",
    },

    memoire_agent: (memory || [])
      .map(m => `• [${m.categorie.toUpperCase()}] ${m.cle}: ${m.valeur}`)
      .join("\n") || "Pas encore de mémoire accumulée",
  }
}

// ── Extraction et sauvegarde des mémoires ────────────────────────────────────
async function extractAndSaveMemory(text: string) {
  const memRegex = /\[MEM\]([\s\S]*?)\[\/MEM\]/g
  const matches: RegExpExecArray[] = []
  let m: RegExpExecArray | null
  while ((m = memRegex.exec(text)) !== null) matches.push(m)
  for (const match of matches) {
    const parts = match[1].split("|")
    if (parts.length >= 3) {
      await sb.from("agent_memory").upsert({
        categorie:  parts[0]?.trim() || "general",
        cle:        parts[1]?.trim() || `mem_${Date.now()}`,
        valeur:     parts[2]?.trim(),
        importance: parseInt(parts[3]?.trim() || "5"),
      }, { onConflict: "cle" })
    }
  }
  // Retourne le texte sans les balises mémoire
  return text.replace(/\[MEM\][\s\S]*?\[\/MEM\]/g, "").trim()
}

// ── Handler Telegram commands ─────────────────────────────────────────────────
function getMessageType(text: string): string {
  if (!text) return "conversation"
  const t = text.toLowerCase()

  // Commandes slash
  if (t.startsWith("/rapport"))  return "daily_report"
  if (t.startsWith("/alerte"))   return "alerts"
  if (t.startsWith("/marche"))   return "market_research"
  if (t.startsWith("/memoire"))  return "show_memory"

  const marcheWords  = ["marche", "march", "concurrent", "concurrence", "veille", "indriver", "bolt", "secteur vtc", "vtc abidjan"]
  const actionWords  = ["rapport", "bilan", "analyse", "etude", "etat", "point", "resume", "synthese", "overview", "fais", "donne", "montre", "fait"]
  const joursWords   = ["aujourd", "matin", "journee", "du jour", "hier", "semaine", "ce soir", "performance"]
  const alerteWords  = ["alerte", "anomalie", "probleme", "urgence"]

  // Marché : un mot marché + un mot action OU juste "marché vtc"
  if (marcheWords.some(w => t.includes(w))) return "market_research"

  // Rapport journalier : action + jour
  if (actionWords.some(w => t.includes(w)) && joursWords.some(w => t.includes(w))) return "daily_report"
  if (t.includes("bilan") || t.includes("rapport complet") || t.includes("rapport global")) return "daily_report"

  // Alertes
  if (alerteWords.some(w => t.includes(w))) return "alerts"

  return "conversation"
}

// ── Route principale ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      message = "",
      chat_id,
      telegram_user_id,
      type: forcedType,
    } = body

    const type = forcedType || getMessageType(message)

    // Commande /memoire : affichage direct
    if (type === "show_memory") {
      const { data: mem } = await sb.from("agent_memory").select("*").order("importance", { ascending: false }).limit(30)
      const text = mem && mem.length > 0
        ? `🧠 *Mémoire de BOYA* (${mem.length} entrées)\n\n` + mem.map(m => `• [${m.categorie}] *${m.cle}*\n  ${m.valeur} _(priorité ${m.importance})_`).join("\n\n")
        : "🧠 Ma mémoire est encore vide. Commence à me parler de ton entreprise !"
      return NextResponse.json({ ok: true, response: text, type })
    }

    // Fetch context + conversation history (historique seulement en mode conversation)
    const isConversation = type === "conversation"
    const [context, { data: recentConvs }] = await Promise.all([
      fetchContext(),
      isConversation
        ? sb.from("agent_conversations")
            .select("role, content")
            .eq("telegram_chat_id", chat_id || "system")
            .order("created_at", { ascending: false })
            .limit(12)
        : Promise.resolve({ data: [] }),
    ])

    // Mots de salutation à exclure de l'historique (réponses corrompues)
    const GREETING_PATTERNS = ["bonjour boss", "bonjour !", "salut boss", "bienvenue sur boya",
      "comment je peux t'aider", "comment puis-je vous aider", "prêt à bosser", "qu'est-ce qu'on attaque",
      "que voulez-vous qu'on attaque", "je suis à votre écoute", "je suis là, prêt"]

    // Nettoyer l'historique : pas de contenu vide, pas de salutations, alternance obligatoire
    const rawHistory: ConvMessage[] = (recentConvs || [])
      .reverse()
      .filter(c => {
        if (!c.content?.trim()) return false
        const lower = c.content.toLowerCase()
        // Exclure les réponses assistant qui sont des salutations
        if (c.role === "assistant" && GREETING_PATTERNS.some(p => lower.includes(p))) return false
        return true
      })
      .map(c => ({ role: c.role as "user" | "assistant", content: c.content }))

    // Garantir l'alternance user/assistant (Claude l'exige)
    const history: ConvMessage[] = []
    for (const msg of rawHistory) {
      if (history.length === 0 || history[history.length - 1].role !== msg.role) {
        history.push(msg)
      }
    }

    // ── Détecter si la question nécessite les données business ───────────────
    const BUSINESS_KEYWORDS = ["revenu", "ca ", "chiffre", "fcfa", "profit", "dépense", "depense",
      "chauffeur", "véhicule", "vehicule", "voiture", "flotte", "commande", "course",
      "yango", "retard", "paiement", "wave", "performance", "kpi", "bilan", "analyse",
      "boyah", "rapport", "combien", "aujourd'hui", "hier", "semaine", "mois", "résultat"]

    const needsData = type !== "conversation" ||
      BUSINESS_KEYWORDS.some(k => message.toLowerCase().includes(k))

    // ── Tavily search si pertinent ────────────────────────────────────────────
    let webContext = ""
    const needsSearch =
      type === "market_research" ||
      type === "daily_report" ||
      (type === "conversation" && MARKET_KEYWORDS.some(k => message.toLowerCase().includes(k)))

    if (needsSearch && process.env.TAVILY_API_KEY) {
      const query = type === "market_research"
        ? "marché VTC Côte d'Ivoire Abidjan Yango InDriver transport 2024 2025"
        : type === "daily_report"
        ? "actualité transport VTC Abidjan Côte d'Ivoire"
        : message
      webContext = await tavilySearch(query)
    }

    // Construction du prompt selon le type
    let userContent = ""

    if (type === "daily_report") {
      userContent = `[EXÉCUTE DIRECTEMENT — pas de salutation, pas d'introduction]

📊 Génère le rapport matinal complet de Boyah Group pour le ${context.date}.

Inclus :
1. Résumé exécutif de la situation (hier + tendances)
2. KPIs clés avec comparatifs
3. Points d'attention prioritaires du jour
4. 1 action concrète à faire aujourd'hui
5. Météo business (🟢 bien / 🟡 attention / 🔴 critique)

DONNÉES TEMPS RÉEL :
${JSON.stringify(context, null, 2)}
${webContext ? `\n🌐 ACTUALITÉS DU MARCHÉ :\n${webContext}` : ""}`

    } else if (type === "alerts") {
      userContent = `[EXÉCUTE DIRECTEMENT — pas de salutation]

🔍 Analyse les données et identifie UNIQUEMENT les anomalies critiques.

Critères d'alerte : CA aujourd'hui < moyenne, taux annulation > 30%, vehicules en retard paiement, profit négatif.

Si aucune anomalie → réponds exactement "RAS" (rien à signaler).
Sinon → liste les alertes avec urgence et action immédiate.

DONNÉES :
${JSON.stringify(context, null, 2)}`

    } else if (type === "market_research") {
      userContent = `[EXÉCUTE DIRECTEMENT — commence immédiatement l'analyse, pas de salutation]

🌍 Réalise la veille marché de Boyah Group.

Analyse :
1. Tendances marché VTC Côte d'Ivoire (Abidjan) — croise tes connaissances avec les actualités ci-dessous
2. Mouvements concurrents (Yango, InDriver, Bolt)
3. Opportunités de croissance identifiées
4. Menaces et risques à surveiller
5. Recommandations stratégiques basées sur nos données actuelles

DONNÉES ENTREPRISE :
${JSON.stringify(context, null, 2)}
${webContext ? `\n🌐 RÉSULTATS DE RECHERCHE WEB EN TEMPS RÉEL :\n${webContext}` : ""}`

    } else {
      // Conversation normale — données uniquement si pertinent
      userContent = needsData
        ? `${message}\n\n📊 DONNÉES BOYAH GROUP :\n${JSON.stringify(context, null, 2)}${webContext ? `\n\n🌐 RECHERCHE WEB :\n${webContext}` : ""}`
        : `${message}${webContext ? `\n\n🌐 RECHERCHE WEB :\n${webContext}` : ""}`
    }

    // Sécurité : userContent ne doit jamais être vide
    const safeContent = userContent?.trim() || message?.trim() || "Bonjour"

    // Dernière vérification : si history finit par un user, on ne peut pas ajouter un autre user
    const cleanHistory = history.length > 0 && history[history.length - 1].role === "user"
      ? history.slice(0, -1)
      : history

    // Call Claude Opus
    const claudeResponse = await anthropic.messages.create({
      model:      "claude-opus-4-6",
      max_tokens: 2048,
      system:     SYSTEM_PROMPT,
      messages:   [...cleanHistory, { role: "user", content: safeContent }],
    })

    const rawResponse = claudeResponse.content.find(b => b.type === "text")?.text || "Je n'ai pas pu générer une réponse."

    // Extraire mémoires + nettoyer le texte
    const cleanResponse = await extractAndSaveMemory(rawResponse)

    // Sauvegardes asynchrones (fire-and-forget)
    const chatId = chat_id || "system"
    Promise.all([
      // Sauvegarder la conversation
      type === "conversation"
        ? sb.from("agent_conversations").insert([
            { telegram_chat_id: chatId, telegram_user_id, role: "user",      content: message },
            { telegram_chat_id: chatId, telegram_user_id, role: "assistant", content: cleanResponse },
          ])
        : Promise.resolve(),

      // Archiver les analyses automatiques
      type !== "conversation"
        ? sb.from("agent_analyses").insert({
            type,
            titre:   `${type === "daily_report" ? "Rapport" : type === "alerts" ? "Alertes" : "Veille marché"} – ${context.date}`,
            contenu: cleanResponse,
            donnees: context,
          })
        : Promise.resolve(),
    ]).catch(err => console.error("[agent] save error:", err))

    return NextResponse.json({ ok: true, response: cleanResponse, type })

  } catch (err) {
    console.error("[agent/process]", err)
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    )
  }
}
