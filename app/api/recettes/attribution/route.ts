import { NextResponse } from "next/server"
import { supabaseAdmin as sb } from "@/lib/supabaseAdmin"
import { attribuerRecettes, type RecetteRaw, type VehiculeInfo } from "@/lib/attributionAlgo"

// Pagination helper pour dépasser la limite de 1000 lignes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll<T>(builder: () => any): Promise<T[]> {
  const PAGE = 1000
  const all: T[] = []
  let offset = 0
  while (true) {
    const { data } = await builder().range(offset, offset + PAGE - 1)
    if (!data || data.length === 0) break
    all.push(...data as T[])
    if (data.length < PAGE) break
    offset += PAGE
    if (all.length >= 100000) break
  }
  return all
}

/** Normalise : derniers 8 chiffres pour matching insensible au format (+225, 0 devant, etc.) */
function normPhone8(raw: string | null | undefined): string {
  if (!raw) return ""
  return raw.replace(/[^0-9]/g, "").slice(-8)
}

export async function POST() {
  try {
    // 1. Charger TOUTES les recettes wave (pas via la vue pour éviter les pertes)
    // NB: la vraie PK est "id" (id_recette est une ancienne colonne, souvent NULL)
    const recettes = await fetchAll<{
      id:                                     number
      "Horodatage":                           string
      "Montant net":                          number
      "Numéro de téléphone de contrepartie":  string | null
    }>(
      () => sb.from("recettes_wave")
        .select("id, \"Horodatage\", \"Montant net\", \"Numéro de téléphone de contrepartie\"")
        .not("Montant net", "is", null)
        .gt("Montant net", 0)
    )

    // 2. Charger les chauffeurs pour matcher par téléphone (last 8 digits)
    const { data: chauffeurs } = await sb
      .from("chauffeurs")
      .select("id_chauffeur, numero_wave")

    // 3. Charger TOUTES les affectations (historique inclus)
    const { data: allAff } = await sb
      .from("affectation_chauffeurs_vehicules")
      .select("id_chauffeur, id_vehicule, date_debut, date_fin")

    // Grouper par chauffeur pour lookup rapide
    const affByChauffeur = new Map<number, { id_vehicule: number; date_debut: string; date_fin: string | null }[]>()
    for (const a of allAff || []) {
      if (!a.id_chauffeur || !a.id_vehicule) continue
      if (!affByChauffeur.has(a.id_chauffeur)) affByChauffeur.set(a.id_chauffeur, [])
      affByChauffeur.get(a.id_chauffeur)!.push({
        id_vehicule: a.id_vehicule,
        date_debut:  a.date_debut || "1900-01-01",
        date_fin:    a.date_fin,
      })
    }

    /** Trouve l'affectation active pour un chauffeur à une date donnée (priorité à l'affectation
     *  dans la période, sinon la plus récente comme fallback).
     *  Normalise les dates en YYYY-MM-DD pour éviter les bugs de comparaison avec timestamps. */
    function findVehicleAt(id_chauffeur: number, dateISO: string): number | null {
      const list = affByChauffeur.get(id_chauffeur)
      if (!list?.length) return null
      const d = dateISO.slice(0, 10)
      // Cherche une affectation active à cette date
      for (const a of list) {
        const debut = (a.date_debut || "1900-01-01").slice(0, 10)
        const fin   = a.date_fin ? a.date_fin.slice(0, 10) : null
        if (d >= debut && (!fin || d <= fin)) {
          return a.id_vehicule
        }
      }
      // Fallback 1 : affectation courante (date_fin null)
      const active = list.find(a => a.date_fin === null)
      if (active) return active.id_vehicule
      // Fallback 2 : la plus récente (par date_debut desc)
      const sorted = [...list].sort((a, b) => (b.date_debut || "").localeCompare(a.date_debut || ""))
      return sorted[0]?.id_vehicule || null
    }

    // Index chauffeur par téléphone (last 8 digits)
    const chByPhone = new Map<string, number>()
    for (const c of chauffeurs || []) {
      const p = normPhone8(c.numero_wave)
      if (p) chByPhone.set(p, c.id_chauffeur)
    }

    // 4. Enrichir les recettes avec id_vehicule selon la date du versement
    const recettesEnrichies: RecetteRaw[] = []
    let skipped_no_phone = 0, skipped_no_chauffeur = 0, skipped_no_affectation = 0

    for (const r of recettes) {
      const tel8 = normPhone8(r["Numéro de téléphone de contrepartie"])
      if (!tel8) { skipped_no_phone++; continue }

      const id_chauffeur = chByPhone.get(tel8)
      if (!id_chauffeur) { skipped_no_chauffeur++; continue }

      // Utiliser la date du versement pour trouver l'affectation active à ce moment
      const dateISO = r["Horodatage"].slice(0, 10)
      const id_vehicule = findVehicleAt(id_chauffeur, dateISO)
      if (!id_vehicule) { skipped_no_affectation++; continue }

      recettesEnrichies.push({
        id:            r.id,
        id_vehicule,
        Horodatage:    r["Horodatage"],
        "Montant net": r["Montant net"],
      })
    }

    // 5. Charger les véhicules avec leur montant attendu
    const { data: vehicules } = await sb
      .from("vehicules")
      .select("id_vehicule, montant_recette_jour")

    const vMap = new Map<number, VehiculeInfo>()
    for (const v of vehicules || []) {
      if (v.id_vehicule) vMap.set(v.id_vehicule, {
        id_vehicule: v.id_vehicule,
        montant_recette_jour: Number(v.montant_recette_jour || 0),
      })
    }

    // 6. Charger les jours fériés
    const { data: feriesRaw } = await sb.from("jours_feries").select("date, montant")
    const feriesMap = new Map<string, number>()
    for (const f of feriesRaw || []) {
      feriesMap.set(f.date, Number(f.montant || 15000))
    }

    // 7. Calculer les attributions avec l'algorithme
    const attributions = attribuerRecettes(recettesEnrichies, vMap, feriesMap)

    // 8. Remplacer toutes les attributions (simple et sûr)
    await sb.from("versement_attribution").delete().gte("jour_exploitation", "1900-01-01")

    // 9. Insérer par lots de 500
    const CHUNK = 500
    for (let i = 0; i < attributions.length; i += CHUNK) {
      const chunk = attributions.slice(i, i + CHUNK).map(a => ({
        id_recette:        a.id_recette,
        id_vehicule:       a.id_vehicule,
        jour_exploitation: a.jour_exploitation,
        montant_attribue:  a.montant_attribue,
        type_attribution:  a.type_attribution,
      }))
      const { error } = await sb.from("versement_attribution").insert(chunk)
      if (error) {
        console.error("[attribution] insert error:", error)
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      }
    }

    // 10. Auto-justifier les jours fériés (par véhicule actif)
    if (feriesRaw && feriesRaw.length > 0) {
      const { data: vehiculesActifs } = await sb
        .from("vehicules")
        .select("id_vehicule")
        .eq("statut", "ACTIF")

      const today = new Date().toISOString().slice(0, 10)
      const justifsAuto: Record<string, unknown>[] = []
      for (const v of vehiculesActifs || []) {
        for (const f of feriesRaw) {
          if (f.date > today) continue
          justifsAuto.push({
            id_vehicule:       v.id_vehicule,
            jour_exploitation: f.date,
            type:              "jour_ferie",
            motif:             "Jour férié",
            montant_attendu:   Number(f.montant || 15000),
            montant_recu:      0,
            auto_genere:       true,
          })
        }
      }
      if (justifsAuto.length > 0) {
        await sb.from("justifications_versement").upsert(justifsAuto, { onConflict: "id_vehicule,jour_exploitation" })
      }
    }

    return NextResponse.json({
      ok:                     true,
      attributions_count:     attributions.length,
      recettes_total:         recettes.length,
      recettes_enrichies:     recettesEnrichies.length,
      skipped_no_phone,
      skipped_no_chauffeur,
      skipped_no_affectation,
    })
  } catch (e) {
    console.error("[attribution]", e)
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
