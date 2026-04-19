import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin as sb } from "@/lib/supabaseAdmin"

const TOLERANCE = 0.99

export type CaseStatut =
  | "paye_complet"
  | "paye_insuffisant"
  | "paye_justifie"        // insuffisant + justifié
  | "manquant"
  | "manquant_justifie"
  | "en_cours"             // aujourd'hui
  | "jour_ferie_auto"      // jour férié (justif auto)
  | "non_ouvre"            // dimanche
  | "pre_service"          // avant le 1er versement du véhicule (pas encore dans la flotte)
  | "futur"                // date future

export type CaseData = {
  date:             string         // YYYY-MM-DD
  id_vehicule:      number
  immatriculation:  string
  montant_attendu:  number
  montant_recu:     number
  nb_transactions:  number
  statut:           CaseStatut
  justification?:   { type: string; motif: string | null; auto: boolean }
  types_attribution?: string[]     // types d'attribution dans les versements du jour
  chauffeurs?:      { nom: string; montant: number }[]   // chauffeurs ayant versé ce jour
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll<T>(builder: () => any): Promise<T[]> {
  const PAGE = 1000
  const all: T[] = []
  let offset = 0
  while (true) {
    const { data } = await builder().range(offset, offset + PAGE - 1)
    if (!data || data.length === 0) break
    all.push(...(data as T[]))
    if (data.length < PAGE) break
    offset += PAGE
    if (all.length >= 50000) break
  }
  return all
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const dateFrom = searchParams.get("from") || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const dateTo   = searchParams.get("to")   || new Date().toISOString().slice(0, 10)

    // 1. Véhicules actifs
    const { data: vehiculesActifs } = await sb
      .from("vehicules")
      .select("id_vehicule, immatriculation, montant_recette_jour, statut")
      .eq("statut", "ACTIF")
      .order("immatriculation")

    const vehicules = vehiculesActifs || []

    // 2. Jours fériés
    const { data: feries } = await sb.from("jours_feries").select("date, montant, libelle")
    const feriesMap = new Map<string, { montant: number; libelle: string }>()
    for (const f of feries || []) {
      feriesMap.set(f.date, { montant: Number(f.montant || 15000), libelle: f.libelle })
    }

    // 3. Attributions dans la plage (avec id_recette pour remonter au chauffeur)
    const attribs = await fetchAll<{ id_recette: number | null; id_vehicule: number; jour_exploitation: string; montant_attribue: number; type_attribution: string }>(
      () => sb.from("versement_attribution")
        .select("id_recette, id_vehicule, jour_exploitation, montant_attribue, type_attribution")
        .gte("jour_exploitation", dateFrom)
        .lte("jour_exploitation", dateTo)
    )

    // 3ter. Résoudre id_recette → nom du chauffeur (via téléphone Wave)
    //   recettes_wave.id ↔ versement_attribution.id_recette
    //   téléphone Wave (RIGHT 8) ↔ chauffeurs.numero_wave (RIGHT 8)
    const recetteIds = Array.from(new Set(attribs.map(a => a.id_recette).filter((x): x is number => x != null)))
    const recetteMap = new Map<number, string>()   // id_recette → tel8
    if (recetteIds.length > 0) {
      const CHUNK = 500
      for (let i = 0; i < recetteIds.length; i += CHUNK) {
        const { data } = await sb.from("recettes_wave")
          .select("id, \"Numéro de téléphone de contrepartie\"")
          .in("id", recetteIds.slice(i, i + CHUNK))
        for (const r of data || []) {
          const tel = String(r["Numéro de téléphone de contrepartie"] || "").replace(/[^0-9]/g, "").slice(-8)
          if (tel) recetteMap.set(r.id as number, tel)
        }
      }
    }
    const { data: chauffeurs } = await sb.from("chauffeurs").select("nom, numero_wave")
    const chauffeurParTel = new Map<string, string>()
    for (const c of chauffeurs || []) {
      const tel = String(c.numero_wave || "").replace(/[^0-9]/g, "").slice(-8)
      if (tel) chauffeurParTel.set(tel, c.nom)
    }

    // 3bis. Date du 1er versement par véhicule (toutes dates confondues)
    // → permet d'ignorer les jours AVANT que le véhicule ait commencé
    const premierMap = new Map<number, string>()
    for (const v of vehicules) {
      const { data } = await sb
        .from("versement_attribution")
        .select("jour_exploitation")
        .eq("id_vehicule", v.id_vehicule)
        .order("jour_exploitation", { ascending: true })
        .limit(1)
      if (data && data.length > 0) {
        premierMap.set(v.id_vehicule, data[0].jour_exploitation)
      }
    }

    // 4. Justifications dans la plage
    const { data: justifs } = await sb.from("justifications_versement")
      .select("*")
      .gte("jour_exploitation", dateFrom)
      .lte("jour_exploitation", dateTo)

    const justifMap = new Map<string, { type: string; motif: string | null; auto: boolean }>()
    for (const j of justifs || []) {
      justifMap.set(`${j.id_vehicule}|${j.jour_exploitation}`, {
        type: j.type, motif: j.motif, auto: !!j.auto_genere,
      })
    }

    // 5. Indexer attributions par (véhicule, jour)
    const attribMap = new Map<string, { montant: number; types: string[]; count: number; chauffeurs: { nom: string; montant: number }[] }>()
    for (const a of attribs) {
      const k = `${a.id_vehicule}|${a.jour_exploitation}`
      const cur = attribMap.get(k) || { montant: 0, types: [], count: 0, chauffeurs: [] }
      cur.montant += Number(a.montant_attribue || 0)
      if (a.type_attribution && !cur.types.includes(a.type_attribution)) cur.types.push(a.type_attribution)
      cur.count += 1
      // Résoudre le chauffeur via id_recette → tel → nom
      const tel = a.id_recette != null ? recetteMap.get(a.id_recette) : undefined
      const nom = tel ? chauffeurParTel.get(tel) : undefined
      if (nom) {
        const existing = cur.chauffeurs.find(c => c.nom === nom)
        if (existing) existing.montant += Number(a.montant_attribue || 0)
        else cur.chauffeurs.push({ nom, montant: Number(a.montant_attribue || 0) })
      }
      attribMap.set(k, cur)
    }

    // 6. Générer toutes les cases (véhicule × jour) dans la plage
    const cases: CaseData[] = []
    const today = new Date().toISOString().slice(0, 10)
    const start = new Date(dateFrom + "T00:00:00Z")
    const end   = new Date(dateTo   + "T00:00:00Z")

    const allDates: string[] = []
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      allDates.push(d.toISOString().slice(0, 10))
    }

    for (const v of vehicules) {
      for (const dateStr of allDates) {
        const dateObj = new Date(dateStr + "T00:00:00Z")
        const dow = dateObj.getUTCDay()  // 0 = dimanche
        const ferie = feriesMap.get(dateStr)
        const attribution = attribMap.get(`${v.id_vehicule}|${dateStr}`)
        const justification = justifMap.get(`${v.id_vehicule}|${dateStr}`)

        const montant_attendu = ferie ? ferie.montant : Number(v.montant_recette_jour || 0)
        const montant_recu    = attribution?.montant || 0
        const nb_tx           = attribution?.count || 0

        const premierVersement = premierMap.get(v.id_vehicule)

        let statut: CaseStatut
        if (dateStr > today) {
          statut = "futur"
        } else if (dow === 0) {
          statut = "non_ouvre"
        } else if (premierVersement && dateStr < premierVersement) {
          // Avant que le véhicule ait commencé à travailler dans la flotte
          statut = "pre_service"
        } else if (ferie && !attribution) {
          statut = "jour_ferie_auto"
        } else if (dateStr === today && !attribution) {
          statut = "en_cours"
        } else if (montant_attendu === 0) {
          statut = attribution ? "paye_complet" : "en_cours"
        } else if (montant_recu >= montant_attendu * TOLERANCE) {
          statut = "paye_complet"
        } else if (montant_recu > 0) {
          statut = justification ? "paye_justifie" : "paye_insuffisant"
        } else {
          statut = justification ? "manquant_justifie" : "manquant"
        }

        cases.push({
          date: dateStr,
          id_vehicule: v.id_vehicule,
          immatriculation: v.immatriculation,
          montant_attendu,
          montant_recu,
          nb_transactions: nb_tx,
          statut,
          justification,
          types_attribution: attribution?.types,
          chauffeurs: attribution?.chauffeurs,
        })
      }
    }

    // 7. Stats globales (on EXCLUT pre_service, non_ouvre et futur du calcul)
    const stats = {
      paye_complet:       cases.filter(c => c.statut === "paye_complet").length,
      paye_insuffisant:   cases.filter(c => c.statut === "paye_insuffisant").length,
      paye_justifie:      cases.filter(c => c.statut === "paye_justifie").length,
      manquant:           cases.filter(c => c.statut === "manquant").length,
      manquant_justifie:  cases.filter(c => c.statut === "manquant_justifie").length,
      jour_ferie_auto:    cases.filter(c => c.statut === "jour_ferie_auto").length,
      en_cours:           cases.filter(c => c.statut === "en_cours").length,
      non_ouvre:          cases.filter(c => c.statut === "non_ouvre").length,
      pre_service:        cases.filter(c => c.statut === "pre_service").length,
    }
    // Jours ouvrés effectifs (véhicule dans la flotte ce jour-là)
    const totalOuvres = cases.filter(c =>
      c.statut !== "non_ouvre" && c.statut !== "futur" && c.statut !== "pre_service"
    ).length
    const totalPayes  = stats.paye_complet + stats.paye_justifie + stats.manquant_justifie + stats.jour_ferie_auto
    const taux = totalOuvres > 0 ? Math.round(totalPayes / totalOuvres * 100) : 0

    return NextResponse.json({
      ok: true,
      vehicules,
      dates: allDates,
      cases,
      stats,
      taux_completion: taux,
    })
  } catch (e) {
    console.error("[completude]", e)
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
