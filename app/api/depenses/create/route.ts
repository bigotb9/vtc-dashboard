import { NextRequest, NextResponse } from "next/server"
import { logActivity } from "@/lib/logActivity"
import { requirePermission } from "@/lib/requirePermission"
import { supabase } from "@/lib/supabaseClient"

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, "manage_depenses")
    if (!auth.ok) return auth.response

    const body = await req.json()

    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "Corps de requête invalide" }, { status: 400 })
    }

    const { error } = await supabase
      .from("depenses_vehicules")
      .insert([body])

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }

    const token = req.headers.get("authorization")?.replace("Bearer ", "") || ""
    await logActivity({ token, action: "create_depense", entity: body.immatriculation || null, details: { type: body.type_depense, montant: body.montant, immatriculation: body.immatriculation } })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 })
  }
}
