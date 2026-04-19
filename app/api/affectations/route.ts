import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"

// GET — affectation active d'un chauffeur ou d'un véhicule
// ?id_chauffeur=X  ou  ?id_vehicule=X
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id_chauffeur = searchParams.get("id_chauffeur")
  const id_vehicule  = searchParams.get("id_vehicule")

  // 1. Récupérer l'affectation active
  let query = supabase
    .from("affectation_chauffeurs_vehicules")
    .select("id_affectation, id_chauffeur, id_vehicule, date_debut, date_fin")
    .is("date_fin", null)
    .order("date_debut", { ascending: false })

  if (id_chauffeur) query = query.eq("id_chauffeur", id_chauffeur)
  if (id_vehicule)  query = query.eq("id_vehicule",  id_vehicule)

  const { data: affectations, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!affectations?.length) return NextResponse.json({ affectations: [] })

  // 2. Enrichir avec les données chauffeur et véhicule
  const enriched = await Promise.all(affectations.map(async (aff) => {
    const [{ data: chauffeur }, { data: vehicule }] = await Promise.all([
      supabase.from("chauffeurs").select("id_chauffeur, nom, actif, photo").eq("id_chauffeur", aff.id_chauffeur).single(),
      supabase.from("vehicules").select("id_vehicule, immatriculation, type_vehicule, statut, photo").eq("id_vehicule", aff.id_vehicule).single(),
    ])
    return { ...aff, chauffeurs: chauffeur, vehicules: vehicule }
  }))

  return NextResponse.json({ affectations: enriched })
}

// POST — créer une nouvelle affectation
// Règles : un chauffeur → 1 seul véhicule / un véhicule → max 2 chauffeurs simultanés
export async function POST(req: NextRequest) {
  const { id_chauffeur, id_vehicule } = await req.json()
  if (!id_chauffeur || !id_vehicule)
    return NextResponse.json({ error: "id_chauffeur et id_vehicule requis" }, { status: 400 })

  const today = new Date().toISOString().slice(0, 10)

  // Vérifier que le chauffeur n'est pas déjà affecté à ce même véhicule
  const { data: existing } = await supabase
    .from("affectation_chauffeurs_vehicules")
    .select("id_affectation")
    .eq("id_chauffeur", id_chauffeur)
    .eq("id_vehicule", id_vehicule)
    .is("date_fin", null)
  if (existing?.length) return NextResponse.json({ error: "Ce chauffeur est déjà affecté à ce véhicule" }, { status: 400 })

  // Vérifier que le véhicule n'a pas déjà 2 chauffeurs actifs
  const { data: vehiculeAff } = await supabase
    .from("affectation_chauffeurs_vehicules")
    .select("id_affectation")
    .eq("id_vehicule", id_vehicule)
    .is("date_fin", null)
  if ((vehiculeAff?.length ?? 0) >= 2)
    return NextResponse.json({ error: "Ce véhicule a déjà 2 chauffeurs affectés (maximum)" }, { status: 400 })

  // Fermer l'affectation active du chauffeur sur un AUTRE véhicule (s'il en a une)
  await supabase
    .from("affectation_chauffeurs_vehicules")
    .update({ date_fin: today })
    .eq("id_chauffeur", id_chauffeur)
    .neq("id_vehicule", id_vehicule)
    .is("date_fin", null)

  // Si une affectation FERMÉE existe déjà pour cette paire (chauffeur, véhicule),
  // la rouvrir plutôt que d'en créer une nouvelle → évite l'accumulation de doublons historiques
  const { data: closed } = await supabase
    .from("affectation_chauffeurs_vehicules")
    .select("id_affectation")
    .eq("id_chauffeur", id_chauffeur)
    .eq("id_vehicule", id_vehicule)
    .not("date_fin", "is", null)
    .order("date_fin", { ascending: false })
    .limit(1)

  if (closed?.length) {
    const { data, error } = await supabase
      .from("affectation_chauffeurs_vehicules")
      .update({ date_fin: null, date_debut: today })
      .eq("id_affectation", closed[0].id_affectation)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, affectation: data, reopened: true })
  }

  // Sinon, créer une nouvelle affectation
  const { data, error } = await supabase
    .from("affectation_chauffeurs_vehicules")
    .insert({ id_chauffeur, id_vehicule, date_debut: today })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, affectation: data })
}

// DELETE — terminer une affectation précise (id_chauffeur + id_vehicule)
// ou toutes les affectations actives d'un chauffeur (id_chauffeur seul)
export async function DELETE(req: NextRequest) {
  const { id_chauffeur, id_vehicule } = await req.json()
  const today = new Date().toISOString().slice(0, 10)

  let query = supabase
    .from("affectation_chauffeurs_vehicules")
    .update({ date_fin: today })
    .is("date_fin", null)
    .eq("id_chauffeur", id_chauffeur)

  if (id_vehicule) query = query.eq("id_vehicule", id_vehicule)

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
