import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"

export const maxDuration = 60 // Vercel max pour plan Pro (évite les timeouts Claude Opus)

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Tavily Web Search ─────────────────────────────────────────────────────────
async function tavilySearch(query: string): Promise<string> {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key:        process.env.TAVILY_API_KEY,
        query,
        search_depth:   "advanced",
        max_results:    5,
        include_answer: true,
      }),
    })
    const data = await res.json()
    if (!data.results?.length) return ""
    const summary = data.answer ? `Résumé : ${data.answer}\n\n` : ""
    const sources = data.results
      .map((r: { title: string; content: string; url: string }) =>
        `• ${r.title}\n  ${r.content?.slice(0, 250)}...\n  Source: ${r.url}`
      )
      .join("\n\n")
    return `${summary}${sources}`
  } catch {
    return ""
  }
}

// ── Système de prompt ─────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `⚡ RÈGLE ABSOLUE : Tu reçois une demande → tu l'EXÉCUTES immédiatement.
JAMAIS de "Bonjour", "Boss", présentation de tes capacités, ou menu d'options.
Si la demande est un rapport → génère le rapport. Si analyse → fais l'analyse. DIRECTEMENT.

---

Tu es BOYA, l'IA stratégique du groupe Boyah. Tu connais les deux entités sur le bout des doigts.

═══════════════════════════════════════
📖 LEXIQUE MÉTIER BOYAH — définitions exactes
═══════════════════════════════════════

BOYAH GROUP (flotte principale) :
- "chauffeur" / "driver" = chauffeur salarié ou partenaire de la flotte Boyah Group
- "véhicule" / "voiture" / "flotte" = véhicules appartenant à Boyah Group
- "recette" / "Wave" / "CA Wave" = revenu encaissé via l'appli Wave (paiement client final)
- "course" = trajet effectué par un chauffeur Boyah Group
- "dépense" / "charge" = frais opérationnels Boyah Group (carburant, entretien, assurance, etc.)
- "profit" / "marge" = CA Wave − dépenses totales
- "sous gestion" / "client" = véhicule appartenant à un propriétaire privé, confié à Boyah Group pour gestion
  → IMPORTANT : C'EST BOYAH QUI VERSE DE L'ARGENT AU CLIENT (pas l'inverse !). Le client est le
    propriétaire du véhicule, il ne paie RIEN. Boyah exploite son véhicule et lui reverse une part.
  → "versement client" = sortie d'argent de Boyah VERS le client (jamais l'inverse).
    Ne jamais dire "le client a versé", "le client doit payer", "recette client".
  → Le client reçoit chaque mois un montant = montant_mensuel_client − max(0, dépenses véh − 50 000)
  → Logique charges : si dépenses du véhicule < 50 000 FCFA → Boyah absorbe (charge Boyah = dépenses).
    Si dépenses > 50 000 FCFA → le surplus est déduit du versement au client (il prend sa part des gros frais).
  → Net client = montant mensuel − max(0, dépenses − 50 000)   ← c'est ce que Boyah LUI DOIT ce mois-ci
  → Bénéfice Boyah sur ce véhicule = revenu − net client − charge Boyah
  → Fenêtre de paiement : Boyah verse entre le 5 et le 10 du mois SUIVANT l'exploitation
    (ex : exploitation mars → versement au client entre 5 et 10 avril).
    Statuts : deja_verse / a_verser (5-10) / en_retard (après 10) / pas_encore_du (avant 5) / en_cours / futur

BOYAH TRANSPORT (partenariat Yango) :
- "prestataire" = chauffeur tiers inscrit sur la plateforme Yango VIA Boyah Transport (≠ chauffeur Boyah Group)
- "commande" = course Yango d'un prestataire (données API Yango uniquement)
- "commission" = 2,5% du montant de chaque commande complétée → c'est le revenu de Boyah Transport
- "CA prestataires" = total des courses des prestataires (ce n'est PAS le revenu de Boyah Transport — juste le volume)
- "taux de complétion" = courses complétées / total commandes × 100
- "panier moyen" = CA prestataires / nombre de courses complétées

RÈGLES DE LECTURE DES DONNÉES :
- "Montant net" (avec espace, majuscule M) = colonne du revenu dans recettes_wave
- "Horodatage" (majuscule H) = colonne date dans recettes_wave
- "immatriculation" = plaque d'immatriculation du véhicule (ex: CI-1234-AB)
- Les données Boyah Transport proviennent exclusivement de l'API Yango → jamais de Wave
- NE JAMAIS mélanger chauffeurs Boyah Group et prestataires Boyah Transport

═══════════════════════════════════════
🏢 BOYAH GROUP — contexte entreprise
═══════════════════════════════════════
Localisation : Abidjan, Côte d'Ivoire
Marché : VTC premium en concurrence avec Yango, InDriver, Bolt
Saisonnalité : pics en décembre (fêtes), baisse en janvier
Commission plateforme Yango sur les prestataires : prélevée à la source sur chaque course

═══════════════════════════════════════
💾 MÉMOIRE — quand tu identifies un fait clé, ajoute :
[MEM]categorie|cle_unique|valeur|importance_1_10[/MEM]
Catégories : boyah_group | boyah_transport | marche | decision | chauffeur | vehicule | client | preference | kpi
═══════════════════════════════════════

🗣️ STYLE : Français, emojis pour structurer, direct, orienté action.
N'utilise PAS de Markdown (**gras**, ##titres) — uniquement emojis et tirets.
Max 700 mots sauf rapport complet demandé explicitement.`

type ConvMessage = { role: "user" | "assistant"; content: string }

// ── Classification des intents ────────────────────────────────────────────────
type IntentType =
  | "daily_report"
  | "alerts"
  | "market_research"
  | "financial_query"
  | "driver_query"
  | "vehicle_query"
  | "client_query"
  | "operational"
  | "show_memory"
  | "conversation"

function classifyIntent(text: string): IntentType {
  if (!text) return "conversation"
  const t = text.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // enlève accents pour matching

  // Commandes slash explicites
  if (t.startsWith("/rapport"))  return "daily_report"
  if (t.startsWith("/alerte"))   return "alerts"
  if (t.startsWith("/marche"))   return "market_research"
  if (t.startsWith("/memoire"))  return "show_memory"
  if (t.startsWith("/client"))   return "client_query"
  if (t.startsWith("/chauffeur")) return "driver_query"
  if (t.startsWith("/vehicule")) return "vehicle_query"

  // Détection financière (priorité haute — souvent présente dans d'autres questions)
  const financialTerms = ["ca ", "chiffre d'affaire", "revenu", "recette", "wave", "profit",
    "marge", "depense", "charge", "fcfa", "bilan financier", "resultat financier",
    "combien on a gagne", "combien a ete encaisse", "montant", "argent", "finance",
    "benefice", "perte", "taux de marge"]
  if (financialTerms.some(w => t.includes(w))) return "financial_query"

  // Chauffeur spécifique
  const driverTerms = ["chauffeur", "driver", "conducteur", "top chauffeur", "classement chauffeur",
    "performance chauffeur", "meilleur chauffeur", "chauffeurs actifs", "chauffeurs inactifs",
    "qui a fait le plus", "quel chauffeur"]
  if (driverTerms.some(w => t.includes(w))) return "driver_query"

  // Véhicule spécifique
  const vehicleTerms = ["vehicule", "voiture", "flotte", "immatriculation", "carte grise",
    "entretien vehicule", "etat vehicule", "parc auto", "parc vehicule",
    "sous gestion", "gestion vehicule"]
  if (vehicleTerms.some(w => t.includes(w))) return "vehicle_query"

  // Clients (sous gestion) — c'est Boyah qui verse AUX clients
  const clientTerms = ["client", "proprietaire", "sous gestion", "net client", "montant mensuel",
    "boyah support", "surplus", "charge boyah", "versement client", "verser aux client",
    "verser client", "je dois au client", "je dois aux client", "paiement client", "payer client",
    "clients en retard", "client en retard", "rattraper client", "a verser client"]
  if (clientTerms.some(w => t.includes(w))) return "client_query"

  // Opérationnel (commandes, courses, Boyah Transport)
  const operationalTerms = ["commande", "course", "prestataire", "yango", "boyah transport",
    "taux de completion", "annulation", "panier moyen", "commission yango",
    "sync", "livraison"]
  if (operationalTerms.some(w => t.includes(w))) return "operational"

  // Marché / veille
  const marketTerms = ["marche", "concurrent", "concurrence", "indriver", "bolt",
    "actualite", "tendance", "prix marche", "reglementation", "afrique",
    "abidjan vtc", "secteur vtc", "veille", "competiteur"]
  if (marketTerms.some(w => t.includes(w))) return "market_research"

  // Rapport / alertes
  const reportTerms = ["rapport", "bilan", "synthese", "resume global", "rapport complet",
    "rapport du jour", "rapport matinal", "etat des lieux"]
  if (reportTerms.some(w => t.includes(w))) return "daily_report"
  const alertTerms = ["alerte", "anomalie", "probleme urgent", "urgence", "critique", "attention"]
  if (alertTerms.some(w => t.includes(w))) return "alerts"

  return "conversation"
}

// ── Contexte ciblé selon l'intent ────────────────────────────────────────────
async function fetchContext(intent: IntentType) {
  const today       = new Date().toISOString().slice(0, 10)
  const monthPrefix = new Date().toISOString().slice(0, 7)
  const weekAgo     = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const prevMonth   = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7)

  // Mémoire toujours chargée
  const { data: memory } = await sb
    .from("agent_memory").select("*")
    .order("importance", { ascending: false }).limit(40)

  const memStr = (memory || [])
    .map(m => `• [${m.categorie.toUpperCase()}] ${m.cle}: ${m.valeur}`)
    .join("\n") || "Pas encore de mémoire"

  // ── Données financières Boyah Group
  const fetchFinancial = async () => {
    const [caJour, caMois, recettes, depenses, caJourPrevMois] = await Promise.all([
      sb.from("vue_ca_journalier").select("*").order("date", { ascending: false }).limit(60),
      sb.from("vue_ca_mensuel").select("*").order("annee", { ascending: false }).order("mois", { ascending: false }).limit(13),
      sb.from("recettes_wave").select("*").order("Horodatage", { ascending: false }).limit(200),
      sb.from("vue_depenses_categories").select("*"),
      sb.from("vue_ca_journalier").select("*").gte("date", prevMonth + "-01").lt("date", monthPrefix + "-01"),
    ])
    const recettesData = recettes.data || []
    const caJourData   = caJour.data || []
    const caMoisData   = caMois.data || []
    const depData      = depenses.data || []

    const caAujTotal   = recettesData.filter(r => r.Horodatage?.startsWith(today)).reduce((s, r) => s + Number(r["Montant net"] || 0), 0)
    const ca30j        = caJourData.reduce((s, r) => s + Number(r.chiffre_affaire || 0), 0)
    const caMoisActuel = Number(caMoisData[0]?.chiffre_affaire || 0)
    const caMoisPrec   = Number(caMoisData[1]?.chiffre_affaire || 0)
    const depTotal     = depData.reduce((s, r) => s + Number(r.total_depenses || 0), 0)
    const prevMoisCA   = (caJourPrevMois.data || []).reduce((s, r) => s + Number(r.chiffre_affaire || 0), 0)

    return {
      ca_aujourd_hui_fcfa:  caAujTotal,
      ca_30_derniers_jours: ca30j,
      ca_mois_actuel:       caMoisActuel,
      ca_mois_precedent:    caMoisPrec,
      evolution_mois_pct:   caMoisPrec > 0 ? (((caMoisActuel - caMoisPrec) / caMoisPrec) * 100).toFixed(1) + "%" : "N/A",
      depenses_totales:     depTotal,
      profit_net:           ca30j - depTotal,
      marge_pct:            ca30j > 0 ? ((ca30j - depTotal) / ca30j * 100).toFixed(1) + "%" : "0%",
      depenses_par_categorie: depData.map(d => ({ categorie: d.categorie, montant: d.total_depenses })),
      evolution_ca_mensuel: caMoisData.slice(0, 6).map(m => ({
        periode: `${m.mois}/${m.annee}`,
        ca_fcfa: m.chiffre_affaire,
      })),
      ca_mois_precedent_par_jour: prevMoisCA,
    }
  }

  // ── Données chauffeurs
  const fetchDrivers = async () => {
    const [chauffeurs, classement] = await Promise.all([
      sb.from("vue_chauffeurs_vehicules").select("*"),
      sb.from("classement_chauffeurs").select("*").order("ca", { ascending: false }),
    ])
    return {
      total:   chauffeurs.data?.length || 0,
      actifs:  chauffeurs.data?.filter(c => c.actif).length || 0,
      inactifs: chauffeurs.data?.filter(c => !c.actif).length || 0,
      liste_complete: chauffeurs.data?.map(c => ({
        nom: c.nom, actif: c.actif, vehicule: c.immatriculation || "non assigné",
      })) || [],
      classement_top10: classement.data?.slice(0, 10).map(c => ({
        rang: (classement.data?.indexOf(c) ?? 0) + 1,
        nom:  c.nom,
        ca_fcfa: c.ca,
        nb_courses: c.nb_courses,
      })) || [],
    }
  }

  // ── Pagination helper — contourne la limite Supabase de 1000 lignes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fetchAllPaginated = async <T>(buildQuery: () => any): Promise<T[]> => {
    const PAGE = 1000
    const all: T[] = []
    let offset = 0
    while (true) {
      const { data } = await buildQuery().range(offset, offset + PAGE - 1)
      if (!data || data.length === 0) break
      all.push(...(data as T[]))
      if (data.length < PAGE) break
      offset += PAGE
      if (all.length >= 50000) break // sécurité
    }
    return all
  }

  // ── Données véhicules avec recettes réelles par véhicule
  const fetchVehicles = async () => {
    const week7ago   = new Date(Date.now() -  7 * 86400000).toISOString().slice(0, 10)
    const month30ago = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

    const [{ data }, recVeh] = await Promise.all([
      sb.from("vue_dashboard_vehicules").select("*"),
      // Pagination pour récupérer TOUTES les recettes liées à un véhicule
      fetchAllPaginated<{ id_vehicule: number; "Montant net": number; "Horodatage": string }>(
        () => sb.from("vue_recettes_vehicules")
          .select("id_vehicule, \"Montant net\", \"Horodatage\"")
          .not("id_vehicule", "is", null)
      ),
    ])

    // Agréger recettes par id_vehicule
    const rev: Record<number, { total: number; j7: number; j30: number }> = {}
    for (const r of recVeh) {
      const id = r.id_vehicule; if (!id) continue
      const d  = (r["Horodatage"] || "").slice(0, 10)
      const m  = Number(r["Montant net"] || 0)
      if (!rev[id]) rev[id] = { total: 0, j7: 0, j30: 0 }
      rev[id].total += m
      if (d >= week7ago)   rev[id].j7   += m
      if (d >= month30ago) rev[id].j30  += m
    }

    return {
      total:          data?.length || 0,
      actifs:         data?.filter(v => v.statut === "ACTIF").length || 0,
      en_maintenance: data?.filter(v => v.statut === "MAINTENANCE" || v.statut === "EN MAINTENANCE").length || 0,
      inactifs:       data?.filter(v => v.statut === "INACTIF").length || 0,
      flotte_detaillee: (data || []).map(v => ({
        immat:              v.immatriculation,
        statut:             v.statut,
        chauffeur:          v.nom_chauffeur || "non assigné",
        ca_mensuel_vue:     v.ca_mensuel    || 0,
        ca_aujourdhui:      v.ca_aujourdhui || 0,
        cout_total:         v.cout_total    || 0,
        profit_mensuel:     v.profit        || 0,
        recettes_total:     rev[v.id_vehicule]?.total || 0,
        recettes_7j:        rev[v.id_vehicule]?.j7    || 0,
        recettes_30j:       rev[v.id_vehicule]?.j30   || 0,
      })),
    }
  }

  // ── Versements chauffeurs — ce que chaque chauffeur a réellement versé
  const fetchDriverPayments = async () => {
    const week7ago   = new Date(Date.now() -  7 * 86400000).toISOString().slice(0, 10)
    const month30ago = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

    const [recettes, { data: chauffeurs }] = await Promise.all([
      // Pagination pour récupérer TOUTES les recettes (>1000)
      fetchAllPaginated<{
        "Numéro de téléphone de contrepartie": string
        "Nom de contrepartie": string
        "Montant net": number
        "Horodatage": string
      }>(
        () => sb.from("recettes_wave")
          .select("\"Numéro de téléphone de contrepartie\", \"Nom de contrepartie\", \"Montant net\", \"Horodatage\"")
          .not("Montant net", "is", null)
      ),
      sb.from("chauffeurs").select("id_chauffeur, nom, numero_wave, actif"),
    ])

    // Index chauffeurs par numéro normalisé (last 8 chiffres)
    const byPhone: Record<string, string> = {}
    for (const c of chauffeurs || []) {
      if (c.numero_wave) {
        const n = c.numero_wave.replace(/[^0-9]/g, "")
        byPhone[n]         = c.nom
        byPhone[n.slice(-8)] = c.nom
      }
    }

    // Agréger par chauffeur
    const agg: Record<string, { nom: string; total: number; j7: number; j30: number; dernier: string }> = {}
    for (const r of recettes) {
      const raw = (r["Numéro de téléphone de contrepartie"] || "").replace(/[^0-9]/g, "")
      const nom = byPhone[raw] || byPhone[raw.slice(-8)] || r["Nom de contrepartie"] || raw || "Inconnu"
      const m   = Number(r["Montant net"] || 0)
      const d   = (r["Horodatage"] || "").slice(0, 10)
      if (!agg[nom]) agg[nom] = { nom, total: 0, j7: 0, j30: 0, dernier: "" }
      agg[nom].total += m
      if (d >= week7ago)   agg[nom].j7   += m
      if (d >= month30ago) agg[nom].j30  += m
      if (d > agg[nom].dernier) agg[nom].dernier = d
    }

    // Chauffeurs actifs sans versement récent (> 7j)
    const arrieresNoms = (chauffeurs || [])
      .filter(c => c.actif)
      .filter(c => !agg[c.nom] || agg[c.nom].dernier < week7ago)
      .map(c => c.nom)

    return {
      versements_chauffeurs_detail: Object.values(agg)
        .sort((a, b) => b.total - a.total)
        .map(v => ({ ...v, dernier_versement: v.dernier || "jamais" })),
      chauffeurs_sans_versement_7j: arrieresNoms,
      nb_arrierees: arrieresNoms.length,
    }
  }

  // ── Entretiens (maintenance tous les 21 jours)
  // ── Complétude des versements — qui a versé quoi quel jour (lun-sam)
  const fetchVersementsCompletude = async () => {
    const today    = new Date().toISOString().slice(0, 10)
    const week7ago = new Date(Date.now() -  7 * 86400000).toISOString().slice(0, 10)
    const month30ago = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

    const [{ data: vehiculesActifs }, attribs, { data: justifs }, { data: feries }] = await Promise.all([
      sb.from("vehicules").select("id_vehicule, immatriculation, montant_recette_jour").eq("statut", "ACTIF"),
      fetchAllPaginated<{ id_vehicule: number; jour_exploitation: string; montant_attribue: number; type_attribution: string }>(
        () => sb.from("versement_attribution")
          .select("id_vehicule, jour_exploitation, montant_attribue, type_attribution")
          .gte("jour_exploitation", month30ago)
      ),
      sb.from("justifications_versement").select("*").gte("jour_exploitation", month30ago),
      sb.from("jours_feries").select("date, montant"),
    ])

    const TOLERANCE = 0.99
    const feriesMap = new Map<string, number>()
    for (const f of feries || []) feriesMap.set(f.date, Number(f.montant || 15000))

    const justifMap = new Map<string, { type: string; motif: string | null }>()
    for (const j of justifs || []) justifMap.set(`${j.id_vehicule}|${j.jour_exploitation}`, { type: j.type, motif: j.motif })

    const attribMap = new Map<string, number>()
    for (const a of attribs) {
      const k = `${a.id_vehicule}|${a.jour_exploitation}`
      attribMap.set(k, (attribMap.get(k) || 0) + Number(a.montant_attribue || 0))
    }

    // Construire les jours ouvrés 30 derniers (sauf dimanche, sauf futur)
    const allJours: string[] = []
    for (let d = new Date(month30ago); d <= new Date(today); d.setUTCDate(d.getUTCDate() + 1)) {
      if (d.getUTCDay() === 0) continue
      allJours.push(d.toISOString().slice(0, 10))
    }

    // Date du 1er versement par véhicule (= date d'entrée dans la flotte active)
    const premierVersement = new Map<number, string>()
    for (const v of vehiculesActifs || []) {
      const { data } = await sb
        .from("versement_attribution")
        .select("jour_exploitation")
        .eq("id_vehicule", v.id_vehicule)
        .order("jour_exploitation", { ascending: true })
        .limit(1)
      if (data && data.length > 0) premierVersement.set(v.id_vehicule, data[0].jour_exploitation)
    }

    const manquants_non_justifies: { immat: string; jour: string; attendu: number }[] = []
    const insuffisants_non_justifies: { immat: string; jour: string; recu: number; attendu: number }[] = []
    let   total_paye_complet = 0
    let   total_ouvres       = 0

    for (const v of vehiculesActifs || []) {
      const expected = v.montant_recette_jour || 0
      const premier  = premierVersement.get(v.id_vehicule)
      for (const j of allJours) {
        // Ignorer les jours avant l'entrée du véhicule dans la flotte
        if (premier && j < premier) continue

        total_ouvres++
        const recu       = attribMap.get(`${v.id_vehicule}|${j}`) || 0
        const ferie      = feriesMap.get(j)
        const attendu    = ferie ?? expected
        const justif     = justifMap.get(`${v.id_vehicule}|${j}`)
        const tolerance  = attendu * TOLERANCE

        if (recu >= tolerance) {
          total_paye_complet++
        } else if (justif) {
          total_paye_complet++
        } else if (recu > 0) {
          insuffisants_non_justifies.push({ immat: v.immatriculation, jour: j, recu, attendu })
        } else {
          manquants_non_justifies.push({ immat: v.immatriculation, jour: j, attendu })
        }
      }
    }

    const taux_7j = (() => {
      const last7 = allJours.filter(j => j >= week7ago)
      let ok = 0, tot = 0
      for (const v of vehiculesActifs || []) {
        const expected = v.montant_recette_jour || 0
        for (const j of last7) {
          tot++
          const recu  = attribMap.get(`${v.id_vehicule}|${j}`) || 0
          const attendu = feriesMap.get(j) ?? expected
          const justif = justifMap.get(`${v.id_vehicule}|${j}`)
          if (recu >= attendu * TOLERANCE || justif) ok++
        }
      }
      return tot > 0 ? Math.round(ok / tot * 100) : 0
    })()

    return {
      taux_completion_7j_pct:   `${taux_7j}%`,
      taux_completion_30j_pct:  total_ouvres > 0 ? `${Math.round(total_paye_complet / total_ouvres * 100)}%` : "0%",
      nb_manquants_30j:         manquants_non_justifies.length,
      nb_insuffisants_30j:      insuffisants_non_justifies.length,
      manquants_a_traiter:      manquants_non_justifies.slice(0, 20),   // top 20 pour éviter bourrage contexte
      insuffisants_a_justifier: insuffisants_non_justifies.slice(0, 20),
    }
  }

  const fetchEntretiens = async () => {
    const today   = new Date().toISOString().slice(0, 10)
    const in7days = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

    const { data } = await sb
      .from("entretiens")
      .select("id, id_vehicule, immatriculation, type_entretien, date_realise, date_prochain, cout, notes")
      .order("date_prochain", { ascending: true })

    const tous         = data || []
    const enRetard     = tous.filter(e => e.date_prochain < today)
    const prochainement = tous.filter(e => e.date_prochain >= today && e.date_prochain <= in7days)
    const planifies    = tous.filter(e => e.date_prochain > in7days)

    return {
      frequence_jours:    21,
      en_retard:          enRetard.map(e => ({ vehicule: e.immatriculation, type: e.type_entretien, prevu_le: e.date_prochain, jours_retard: Math.floor((new Date(today).getTime() - new Date(e.date_prochain).getTime()) / 86400000) })),
      dans_7_jours:       prochainement.map(e => ({ vehicule: e.immatriculation, type: e.type_entretien, prevu_le: e.date_prochain })),
      a_venir:            planifies.slice(0, 10).map(e => ({ vehicule: e.immatriculation, type: e.type_entretien, prevu_le: e.date_prochain })),
      nb_en_retard:       enRetard.length,
      nb_dans_7j:         prochainement.length,
      cout_total_historique: tous.reduce((s, e) => s + Number(e.cout || 0), 0),
    }
  }

  // ── Données clients (sous gestion)
  //   IMPORTANT : c'est Boyah qui VERSE de l'argent AUX clients (propriétaires des véhicules
  //   confiés en gestion), jamais l'inverse. Cette fonction calcule pour chaque mois
  //   des 6 derniers mois : montant dû, montant déjà versé, statut (deja_verse / a_verser /
  //   en_retard / pas_encore_du / en_cours / futur).
  const fetchClients = async () => {
    const today = new Date()
    const BOYAH_EXPENSE_CAP = 50_000

    // Clients + véhicules sous gestion
    const [{ data: clientsRaw }, { data: vehsGestion }, { data: versementsRaw }] = await Promise.all([
      sb.from("clients").select("*"),
      sb.from("vehicules")
        .select("id_vehicule, immatriculation, montant_mensuel_client, id_client")
        .eq("sous_gestion", true),
      sb.from("versements_clients").select("id_client, mois, montant, date_versement"),
    ])

    // Construire la liste des 6 derniers mois (YYYY-MM)
    const moisList: string[] = []
    for (let i = 0; i < 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      moisList.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    }

    // Pour chaque mois : revenus + dépenses par véhicule
    type VehMois = { id_vehicule: number; revenu: number; depenses: number }
    const vehParMois = new Map<string, Map<number, VehMois>>()
    for (const m of moisList) {
      const [y, mm] = m.split("-").map(Number)
      const from = `${m}-01`
      const to   = new Date(y, mm, 1).toISOString().slice(0, 10)
      const [{ data: recs }, { data: deps }] = await Promise.all([
        sb.from("vue_recettes_vehicules")
          .select(`immatriculation, "Montant net", "Horodatage"`)
          .gte("Horodatage", from).lt("Horodatage", to),
        sb.from("depenses_vehicules")
          .select("id_vehicule, montant, date_depense")
          .gte("date_depense", from).lt("date_depense", to),
      ])
      const map = new Map<number, VehMois>()
      for (const v of vehsGestion || []) {
        const revenu = (recs || [])
          .filter(r => String(r.immatriculation).toLowerCase() === v.immatriculation.toLowerCase())
          .reduce((s, r) => s + Number((r as Record<string, unknown>)["Montant net"] || 0), 0)
        const depenses = (deps || [])
          .filter(d => d.id_vehicule === v.id_vehicule)
          .reduce((s, d) => s + Number(d.montant || 0), 0)
        map.set(v.id_vehicule, { id_vehicule: v.id_vehicule, revenu, depenses })
      }
      vehParMois.set(m, map)
    }

    // Index versements par (id_client, mois)
    const versMap = new Map<string, number>()
    for (const v of versementsRaw || []) {
      versMap.set(`${v.id_client}|${v.mois}`, Number(v.montant || 0))
    }

    // Statut de versement (miroir de app/clients/page.tsx)
    function statut(mois: string, deja: boolean): string {
      if (deja) return "deja_verse"
      const [y, m] = mois.split("-").map(Number)
      const debutMois  = new Date(y, m - 1, 1)
      const finMois    = new Date(y, m, 0, 23, 59, 59)
      const jour5Next  = new Date(y, m, 5)
      const jour10Next = new Date(y, m, 10, 23, 59, 59)
      if (today < debutMois)  return "futur"
      if (today <= finMois)   return "en_cours"
      if (today < jour5Next)  return "pas_encore_du"
      if (today <= jour10Next) return "a_verser"
      return "en_retard"
    }

    // Agréger par client
    const clients = (clientsRaw || []).map(c => {
      const vehsClient = (vehsGestion || []).filter(v => v.id_client === c.id)
      const mensuelTotal = vehsClient.reduce((s, v) => s + Number(v.montant_mensuel_client || 0), 0)

      // Calcul du dû pour chaque mois
      const moisDetails = moisList.map(m => {
        const vehsMois = vehParMois.get(m)!
        let netDu = 0
        for (const v of vehsClient) {
          const vm = vehsMois.get(v.id_vehicule)
          if (!vm) continue
          const surplus = Math.max(0, vm.depenses - BOYAH_EXPENSE_CAP)
          netDu += Math.max(0, Number(v.montant_mensuel_client || 0) - surplus)
        }
        const verse = versMap.get(`${c.id}|${m}`) || 0
        return {
          mois: m,
          net_du_au_client:  Math.round(netDu),
          montant_deja_verse: Math.round(verse),
          statut: statut(m, verse > 0),
        }
      })

      const enRetard = moisDetails.filter(m => m.statut === "en_retard")
      const aVerser  = moisDetails.filter(m => m.statut === "a_verser")

      return {
        nom: c.nom,
        telephone: c.telephone,
        nb_vehicules: vehsClient.length,
        immatriculations: vehsClient.map(v => v.immatriculation),
        montant_mensuel_total: mensuelTotal,
        mois_en_retard: enRetard.length,
        total_a_rattraper: enRetard.reduce((s, m) => s + m.net_du_au_client, 0),
        mois_a_verser_maintenant: aVerser.length,
        total_a_verser_maintenant: aVerser.reduce((s, m) => s + m.net_du_au_client, 0),
        historique_6_mois: moisDetails,
      }
    })

    // Totaux globaux
    const total_retards  = clients.reduce((s, c) => s + c.total_a_rattraper, 0)
    const total_imminent = clients.reduce((s, c) => s + c.total_a_verser_maintenant, 0)

    return {
      note: "C'est Boyah qui verse l'argent AUX clients (propriétaires confiant leur véhicule). " +
            "Fenêtre de paiement : 5-10 du mois suivant l'exploitation. " +
            "Jamais de versement DES clients VERS Boyah.",
      nb_clients:               clientsRaw?.length || 0,
      nb_veh_sous_gestion:      vehsGestion?.length || 0,
      total_engagement_mensuel: clients.reduce((s, c) => s + c.montant_mensuel_total, 0),
      total_retards_cumules:    Math.round(total_retards),
      total_a_verser_cette_periode: Math.round(total_imminent),
      clients,
    }
  }

  // ── Données Boyah Transport (Yango)
  const fetchTransport = async () => {
    const PAGE = 1000
    let all: Record<string, string>[] = []
    let from = 0
    while (all.length < 5000) {
      const { data } = await sb.from("commandes_yango").select("raw").order("created_at", { ascending: false }).range(from, from + PAGE - 1)
      if (!data || data.length === 0) break
      all.push(...data.map(r => r.raw as Record<string, string>))
      if (data.length < PAGE) break
      from += PAGE
    }
    const complete  = all.filter(o => o?.status === "complete")
    const revTotal  = complete.reduce((s, o) => s + parseFloat(o.price || "0"), 0)
    const revMois   = complete.filter(o => o.created_at?.startsWith(monthPrefix)).reduce((s, o) => s + parseFloat(o.price || "0"), 0)
    const revSemaine= complete.filter(o => (o.created_at?.slice(0, 10) || "") >= weekAgo).reduce((s, o) => s + parseFloat(o.price || "0"), 0)
    const revAuj    = complete.filter(o => o.created_at?.startsWith(today)).reduce((s, o) => s + parseFloat(o.price || "0"), 0)
    const revPrevMois = complete.filter(o => o.created_at?.startsWith(prevMonth)).reduce((s, o) => s + parseFloat(o.price || "0"), 0)

    return {
      note: "Entité distincte. Revenus = commissions 2.5% sur courses prestataires.",
      total_commandes:             all.length,
      courses_completees:          complete.length,
      taux_completion_pct:         all.length > 0 ? (complete.length / all.length * 100).toFixed(1) + "%" : "0%",
      ca_prestataires_total:       revTotal,
      ca_prestataires_ce_mois:     revMois,
      ca_prestataires_semaine:     revSemaine,
      ca_prestataires_aujourd_hui: revAuj,
      ca_prestataires_mois_prec:   revPrevMois,
      evolution_mois_pct:          revPrevMois > 0 ? (((revMois - revPrevMois) / revPrevMois) * 100).toFixed(1) + "%" : "N/A",
      commission_boyah_ce_mois:    Math.round(revMois * 0.025),
      commission_boyah_total:      Math.round(revTotal * 0.025),
      panier_moyen_course:         complete.length > 0 ? Math.round(revTotal / complete.length) + " FCFA" : "N/A",
    }
  }

  // ── Assemblage selon l'intent ─────────────────────────────────────────────
  const base = { date: today, heure: new Date().toLocaleTimeString("fr-FR"), mois_actuel: monthPrefix, memoire_agent: memStr }

  switch (intent) {
    case "financial_query": {
      const [fin, paiements] = await Promise.all([fetchFinancial(), fetchDriverPayments()])
      return { ...base, finances_boyah_group: fin, versements_chauffeurs: paiements }
    }
    case "driver_query": {
      const [drv, fin, paiements, completude] = await Promise.all([fetchDrivers(), fetchFinancial(), fetchDriverPayments(), fetchVersementsCompletude()])
      return {
        ...base,
        chauffeurs: drv,
        versements_chauffeurs_detail: paiements,
        completude_versements: completude,
        ca_reference: { ca_mois: fin.ca_mois_actuel, ca_aujourd_hui: fin.ca_aujourd_hui_fcfa },
      }
    }
    case "vehicle_query": {
      const [veh, cli, entretiens, completude] = await Promise.all([fetchVehicles(), fetchClients(), fetchEntretiens(), fetchVersementsCompletude()])
      return { ...base, vehicules: veh, sous_gestion: cli, entretiens, completude_versements: completude }
    }
    case "client_query": {
      const [cli, fin] = await Promise.all([fetchClients(), fetchFinancial()])
      return { ...base, clients_sous_gestion: cli, finances: { ca_mois: fin.ca_mois_actuel, depenses: fin.depenses_par_categorie } }
    }
    case "operational": {
      const [trp, entretiens] = await Promise.all([fetchTransport(), fetchEntretiens()])
      return { ...base, boyah_transport: trp, entretiens }
    }
    case "market_research": {
      const [fin, trp] = await Promise.all([fetchFinancial(), fetchTransport()])
      return { ...base, context_marche: { ca_boyah_group_30j: fin.ca_30_derniers_jours, marge: fin.marge_pct, commissions_boyah_transport_mois: trp.commission_boyah_ce_mois } }
    }
    default: {
      // daily_report, alerts, rapport complet
      const [fin, drv, veh, trp, paiements, entretiens, completude, cli] = await Promise.all([
        fetchFinancial(), fetchDrivers(), fetchVehicles(), fetchTransport(),
        fetchDriverPayments(), fetchEntretiens(), fetchVersementsCompletude(), fetchClients(),
      ])
      return {
        ...base,
        boyah_group: {
          finances:   fin,
          chauffeurs: { total: drv.total, actifs: drv.actifs, top5: drv.classement_top10.slice(0, 5) },
          vehicules:  { total: veh.total, actifs: veh.actifs, en_maintenance: veh.en_maintenance, flotte_detaillee: veh.flotte_detaillee },
        },
        versements_chauffeurs:     paiements,
        completude_versements:     completude,
        entretiens_vehicules:      entretiens,
        boyah_transport:           trp,
        clients_sous_gestion: {
          nb:                           cli.nb_clients,
          nb_veh:                       cli.nb_veh_sous_gestion,
          total_engagement_mensuel:     cli.total_engagement_mensuel,
          total_retards_cumules:        cli.total_retards_cumules,      // argent que Boyah DOIT encore aux clients
          total_a_verser_cette_periode: cli.total_a_verser_cette_periode, // fenêtre 5-10
          clients_avec_retard:          cli.clients.filter(c => c.mois_en_retard > 0).map(c => ({
            nom: c.nom, mois_en_retard: c.mois_en_retard, total: c.total_a_rattraper,
          })),
        },
      }
    }
  }
}

// ── Nettoyage Markdown ────────────────────────────────────────────────────────
function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`{3}[\s\S]*?`{3}/g, "")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/^[-*]\s/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

// ── Sauvegarde mémoire ────────────────────────────────────────────────────────
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
  return text.replace(/\[MEM\][\s\S]*?\[\/MEM\]/g, "").trim()
}

// ── Prompt par intent ─────────────────────────────────────────────────────────
function buildUserContent(intent: IntentType, message: string, context: Record<string, unknown>, webContext: string): string {
  const ctxStr = JSON.stringify(context, null, 2)
  const web    = webContext ? `\n\n🌐 DONNÉES WEB EN TEMPS RÉEL :\n${webContext}` : ""

  switch (intent) {
    case "daily_report":
      return `[RAPPORT DIRECT — aucune introduction]\n\n📊 Rapport Boyah Group — ${context.date}\n\nInclus obligatoirement :\n1. Résumé exécutif (état vs hier + tendance)\n2. KPIs clés avec variation mois/mois\n3. Points d'attention du jour (max 3)\n4. 1 action concrète prioritaire\n5. Météo business (🟢 bien / 🟡 attention / 🔴 critique)\n\nDONNÉES :\n${ctxStr}${web}`

    case "alerts":
      return `[ALERTES DIRECTES — pas d'introduction]\n\n🔍 Anomalies critiques uniquement. Seuils :\n- CA aujourd'hui < 70% de la moyenne des 7 derniers jours → alerte\n- Taux annulation Boyah Transport > 30% → alerte\n- Marge < 20% → alerte\n- Profit négatif → critique\n- Versements AUX clients en retard (Boyah doit au propriétaire, pas l'inverse) → 🔴 critique\n- Fenêtre 5-10 du mois : versements clients à faire cette semaine → 🟡 rappel\n\nSi aucune anomalie → réponds exactement "✅ RAS — aucune anomalie détectée."\nSinon → liste les alertes avec niveau (🟡 / 🔴) et action immédiate.\n\nDONNÉES :\n${ctxStr}`

    case "market_research":
      return `[ANALYSE DIRECTE — commence immédiatement]\n\n🌍 Veille marché VTC Abidjan pour Boyah Group.\n\nAnalyse :\n1. Tendances marché VTC Côte d'Ivoire (Abidjan) — utilise les données web\n2. Mouvements concurrents (Yango, InDriver, Bolt) — positionnement actuel\n3. Opportunités concrètes pour Boyah Group vu nos données actuelles\n4. Menaces et risques\n5. 2 recommandations stratégiques actionnables\n\nDONNÉES ENTREPRISE :\n${ctxStr}${web}`

    case "financial_query":
      return `${message}\n\n📊 DONNÉES FINANCIÈRES BOYAH GROUP :\n${ctxStr}`

    case "driver_query":
      return `${message}\n\n👥 DONNÉES CHAUFFEURS :\n${ctxStr}`

    case "vehicle_query":
      return `${message}\n\n🚗 DONNÉES VÉHICULES :\n${ctxStr}`

    case "client_query":
      return `${message}\n\n🤝 DONNÉES CLIENTS (véhicules sous gestion) :\n${ctxStr}\n\nRappel direction de l'argent : C'EST BOYAH QUI VERSE AUX CLIENTS (le client est le propriétaire du véhicule, Boyah l'exploite et lui reverse sa part). Ne jamais dire "le client a versé" ou "le client doit".\n\nLexique : "net client" = ce que Boyah doit au client ce mois = montant mensuel − max(0, dépenses − 50 000 FCFA) ; "charge Boyah" = min(dépenses, 50 000 FCFA). Fenêtre de paiement : 5-10 du mois suivant. Statuts : deja_verse / a_verser / en_retard / pas_encore_du / en_cours / futur.`

    case "operational":
      return `${message}\n\n🔄 DONNÉES BOYAH TRANSPORT (Yango) :\n${ctxStr}`

    default: // conversation
      return `${message}\n\n📊 CONTEXTE BOYAH :\n${ctxStr}${web}`
  }
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

    const intent: IntentType = forcedType || classifyIntent(message)

    // Commande /memoire
    if (intent === "show_memory") {
      const { data: mem } = await sb.from("agent_memory").select("*").order("importance", { ascending: false }).limit(30)
      const text = mem && mem.length > 0
        ? `🧠 Mémoire BOYA (${mem.length} entrées)\n\n` + mem.map(m => `• [${m.categorie}] ${m.cle}\n  ${m.valeur} (priorité ${m.importance})`).join("\n\n")
        : "🧠 Ma mémoire est encore vide. Parle-moi de ton entreprise !"
      return NextResponse.json({ ok: true, response: text, type: intent })
    }

    // ── Fetch contexte ciblé + historique en parallèle ────────────────────────
    // Toujours charger l'historique (quel que soit l'intent) pour conserver la mémoire conversationnelle
    const [context, { data: recentConvs }] = await Promise.all([
      fetchContext(intent),
      sb.from("agent_conversations")
        .select("role, content")
        .eq("telegram_chat_id", chat_id || "system")
        .order("created_at", { ascending: false })
        .limit(20),
    ])

    // ── Historique conversation propre ────────────────────────────────────────
    const GREETING_PATTERNS = ["bonjour boss", "bonjour !", "salut boss", "bienvenue sur boya",
      "comment je peux t'aider", "comment puis-je vous aider", "prêt à bosser",
      "qu'est-ce qu'on attaque", "je suis à votre écoute"]

    const rawHistory: ConvMessage[] = (recentConvs || [])
      .reverse()
      .filter(c => {
        if (!c.content?.trim()) return false
        if (c.role === "assistant") {
          const lower = c.content.toLowerCase()
          if (GREETING_PATTERNS.some(p => lower.includes(p))) return false
        }
        return true
      })
      .map(c => ({ role: c.role as "user" | "assistant", content: c.content }))

    // Garantir l'alternance
    const history: ConvMessage[] = []
    for (const msg of rawHistory) {
      if (history.length === 0 || history[history.length - 1].role !== msg.role) {
        history.push(msg)
      }
    }

    // ── Tavily search si pertinent ────────────────────────────────────────────
    let webContext = ""
    const needsSearch = intent === "market_research" || intent === "daily_report" ||
      (intent === "conversation" && /marche|concurrent|yango|indriver|bolt|tendance|reglementation/i.test(
        message.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      ))

    if (needsSearch && process.env.TAVILY_API_KEY) {
      const query = intent === "market_research"
        ? `marché VTC Abidjan Côte d'Ivoire Yango InDriver Bolt 2025 actualités`
        : intent === "daily_report"
        ? `actualités transport VTC Abidjan Côte d'Ivoire ${new Date().getFullYear()}`
        : message
      webContext = await tavilySearch(query)
    }

    // ── Construction du contenu utilisateur ──────────────────────────────────
    const userContent = buildUserContent(intent, message, context as Record<string, unknown>, webContext)
    const safeContent = userContent?.trim() || message?.trim() || "Bonjour"

    const cleanHistory = history.length > 0 && history[history.length - 1].role === "user"
      ? history.slice(0, -1)
      : history

    // Tokens adaptés à l'intent
    const maxTokensMap: Record<IntentType, number> = {
      daily_report:    1500,
      alerts:          800,
      market_research: 1800,
      financial_query: 1200,
      driver_query:    1200,
      vehicle_query:   1200,
      client_query:    1200,
      operational:     1200,
      show_memory:     800,
      conversation:    1024,
    }
    const maxTokens = maxTokensMap[intent] || 1024

    // ── Appel Claude Opus ─────────────────────────────────────────────────────
    const claudeResponse = await anthropic.messages.create({
      model:      "claude-opus-4-6",
      max_tokens: maxTokens,
      system:     SYSTEM_PROMPT,
      messages:   [...cleanHistory, { role: "user", content: safeContent }],
    })

    const rawResponse = claudeResponse.content.find(b => b.type === "text")?.text || "Impossible de générer une réponse."

    let cleanResponse = stripMarkdown(await extractAndSaveMemory(rawResponse))

    const TELEGRAM_LIMIT = 3800
    if (cleanResponse.length > TELEGRAM_LIMIT) {
      cleanResponse = cleanResponse.slice(0, TELEGRAM_LIMIT) + "\n\n(suite disponible — demande la suite)"
    }

    // ── Sauvegardes asynchrones ───────────────────────────────────────────────
    // On sauvegarde TOUS les échanges dans agent_conversations (quel que soit l'intent)
    // pour garder une mémoire conversationnelle complète.
    const chatId = chat_id || "system"
    Promise.all([
      sb.from("agent_conversations").insert([
        { telegram_chat_id: chatId, telegram_user_id, role: "user",      content: message },
        { telegram_chat_id: chatId, telegram_user_id, role: "assistant", content: cleanResponse },
      ]),
      intent !== "conversation"
        ? sb.from("agent_analyses").insert({
            type:    intent,
            titre:   `${intent} – ${(context as Record<string, unknown>).date as string}`,
            contenu: cleanResponse,
            donnees: context,
          })
        : Promise.resolve(),
    ]).catch(err => console.error("[agent] save error:", err))

    return NextResponse.json({ ok: true, response: cleanResponse, type: intent })

  } catch (err) {
    console.error("[agent/process]", err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
