import { NextRequest, NextResponse } from "next/server"
import { logActivity } from "@/lib/logActivity"
import { requirePermission } from "@/lib/requirePermission"
import { supabase } from "@/lib/supabaseClient"

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, "create_chauffeur")
    if (!auth.ok) return auth.response

    const body = await req.json()

    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "Corps de requête invalide" }, { status: 400 })
    }

    // Détection de doublon par numero_wave normalisé (évite les doublons futurs)
    if (body.numero_wave) {
      const normalized = String(body.numero_wave).replace(/[^0-9]/g, "")
      const last8      = normalized.slice(-8)
      const { data: existants } = await supabase
        .from("chauffeurs")
        .select("id_chauffeur, nom, numero_wave, actif")
      const dup = (existants || []).find(c => {
        if (!c.numero_wave) return false
        const n = c.numero_wave.replace(/[^0-9]/g, "")
        return n === normalized || n.slice(-8) === last8
      })
      if (dup) {
        return NextResponse.json(
          { success: false, error: `Doublon détecté : le chauffeur "${dup.nom}" (ID ${dup.id_chauffeur}${dup.actif ? ", actif" : ", inactif"}) utilise déjà ce numéro Wave.` },
          { status: 400 }
        )
      }
    }

    const { error } = await supabase.from("chauffeurs").insert([body])
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 })

    const token = req.headers.get("authorization")?.replace("Bearer ", "") || ""
    await logActivity({ token, action: "create_chauffeur", entity: body.nom || null, details: { nom: body.nom, numero_wave: body.numero_wave } })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
}
