/**
 * /api/ai-insights/latest
 * Lit le dernier résultat d'analyse depuis Supabase (écrit par n8n).
 * Appelé au chargement de la page pour afficher la dernière analyse automatique.
 */
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET() {
  try {
    // Dernière analyse (auto ou manuelle)
    const { data: latest, error } = await sb
      .from("ai_insights")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows found (table vide, pas une erreur fatale)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    if (!latest) {
      return NextResponse.json({ ok: true, data: null })
    }

    return NextResponse.json({
      ok:         true,
      data:       latest,
      analysis:   latest.analysis,
      retardVehicules: latest.retard_vehicules || [],
      isAfterNoon:     latest.is_after_noon   ?? false,
      totalVehicules:  latest.total_vehicules  ?? 0,
      triggeredBy:     latest.triggered_by,
      generatedAt:     latest.created_at,
    })

  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 })
  }
}
