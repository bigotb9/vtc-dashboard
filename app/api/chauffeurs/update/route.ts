import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { requirePermission } from "@/lib/requirePermission"

// Whitelist stricte des champs modifiables (anti mass-assignment).
// Exclut la PK `id_chauffeur`. Toute cle hors de cette liste => 400.
const ALLOWED_FIELDS = new Set<string>([
  "nom", "numero_wave", "numero_wave_2", "numero_wave_3", "actif",
  "commentaire", "photo", "photo_permis_recto", "photo_permis_verso",
  "numero_permis", "numero_cni", "situation_matrimoniale", "nombre_enfants",
  "domicile", "numero_garant",
])

export async function PATCH(req: NextRequest) {
  const auth = await requirePermission(req, "edit_chauffeur")
  if (!auth.ok) return auth.response

  const { id, ...fields } = await req.json()

  if (!id) {
    return NextResponse.json({ success: false, error: "id manquant" }, { status: 400 })
  }

  // Rejet de toute cle non autorisee (fin du mass-assignment).
  const rejected = Object.keys(fields).filter(k => !ALLOWED_FIELDS.has(k))
  if (rejected.length > 0) {
    return NextResponse.json(
      { success: false, error: `Champs non autorises : ${rejected.join(", ")}` },
      { status: 400 },
    )
  }
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ success: false, error: "Aucun champ a modifier" }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from("chauffeurs")
    .update(fields)
    .eq("id_chauffeur", id)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
