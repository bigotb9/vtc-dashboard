/**
 * lib/cockpit/retardsVehicules.ts
 *
 * Helper unique pour identifier les véhicules en retard de versement
 * (Cockpit Boyah — Étape 1 backend, refonte 27/05/2026).
 *
 * Source de vérité : lib/completude/calculCompletude.ts (la même que
 * /api/completude et le widget Suivi versements). On évite ainsi toute
 * divergence métier entre le Cockpit et le calendrier complet.
 *
 * Règle métier :
 *   - Fenêtre J-7 → hier (la veille incluse, aujourd'hui exclu).
 *   - On filtre les cases dont le statut est "manquant" ou
 *     "paye_insuffisant" (les "manquant_justifie" et "paye_justifie"
 *     ont un motif → ne sont pas du retard à relancer).
 *   - Échéance = J+1 00:00 UTC. Un retard d'1 jour = 24h.
 *   - Chauffeurs à contacter = ceux actuellement affectés au véhicule
 *     (affectation_chauffeurs_vehicules.date_fin IS NULL).
 *
 * Tri : par heures_de_retard DESC (plus en retard d'abord).
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { getCompletude } from "@/lib/completude/calculCompletude"

const DAYS_LOOKBACK = 7

export type VehiculeRetardStatut = "manquant" | "paye_insuffisant"

export type VehiculeRetard = {
  id_vehicule:        number
  plaque:             string
  jour_exploitation:  string   // ISO date YYYY-MM-DD
  echeance:           string   // ISO datetime (J+1 00:00 UTC)
  heures_de_retard:   number
  montant_attendu:    number
  montant_recu:       number
  montant_du:         number   // attendu - recu (≥ 0)
  statut:             VehiculeRetardStatut
  chauffeurs_affectes: Array<{
    id:               number
    nom:              string
    numero_wave:      string | null
    numero_whatsapp:  string | null
  }>
}

/** Format YYYY-MM-DD pour un objet Date en UTC. */
function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Échéance = lendemain 00:00 UTC du jour d'exploitation. */
function echeanceFor(jourExploitation: string): Date {
  const [y, m, d] = jourExploitation.split("-").map(Number)
  const echeance = new Date(Date.UTC(y, m - 1, d, 0, 0, 0))
  echeance.setUTCDate(echeance.getUTCDate() + 1)
  return echeance
}

export async function getVehiculesEnRetard(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<VehiculeRetard[]> {
  // ─── 1. Fenêtre J-DAYS_LOOKBACK → hier (inclus) ────────────────────────
  const yesterday = new Date(now)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const toStr = isoDay(yesterday)

  const fromDate = new Date(now)
  fromDate.setUTCDate(fromDate.getUTCDate() - DAYS_LOOKBACK)
  const fromStr = isoDay(fromDate)

  // ─── 2. Calcul de complétude (source unique) ───────────────────────────
  const { cases } = await getCompletude(supabase, { from: fromStr, to: toStr })

  // Ne garder que les statuts qui demandent une action de relance.
  const enRetard = cases.filter(
    c => c.statut === "manquant" || c.statut === "paye_insuffisant",
  )
  if (enRetard.length === 0) return []

  // ─── 3. Chauffeurs actuellement affectés aux véhicules en retard ───────
  const idsVehicules = Array.from(new Set(enRetard.map(c => c.id_vehicule)))
  const { data: affRows, error: affErr } = await supabase
    .from("affectation_chauffeurs_vehicules")
    .select("id_chauffeur, id_vehicule")
    .in("id_vehicule", idsVehicules)
    .is("date_fin", null)
  if (affErr) throw new Error(`affectations: ${affErr.message}`)

  const chauffeursParVehicule = new Map<number, number[]>()
  const idsChauffeurs = new Set<number>()
  for (const a of affRows ?? []) {
    if (a.id_chauffeur == null || a.id_vehicule == null) continue
    if (!chauffeursParVehicule.has(a.id_vehicule)) chauffeursParVehicule.set(a.id_vehicule, [])
    chauffeursParVehicule.get(a.id_vehicule)!.push(a.id_chauffeur)
    idsChauffeurs.add(a.id_chauffeur)
  }

  // ─── 4. Détails chauffeurs (nom + numero_wave) ─────────────────────────
  type ChauffeurInfo = { id: number; nom: string; numero_wave: string | null; numero_whatsapp: string | null }
  const chauffeursMap = new Map<number, ChauffeurInfo>()
  if (idsChauffeurs.size > 0) {
    const { data: chRows, error: chErr } = await supabase
      .from("chauffeurs")
      .select("id_chauffeur, nom, numero_wave")
      .in("id_chauffeur", Array.from(idsChauffeurs))
    if (chErr) throw new Error(`chauffeurs: ${chErr.message}`)
    for (const c of chRows ?? []) {
      const numWave = c.numero_wave ?? null
      chauffeursMap.set(c.id_chauffeur, {
        id:              c.id_chauffeur,
        nom:             c.nom ?? "Sans nom",
        numero_wave:     numWave,
        // Pas de colonne numero_whatsapp en BD : on utilise numero_wave
        // comme fallback (en CI les deux numéros sont souvent identiques).
        numero_whatsapp: numWave,
      })
    }
  }

  // ─── 5. Construire VehiculeRetard[] + tri ──────────────────────────────
  const retards: VehiculeRetard[] = enRetard.map(c => {
    const echeance = echeanceFor(c.date)
    const heuresRetard = Math.max(
      0,
      Math.floor((now.getTime() - echeance.getTime()) / 3_600_000),
    )
    const chauffeurIds = chauffeursParVehicule.get(c.id_vehicule) ?? []
    const chauffeurs_affectes = chauffeurIds
      .map(id => chauffeursMap.get(id))
      .filter((x): x is ChauffeurInfo => !!x)

    return {
      id_vehicule:        c.id_vehicule,
      plaque:             c.immatriculation,
      jour_exploitation:  c.date,
      echeance:           echeance.toISOString(),
      heures_de_retard:   heuresRetard,
      montant_attendu:    c.montant_attendu,
      montant_recu:       c.montant_recu,
      montant_du:         Math.max(0, c.montant_attendu - c.montant_recu),
      statut:             c.statut as VehiculeRetardStatut,
      chauffeurs_affectes,
    }
  })

  retards.sort((a, b) => b.heures_de_retard - a.heures_de_retard)
  return retards
}
