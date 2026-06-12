import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { requirePermission } from "@/lib/requirePermission"

// Whitelist stricte des champs modifiables (anti mass-assignment).
// Exclut la PK `id_vehicule`. Toute cle hors de cette liste => 400.
const ALLOWED_FIELDS = new Set<string>([
  "immatriculation", "type_vehicule", "proprietaire", "statut",
  "montant de la recette", "km_actuel", "km_derniere_vidange",
  "date_derniers_pneus", "date_assurance", "date_expiration_assurance",
  "date_visite_technique", "date_expiration_visite", "photo",
  "carte_grise_recto", "carte_grise_verso", "sous_gestion",
  "montant_mensuel_client", "id_client", "date_carte_stationnement",
  "date_expiration_carte_stationnement", "date_patente",
  "date_expiration_patente", "montant_recette_jour", "valeur_acquisition_client",
])

export async function PATCH(req: NextRequest) {
  const auth = await requirePermission(req, "edit_vehicle")
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
    .from("vehicules")
    .update(fields)
    .eq("id_vehicule", id)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
