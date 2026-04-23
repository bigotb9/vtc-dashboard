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

  const { inspection } = body

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
      inspection:  inspection  || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Tâches depuis notes libres
  if (notes?.trim()) {
    const lignes = notes.split(/[\n,;]/).map((s: string) => s.trim()).filter(Boolean)
    const taches = lignes.map((desc: string) => ({
      id_vehicule, immatriculation, description: desc, id_entretien: data.id,
    }))
    await supabase.from("taches_suivi").insert(taches)
  }

  // Tâches auto depuis inspection : points critiques / très mauvais / pannes
  if (inspection) {
    const autoTaches: { id_vehicule: number; immatriculation: string; description: string; id_entretien: string }[] = []
    const add = (desc: string) => autoTaches.push({ id_vehicule, immatriculation, description: desc, id_entretien: data.id })

    const ECL_LABELS: Record<string, string> = {
      phares_croisement: "Phares croisement", phares_route: "Phares route",
      feux_arriere: "Feux arrière", feux_stop: "Feux de stop",
      clignotants_av_g: "Clignotant avant G", clignotants_av_d: "Clignotant avant D",
      clignotants_ar_g: "Clignotant arrière G", clignotants_ar_d: "Clignotant arrière D",
      feux_recul: "Feux de recul", feux_plaque: "Feux de plaque",
      feux_detresse: "Feux de détresse", feux_brouillard: "Feux brouillard",
    }
    const MECA_LABELS: Record<string, string> = {
      huile_moteur: "Huile moteur", liquide_refroid: "Liquide refroidissement",
      liquide_frein: "Liquide de frein", lave_glace: "Lave-glace",
      courroie: "Courroie", filtre_air: "Filtre à air", batterie: "Batterie",
    }
    const PNEU_LABELS: Record<string, string> = {
      avant_gauche: "Pneu avant gauche", avant_droit: "Pneu avant droit",
      arriere_gauche: "Pneu arrière gauche", arriere_droit: "Pneu arrière droit",
      secours: "Pneu de secours",
    }
    const DOC_LABELS: Record<string, string> = {
      carte_grise: "Carte grise", assurance: "Assurance", controle_technique: "Contrôle technique",
    }

    if (inspection.eclairage)
      Object.entries(inspection.eclairage).forEach(([k, v]) => { if (!v) add(`🔦 ${ECL_LABELS[k] || k} en panne`) })
    if (inspection.carrosserie)
      Object.entries(inspection.carrosserie).forEach(([k, v]) => { if (v === "tres_mauvais") add(`🚗 Carrosserie ${k.replace(/_/g, " ")} — très mauvais état`) })
    if (inspection.interieur) {
      Object.entries(inspection.interieur).forEach(([k, v]) => {
        if (v === "tres_mauvais") add(`🪑 Intérieur ${k.replace(/_/g, " ")} — très mauvais état`)
        if (v === "panne") add(`🪑 ${k.replace(/_/g, " ")} en panne`)
      })
    }
    if (inspection.mecanique)
      Object.entries(inspection.mecanique).forEach(([k, v]) => { if (v === "critique") add(`🔧 ${MECA_LABELS[k] || k} — niveau critique`) })
    if (inspection.pneus)
      Object.entries(inspection.pneus).forEach(([k, v]) => {
        if (v === "a_changer") add(`🛞 ${PNEU_LABELS[k] || k} — à changer`)
        if (k === "secours" && v === "absent") add("🛞 Pneu de secours absent")
      })
    if (inspection.freinage)
      Object.entries(inspection.freinage).forEach(([k, v]) => {
        if (v === "critique" || v === "panne") add(`🛑 Freinage ${k.replace(/_/g, " ")} — ${v === "panne" ? "en panne" : "critique"}`)
      })
    if (inspection.documents)
      Object.entries(inspection.documents).forEach(([k, v]) => {
        if (v === "expire") add(`📄 ${DOC_LABELS[k] || k} expiré — à renouveler`)
        if (v === "absent") add(`📄 ${DOC_LABELS[k] || k} absent — à régulariser`)
      })
    if (inspection.equipements) {
      if (!inspection.equipements.extincteur) add("🧯 Extincteur absent — à installer")
      if (!inspection.equipements.triangle) add("⚠️ Triangle de signalisation absent")
      if (!inspection.equipements.cric) add("🔩 Cric/clés de roue absents")
    }

    if (autoTaches.length > 0) await supabase.from("taches_suivi").insert(autoTaches)
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
