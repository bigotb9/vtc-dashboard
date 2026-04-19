import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id_vehicule = searchParams.get("id_vehicule")
  const date_from   = searchParams.get("date_from")
  const date_to     = searchParams.get("date_to")

  let query = supabase
    .from("entretiens")
    .select("*")
    .order("date_realise", { ascending: false })

  if (id_vehicule) query = query.eq("id_vehicule", id_vehicule)
  if (date_from)   query = query.gte("date_realise", date_from)
  if (date_to)     query = query.lte("date_realise", date_to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entretiens: data })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    id_vehicule, immatriculation, date_realise,
    huile_moteur, filtre_huile, filtre_air, filtre_pollen,
    liquide_refroidissement, huile_frein, pneus,
    km_vidange, cout, technicien, notes,
  } = body

  if (!id_vehicule || !immatriculation || !date_realise)
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 })

  const { data, error } = await supabase
    .from("entretiens")
    .insert({
      id_vehicule, immatriculation, date_realise,
      huile_moteur:            !!huile_moteur,
      filtre_huile:            !!filtre_huile,
      filtre_air:              !!filtre_air,
      filtre_pollen:           !!filtre_pollen,
      liquide_refroidissement: !!liquide_refroidissement,
      huile_frein:             !!huile_frein,
      pneus:                   !!pneus,
      km_vidange:  km_vidange  || null,
      cout:        cout        || 0,
      technicien:  technicien  || null,
      notes:       notes       || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Si des notes existent → créer des réparations à programmer (1 par ligne)
  if (notes?.trim()) {
    const lignes = notes.split(/[\n,;]/).map((s: string) => s.trim()).filter(Boolean)
    const taches = lignes.map((desc: string) => ({
      id_vehicule,
      immatriculation,
      description:  desc,
      id_entretien: data.id,
    }))
    await supabase.from("taches_suivi").insert(taches)
  }

  return NextResponse.json({ success: true, entretien: data })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 })
  const { error } = await supabase.from("entretiens").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
