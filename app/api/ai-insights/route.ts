import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  try {
    // ── 1. FETCH ALL DATA IN PARALLEL ─────────────────────────────────────
    const [
      { data: chauffeurs },
      { data: vehicules },
      { data: recettesRaw },
      { data: depensesCategories },
      { data: caJour },
      { data: caMois },
      { data: classement },
    ] = await Promise.all([
      sb.from("vue_chauffeurs_vehicules").select("*"),
      sb.from("vue_dashboard_vehicules").select("*"),
      sb.from("recettes_wave").select("*").order("Horodatage", { ascending: false }).limit(200),
      sb.from("vue_depenses_categories").select("*"),
      sb.from("vue_ca_journalier").select("*").order("date", { ascending: false }).limit(30),
      sb.from("vue_ca_mensuel").select("*").order("annee", { ascending: false }).order("mois", { ascending: false }).limit(12),
      sb.from("classement_chauffeurs").select("*").order("ca", { ascending: false }),
    ])

    // ── 2. LATE PAYMENTS DETECTION ────────────────────────────────────────
    const today       = new Date().toISOString().split("T")[0]
    const now         = new Date()
    const isAfterNoon = now.getHours() >= 12

    const vehiculesPayesToday = new Set(
      (recettesRaw || [])
        .filter(r => r.Horodatage?.startsWith(today))
        .map(r => r.Immatriculation || r.immatriculation || r.vehicule)
    )

    const allVehicules = vehicules || []
    const retardVehicules = allVehicules
      .filter(v => !vehiculesPayesToday.has(v.immatriculation))
      .map(v => {
        const chauffeur = (chauffeurs || []).find(c =>
          c.vehicule === v.immatriculation || c.id_vehicule === v.id_vehicule
        )
        return {
          immatriculation: v.immatriculation,
          chauffeur:       chauffeur?.nom || v.chauffeur || v.nom_chauffeur || "—",
          telephone:       chauffeur?.numero_wave || v.telephone || null,
          ca_mensuel:      v.ca_mensuel || 0,
          statut:          v.statut || "INCONNU",
        }
      })

    // ── 3. BUILD METRICS ──────────────────────────────────────────────────
    const totalCA  = (caJour || []).reduce((s, r) => s + Number(r.chiffre_affaire || 0), 0)
    const totalDep = (depensesCategories || []).reduce((s, r) => s + Number(r.total_depenses || 0), 0)
    const profit   = totalCA - totalDep
    const marge    = totalCA > 0 ? ((profit / totalCA) * 100).toFixed(1) : "0"

    const caLast7   = (caJour || []).slice(0, 7).map(d => ({ date: d.date, ca: d.chiffre_affaire }))
    const caLast12M = (caMois || []).slice(0, 6).map(d => ({ mois: `${d.mois}/${d.annee}`, ca: d.chiffre_affaire }))

    const topChauffeurs = (classement || []).slice(0, 5).map(c => ({
      nom: c.nom, ca: c.ca, courses: c.nb_courses || 0
    }))

    const caParVehicule = allVehicules
      .sort((a, b) => (b.ca_mensuel || 0) - (a.ca_mensuel || 0))
      .slice(0, 5)
      .map(v => ({ immatriculation: v.immatriculation, ca: v.ca_mensuel, profit: v.profit }))

    const dataContext = {
      entreprise: "Boyah Group – VTC en Afrique de l'Ouest",
      date_analyse: today,
      flotte: {
        total_vehicules:   allVehicules.length,
        vehicules_actifs:  allVehicules.filter(v => v.statut === "ACTIF").length,
        total_chauffeurs:  (chauffeurs || []).length,
        chauffeurs_actifs: (chauffeurs || []).filter(c => c.actif === true).length,
      },
      finances: {
        ca_total_cumule:        totalCA,
        total_depenses:         totalDep,
        profit_net:             profit,
        marge_beneficiaire:     `${marge}%`,
        ca_hier:                caLast7[0]?.ca || 0,
        evolution_7j:           caLast7,
        evolution_mensuelle:    caLast12M,
        depenses_par_categorie: depensesCategories || [],
      },
      performance_chauffeurs: {
        top5:             topChauffeurs,
        total_classement: (classement || []).length,
      },
      performance_vehicules: {
        top5_ca:                    caParVehicule,
        vehicules_en_retard:        retardVehicules.length,
        taux_retard_paiement_today: allVehicules.length > 0
          ? `${((retardVehicules.length / allVehicules.length) * 100).toFixed(0)}%`
          : "0%",
      },
    }

    // ── 4. CALL CLAUDE ────────────────────────────────────────────────────
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const prompt = `Tu es un consultant expert en gestion d'entreprises VTC (Voitures de Transport avec Chauffeur) en Afrique de l'Ouest, spécialisé dans l'optimisation des revenus et la stratégie d'entreprise.

Analyse ces données réelles de Boyah Group et génère un rapport business complet :

DONNÉES :
${JSON.stringify(dataContext, null, 2)}

INSTRUCTIONS :
- Analyse les KPIs financiers en profondeur avec des observations précises
- Compare avec les standards du secteur VTC en Afrique de l'Ouest (Sénégal, Côte d'Ivoire, Mali, etc.) en utilisant tes connaissances du marché
- Identifie les leviers de croissance spécifiques à ce contexte géographique et économique
- Propose des recommandations concrètes, chiffrées et actionnables
- Calcule un score de santé business global avec sous-scores
- Détecte les anomalies et patterns dans les données
- Sois précis, direct et orienté résultats

RÉPONDS UNIQUEMENT en JSON valide avec cette structure exacte (pas de markdown, pas de texte avant ou après) :
{
  "resume_executif": "Résumé en 3-4 phrases percutantes du bilan global",
  "score_sante": {
    "global": 0,
    "financier": 0,
    "operationnel": 0,
    "croissance": 0,
    "commentaire": "Explication du score"
  },
  "analyse_financiere": {
    "bilan": "Analyse détaillée des chiffres",
    "points_forts": ["point 1", "point 2"],
    "points_faibles": ["point 1", "point 2"],
    "opportunites": ["opportunité 1", "opportunité 2"]
  },
  "benchmark_marche": {
    "marge_moyenne_secteur": "pourcentage ou fourchette",
    "positionnement": "leader|dans_la_moyenne|en_dessous",
    "comparaison": "Analyse comparative détaillée avec le marché VTC Afrique de l'Ouest",
    "sources_comparatives": "Données issues de..."
  },
  "performance_chauffeurs": {
    "analyse": "Analyse de la performance de l'équipe",
    "dispersion_revenus": "Commentaire sur l'écart entre meilleurs et moins bons",
    "recommandations": ["recommandation 1", "recommandation 2"]
  },
  "recommandations": [
    {
      "titre": "Titre court et percutant",
      "description": "Description détaillée de l'action",
      "impact_estime": "Impact quantifié si possible",
      "delai_mise_en_oeuvre": "Délai réaliste",
      "priorite": "critique|haute|normale",
      "categorie": "revenus|couts|operations|rh"
    }
  ],
  "alertes": [
    {
      "titre": "Titre de l'alerte",
      "description": "Description du problème",
      "urgence": "critique|haute|normale",
      "action_immediate": "Action à prendre maintenant"
    }
  ],
  "plan_action_30j": [
    "Semaine 1 : ...",
    "Semaine 2 : ...",
    "Semaine 3 : ...",
    "Semaine 4 : ..."
  ]
}`

    const message = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 4096,
      messages:   [{ role: "user", content: prompt }],
    })

    // Extract text response
    let rawText = ""
    for (const block of message.content) {
      if (block.type === "text") rawText += block.text
    }

    // Parse JSON – strip markdown code fences if present
    const cleaned = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim()

    let analysis: Record<string, unknown>
    try {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { resume_executif: rawText }
    } catch {
      analysis = { resume_executif: rawText, parse_error: true }
    }

    // ── 5. RETURN ─────────────────────────────────────────────────────────
    return NextResponse.json({
      ok:             true,
      analysis,
      retardVehicules,
      isAfterNoon,
      totalVehicules: allVehicules.length,
      generatedAt:    new Date().toISOString(),
    })

  } catch (err) {
    console.error("[ai-insights]", err)
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    )
  }
}
