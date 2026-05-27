/**
 * GET /api/cockpit/conversations
 *
 * Retourne la liste des conversations à préparer (suggestions automatiques
 * basées sur les retards et performances). Messages templatés en dur (pas
 * d'appel LLM) avec placeholders {nom}, {date_jour}, {montant}, etc.
 *
 * 3 types :
 *   - retard_chauffeur  : versement quotidien en retard → message de relance
 *   - retard_client     : (placeholder — voir TODO ci-dessous)
 *   - felicitation      : chauffeur explose son objectif → message positif
 *
 * Cockpit Boyah — Étape 1/3 backend (27/05/2026).
 */

import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { requirePermission } from "@/lib/requirePermission"
import { getVehiculesEnRetard } from "@/lib/cockpit/retardsVehicules"

export const dynamic     = "force-dynamic"
export const maxDuration = 30

const FELICITATION_THRESHOLD_PCT = 30   // +30% vs moyenne 30j

type ConversationContact = {
  nom:    string
  numero: string
}

type Conversation = {
  id:        string
  type:      "retard_chauffeur" | "retard_client" | "felicitation"
  titre:     string
  meta:      string
  message:   string
  contacts:  ConversationContact[]
}

/** Replace {placeholder} dans un template. */
function tpl(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    k in vars ? String(vars[k]) : `{${k}}`
  )
}

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, "view_dashboard")
  if (!auth.ok) return auth.response

  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  try {
    const conversations: Conversation[] = []

    // ════════════════════════════════════════════════════════════════════
    // 1. RETARDS CHAUFFEURS — message de relance par véhicule
    //    - statut "manquant"          → relance complète
    //    - statut "paye_insuffisant"  → demande de régularisation du delta
    // ════════════════════════════════════════════════════════════════════
    try {
      const retards = await getVehiculesEnRetard(supabaseAdmin, now)
      const templateManquant =
        "Bonjour {nom}, le versement pour la journée du {date_jour} n'est pas arrivé. " +
        "Le montant attendu est de {montant_attendu} F. Tu peux régler aujourd'hui ? Merci."
      const templateInsuffisant =
        "Bonjour {nom}, j'ai bien reçu {montant_recu} F pour la journée du {date_jour}, " +
        "mais il manque encore {montant_du} F sur les {montant_attendu} F attendus. " +
        "Tu peux régulariser aujourd'hui ? Merci."

      for (const r of retards) {
        const contacts: ConversationContact[] = r.chauffeurs_affectes
          .map(c => ({
            nom:    c.nom,
            numero: c.numero_whatsapp ?? c.numero_wave ?? "",
          }))
          .filter(c => c.numero)

        if (contacts.length === 0) continue

        const isManquant = r.statut === "manquant"
        const template = isManquant ? templateManquant : templateInsuffisant
        const metaSuffix = isManquant
          ? `${r.heures_de_retard}h · ${Math.round(r.montant_du).toLocaleString("fr-FR")} F dû`
          : `reçu ${Math.round(r.montant_recu).toLocaleString("fr-FR")}/${Math.round(r.montant_attendu).toLocaleString("fr-FR")} F · manque ${Math.round(r.montant_du).toLocaleString("fr-FR")} F`

        // Un message par chauffeur affecté (texte personnalisé avec son nom).
        for (const c of contacts) {
          conversations.push({
            id:    `relance:${r.plaque}:${r.jour_exploitation}:${c.nom}`,
            type:  "retard_chauffeur",
            titre: `Relancer ${c.nom} — ${r.plaque}`,
            meta:  `Jour ${r.jour_exploitation} · ${metaSuffix}`,
            message: tpl(template, {
              nom:             c.nom.split(" ")[0],
              date_jour:       r.jour_exploitation,
              montant_attendu: Math.round(r.montant_attendu).toLocaleString("fr-FR"),
              montant_recu:    Math.round(r.montant_recu).toLocaleString("fr-FR"),
              montant_du:      Math.round(r.montant_du).toLocaleString("fr-FR"),
            }),
            contacts: [c],
          })
        }
      }
    } catch (e) {
      console.warn("[cockpit/conversations] retards_chauffeurs swallow:", (e as Error).message)
    }

    // ════════════════════════════════════════════════════════════════════
    // 2. RETARDS CLIENTS — placeholder
    // ════════════════════════════════════════════════════════════════════
    // TODO : implémenter la détection des Clients investisseurs dont le
    // versement du mois précédent n'a pas été enregistré dans
    // versements_clients après le 5 du mois courant. Logique à factoriser
    // avec lib/clients/calculBeneficeCumule.ts. Pour l'étape 1, on retourne
    // vide pour ne pas bloquer la livraison de la couche backend.

    // ════════════════════════════════════════════════════════════════════
    // 3. FÉLICITATIONS — chauffeurs >+30% vs moyenne 30j
    // ════════════════════════════════════════════════════════════════════
    try {
      const todayStart = `${today}T00:00:00Z`
      const todayEnd   = `${today}T23:59:59Z`
      const thirtyAgo  = new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10)

      const [todayRecRes, monthRecRes, chauffeursRes] = await Promise.all([
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
        supabaseAdmin
          .from("chauffeurs")
          .select("nom, numero_wave"),
      ])

      // Total du jour par chauffeur (clé : nom contrepartie)
      const todayTotals = new Map<string, number>()
      for (const r of todayRecRes.data ?? []) {
        const nom = String((r as Record<string, unknown>)["Nom de contrepartie"] ?? "").trim()
        if (!nom) continue
        const m = Number((r as Record<string, unknown>)["Montant net"] ?? 0)
        todayTotals.set(nom, (todayTotals.get(nom) ?? 0) + m)
      }

      // Moyenne quotidienne 30j par chauffeur
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

      // Map nom contrepartie → numero_wave (best-effort lookup)
      const numeroByNom = new Map<string, string>()
      for (const c of chauffeursRes.data ?? []) {
        const nom = String(c.nom ?? "").trim()
        const num = String(c.numero_wave ?? "").trim()
        if (nom && num) numeroByNom.set(nom.toLowerCase(), num)
      }

      const templateFelicitation =
        "Bravo {nom} ! Tu as fait {montant} F aujourd'hui, soit +{pct}% par rapport " +
        "à ta moyenne. Continue comme ça. 💪"

      for (const [nom, totalJour] of todayTotals) {
        const entry = monthSums.get(nom)
        if (!entry || entry.jours.size === 0) continue
        const moyenne = entry.total / entry.jours.size
        if (moyenne <= 0) continue
        const pct = Math.round(((totalJour - moyenne) / moyenne) * 100)
        if (pct < FELICITATION_THRESHOLD_PCT) continue

        const numero = numeroByNom.get(nom.toLowerCase()) ?? ""
        const contacts: ConversationContact[] = numero
          ? [{ nom, numero }]
          : []

        conversations.push({
          id:    `felicitation:${today}:${nom}`,
          type:  "felicitation",
          titre: `Féliciter ${nom}`,
          meta:  `+${pct}% vs moyenne 30j · ${Math.round(totalJour).toLocaleString("fr-FR")} F aujourd'hui`,
          message: tpl(templateFelicitation, {
            nom:     nom.split(" ")[0],
            montant: Math.round(totalJour).toLocaleString("fr-FR"),
            pct,
          }),
          contacts,
        })
      }
    } catch (e) {
      console.warn("[cockpit/conversations] felicitations swallow:", (e as Error).message)
    }

    return NextResponse.json({ ok: true, data: conversations })
  } catch (e) {
    console.error("[cockpit/conversations]", e)
    return NextResponse.json(
      { ok: false, error: (e as Error).message || "Erreur serveur" },
      { status: 500 },
    )
  }
}
