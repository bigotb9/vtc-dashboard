import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { requirePermission } from "@/lib/requirePermission"

// Auth Lot Z (26/05/2026 audit) : requirePermission("view_dashboard") — la
// route etait ouverte (finding 2.4) et declenche un appel Claude Opus
// (cout API). Sans auth, exposition a DoS de budget Anthropic.

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, "view_dashboard")
  if (!auth.ok) return auth.response

  try {
    const { stats, platform = "facebook", tone = "professionnel" } = await req.json() as { stats: unknown; platform: string; tone: string }

    const platformGuides: Record<string, string> = {
      facebook:  "Facebook (ton professionnel, 150-250 mots, emojis modérés, appel à l'action)",
      instagram: "Instagram (accrocheur, 80-120 mots, hashtags pertinents, emojis expressifs)",
      linkedin:  "LinkedIn (ton business, 100-180 mots, chiffres mis en avant, pas d'emojis excès)",
    }
    const platformGuide = platformGuides[platform] || "Facebook"

    const prompt = `Tu es expert en marketing digital pour une entreprise de transport VTC en Côte d'Ivoire.

Génère un post ${platformGuide} pour Boyah Transport, partenaire Yango en Côte d'Ivoire.

Données actuelles (utilise-les naturellement dans le post) :
${JSON.stringify(stats, null, 2)}

Ton : ${tone}
Langue : Français (adapté au public ivoirien)

Le post doit :
- Valoriser la performance et la fiabilité de Boyah Transport
- Mentionner naturellement Yango si pertinent
- Inclure un call-to-action (rejoindre la flotte, ou appel clients)
- Ne PAS ressembler à de la publicité froide — être authentique et engageant

Retourne UNIQUEMENT le texte du post, sans introduction ni explication.`

    // Fallback en cascade : var dédiée posts → var générale → défaut.
    const response = await anthropic.messages.create({
      model:      process.env.ANTHROPIC_MODEL_POSTS || process.env.ANTHROPIC_MODEL || "claude-opus-4-8",
      max_tokens: 600,
      messages:   [{ role: "user", content: prompt }],
    })

    const post = response.content.find(b => b.type === "text")?.text || ""
    return NextResponse.json({ ok: true, post, platform })
  } catch (err) {
    console.error("[generate-post]", err)
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
