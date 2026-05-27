/**
 * Liste enrichie des exercices avec nb_operations + nb_brouillons.
 * Phase 4.2 Module 2.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"
import type { ExerciceItem } from "@/types/compta-ui"

export async function listExercices(): Promise<ExerciceItem[]> {
  const { data, error } = await supabaseAdmin
    .from("exercices")
    .select("id, annee, libelle, date_debut, date_fin, statut, date_cloture, cloture_par, resultat_net, bilan_pdf_path, cr_pdf_path, created_at")
    .order("annee", { ascending: false })
  if (error) throw error
  const rows = (data ?? []) as Array<{
    id: string; annee: number; libelle: string; date_debut: string; date_fin: string;
    statut: string; date_cloture: string | null; cloture_par: string | null;
    resultat_net: number | string | null; bilan_pdf_path: string | null;
    cr_pdf_path: string | null; created_at: string;
  }>

  // Bulk count operations + brouillons par exercice
  const exIds = rows.map(r => r.id)
  const totalMap = new Map<string, number>()
  const brouillonMap = new Map<string, number>()
  if (exIds.length > 0) {
    const { data: ops } = await supabaseAdmin
      .from("operations")
      .select("exercice_id, statut")
      .in("exercice_id", exIds)
    for (const r of (ops ?? []) as Array<{ exercice_id: string; statut: string }>) {
      totalMap.set(r.exercice_id, (totalMap.get(r.exercice_id) ?? 0) + 1)
      if (r.statut === "brouillon") {
        brouillonMap.set(r.exercice_id, (brouillonMap.get(r.exercice_id) ?? 0) + 1)
      }
    }
  }

  // Bulk noms uploaders
  const userIds = Array.from(new Set(rows.map(r => r.cloture_par).filter((x): x is string => !!x)))
  const userMap = new Map<string, string>()
  if (userIds.length > 0) {
    const { data: ps } = await supabaseAdmin.from("profiles").select("id, name").in("id", userIds)
    for (const p of (ps ?? []) as Array<{ id: string; name: string | null }>) {
      if (p.name) userMap.set(p.id, p.name)
    }
  }

  return rows.map(r => ({
    id:               r.id,
    annee:            r.annee,
    libelle:          r.libelle,
    date_debut:       r.date_debut,
    date_fin:         r.date_fin,
    statut:           r.statut as ExerciceItem["statut"],
    date_cloture:     r.date_cloture,
    cloture_par_name: r.cloture_par ? (userMap.get(r.cloture_par) ?? null) : null,
    resultat_net:     r.resultat_net != null ? Number(r.resultat_net) : null,
    bilan_pdf_path:   r.bilan_pdf_path,
    cr_pdf_path:      r.cr_pdf_path,
    nb_operations:    totalMap.get(r.id) ?? 0,
    nb_brouillons:    brouillonMap.get(r.id) ?? 0,
    created_at:       r.created_at,
  }))
}
