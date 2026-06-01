/**
 * GET /api/cockpit/alertes
 *
 * Retourne la liste consolidée des alertes (max 10) triées par criticité :
 *   - retard_vehicule (critique)  — versement manquant (rien reçu)
 *   - retard_vehicule (attention) — paiement insuffisant (partiel)
 *   - caisse_negative (attention)
 *   - top_performer   (positive)  — chauffeur > X% au-dessus de sa moyenne 30j
 *
 * Note 01/06/2026 : l'alerte "marge_baisse" a été RETIRÉE d'ici. La marge
 * est une donnée financière sensible : elle est désormais calculée
 * proprement (via le helper getMargeConsolidee, sur marge_reelle) dans
 * /api/cockpit/finances, gardée par la permission view_finances_cockpit.
 * L'ancien calcul ad-hoc ici (Σ entrées − Σ sorties sans filtrer la
 * catégorie) sur-comptait les dépenses.
 *
 * Notes :
 *   - Plus de détection "vehicule_inactif" basée sur commandes_yango.
 *     Yango = activité commerciale externe, Boyah Group = comptabilité
 *     interne. Les deux plans sont distincts. Les retards de versement
 *     sont la seule source légitime côté pilotage flotte.
 *
 * Cockpit Boyah — Étape 1/3 backend (refonte 27/05/2026).
 */

import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { requirePermission } from "@/lib/requirePermission"
import { getVehiculesEnRetard } from "@/lib/cockpit/retardsVehicules"

export const dynamic     = "force-dynamic"
export const maxDuration = 30

const MAX_ALERTES = 10
const TOP_PERFORMER_THRESHOLD_PCT = 30   // +30% vs moyenne 30j

type AlerteAction = {
  label:    string
  type:     "whatsapp" | "voir" | "fait"
  href?:    string
  contacts?: Array<{ nom: string; numero: string }>
}

type Alerte = {
  id:     string
  niveau: "critique" | "attention" | "positive"
  titre:  string
  meta:   string
  type:   "retard_vehicule" | "caisse_negative" | "top_performer"
  actions: AlerteAction[]
}

const NIVEAU_ORDER: Record<Alerte["niveau"], number> = {
  critique:  0,
  attention: 1,
  positive:  2,
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "view_cockpit")
  if (!auth.ok) return auth.response

  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  try {
    const alertes: Alerte[] = []

    // ════════════════════════════════════════════════════════════════════
    // 1. RETARDS VÉHICULES
    //    - statut "manquant"          → niveau critique
    //    - statut "paye_insuffisant"  → niveau attention
    // ════════════════════════════════════════════════════════════════════
    const retards = await getVehiculesEnRetard(supabaseAdmin, now)
    for (const r of retards) {
      const contacts = r.chauffeurs_affectes
        .map(c => ({ nom: c.nom, numero: c.numero_whatsapp ?? c.numero_wave ?? "" }))
        .filter(c => c.numero)

      const isManquant = r.statut === "manquant"
      const niveau: Alerte["niveau"] = isManquant ? "critique" : "attention"
      const titre  = isManquant
        ? `${r.plaque} — versement manquant`
        : `${r.plaque} — versement insuffisant`
      const meta = isManquant
        ? `Jour ${r.jour_exploitation} · ${r.heures_de_retard}h · ${Math.round(r.montant_du).toLocaleString("fr-FR")} F dû · ${r.chauffeurs_affectes.length} chauffeur(s)`
        : `Jour ${r.jour_exploitation} · reçu ${Math.round(r.montant_recu).toLocaleString("fr-FR")} / ${Math.round(r.montant_attendu).toLocaleString("fr-FR")} F · manque ${Math.round(r.montant_du).toLocaleString("fr-FR")} F`

      alertes.push({
        id:     `retard:${r.plaque}:${r.jour_exploitation}`,
        niveau,
        titre,
        meta,
        type:   "retard_vehicule",
        actions: contacts.length > 0
          ? [{ label: `Relancer ${contacts.length} chauffeur(s)`, type: "whatsapp", contacts }]
          : [{ label: "Voir le détail", type: "voir", href: `/recettes/suivi` }],
      })
    }

    // ════════════════════════════════════════════════════════════════════
    // 2. CAISSES NÉGATIVES (attention)
    // ════════════════════════════════════════════════════════════════════
    // Calcul rapide : solde_initial + SUM(entrees) - SUM(sorties) par
    // caisse/compte. Pour éviter de scanner tout l'historique, on agrège
    // les opérations valides directement.
    try {
      const [caissesRes, comptesRes, opsRes] = await Promise.all([
        supabaseAdmin.from("caisses").select("id, libelle, solde_initial"),
        supabaseAdmin.from("comptes").select("id, libelle, solde_initial"),
        supabaseAdmin
          .from("operations")
          .select("caisse_id, compte_id, type, montant")
          .eq("statut", "valide"),
      ])

      const soldes = new Map<string, { libelle: string; solde: number; type: "caisse" | "compte" }>()
      for (const c of caissesRes.data ?? []) {
        soldes.set(c.id, { libelle: c.libelle, solde: Number(c.solde_initial ?? 0), type: "caisse" })
      }
      for (const c of comptesRes.data ?? []) {
        soldes.set(c.id, { libelle: c.libelle, solde: Number(c.solde_initial ?? 0), type: "compte" })
      }
      for (const op of opsRes.data ?? []) {
        const id = (op as { caisse_id?: string; compte_id?: string }).caisse_id
                ?? (op as { caisse_id?: string; compte_id?: string }).compte_id
        if (!id || !soldes.has(id)) continue
        const m = Number((op as { montant?: number }).montant ?? 0)
        const sign = (op as { type?: string }).type === "entree" ? 1 : -1
        soldes.get(id)!.solde += sign * m
      }

      for (const [id, info] of soldes) {
        if (info.solde < 0) {
          alertes.push({
            id:     `caisse_neg:${id}`,
            niveau: "attention",
            titre:  `${info.libelle} : solde négatif`,
            meta:   `Solde : ${Math.round(info.solde).toLocaleString("fr-FR")} F`,
            type:   "caisse_negative",
            actions: [
              { label: "Voir la caisse", type: "voir", href: `/comptabilite/comptes-caisses/${id}` },
            ],
          })
        }
      }
    } catch (e) {
      console.warn("[cockpit/alertes] caisses_negatives swallow:", (e as Error).message)
    }

    // ════════════════════════════════════════════════════════════════════
    // 3. TOP PERFORMER DU JOUR (positive)
    // ════════════════════════════════════════════════════════════════════
    // (L'ancienne alerte "marge_baisse" vivait ici — déplacée vers
    //  /api/cockpit/finances, cf. en-tête de fichier.)
    try {
      const todayStart = `${today}T00:00:00Z`
      const todayEnd   = `${today}T23:59:59Z`
      const thirtyAgo  = new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10)

      const [todayRecRes, monthRecRes] = await Promise.all([
        supabaseAdmin
          .from("recettes_wave")
          .select("\"Nom de contrepartie\", \"Montant net\"")
          .gte("Horodatage", todayStart)
          .lte("Horodatage", todayEnd)
          .gt("Montant net", 0),
        supabaseAdmin
          .from("recettes_wave")
          .select("\"Nom de contrepartie\", \"Montant net\", \"Horodatage\"")
          .gte("Horodatage", `${thirtyAgo}T00:00:00Z`)
          .lt("Horodatage", todayStart)
          .gt("Montant net", 0),
      ])

      // Total du jour par chauffeur
      const todayTotals = new Map<string, number>()
      for (const r of todayRecRes.data ?? []) {
        const nom = String((r as Record<string, unknown>)["Nom de contrepartie"] ?? "").trim()
        if (!nom) continue
        const m = Number((r as Record<string, unknown>)["Montant net"] ?? 0)
        todayTotals.set(nom, (todayTotals.get(nom) ?? 0) + m)
      }

      // Moyenne quotidienne 30j par chauffeur (somme / nb jours distincts d'activité)
      const monthSums = new Map<string, { total: number; jours: Set<string> }>()
      for (const r of monthRecRes.data ?? []) {
        const nom = String((r as Record<string, unknown>)["Nom de contrepartie"] ?? "").trim()
        if (!nom) continue
        const m = Number((r as Record<string, unknown>)["Montant net"] ?? 0)
        const jour = String((r as Record<string, unknown>)["Horodatage"] ?? "").slice(0, 10)
        if (!monthSums.has(nom)) monthSums.set(nom, { total: 0, jours: new Set() })
        const entry = monthSums.get(nom)!
        entry.total += m
        if (jour) entry.jours.add(jour)
      }

      // Trouve le top performer du jour qui est >= seuil au-dessus de sa moyenne
      let bestNom: string | null = null
      let bestPct = 0
      let bestMontant = 0
      let bestMoyenne = 0
      for (const [nom, totalJour] of todayTotals) {
        const entry = monthSums.get(nom)
        if (!entry || entry.jours.size === 0) continue
        const moyenne = entry.total / entry.jours.size
        if (moyenne <= 0) continue
        const pct = Math.round(((totalJour - moyenne) / moyenne) * 100)
        if (pct >= TOP_PERFORMER_THRESHOLD_PCT && pct > bestPct) {
          bestPct     = pct
          bestNom     = nom
          bestMontant = totalJour
          bestMoyenne = moyenne
        }
      }
      if (bestNom) {
        alertes.push({
          id:     `top:${today}:${bestNom}`,
          niveau: "positive",
          titre:  `${bestNom} explose son objectif`,
          meta:   `+${bestPct}% vs moyenne 30j · ${Math.round(bestMontant).toLocaleString("fr-FR")} F aujourd'hui (vs ${Math.round(bestMoyenne).toLocaleString("fr-FR")} F en moyenne)`,
          type:   "top_performer",
          actions: [{ label: "Féliciter par WhatsApp", type: "whatsapp" }],
        })
      }
    } catch (e) {
      console.warn("[cockpit/alertes] top_performer swallow:", (e as Error).message)
    }

    // ─── Tri + cap ──────────────────────────────────────────────────────
    alertes.sort((a, b) => NIVEAU_ORDER[a.niveau] - NIVEAU_ORDER[b.niveau])
    return NextResponse.json({ ok: true, data: alertes.slice(0, MAX_ALERTES) })
  } catch (e) {
    console.error("[cockpit/alertes]", e)
    return NextResponse.json(
      { ok: false, error: (e as Error).message || "Erreur serveur" },
      { status: 500 },
    )
  }
}
