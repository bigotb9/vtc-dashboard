/**
 * GET /api/compta/bilan-cash-net?period=day|week|month
 *
 * Renvoie le bilan cash net (recettes Wave + autres recettes - charges -
 * reversements bailleurs) sur la periode demandee + comparaison avec la
 * periode precedente equivalente.
 *
 * Conventions :
 *   - Recettes Wave        : operations type='entree' source='recette_wave'
 *                            caisse_id = Wave Boyah (5311)
 *   - Autres recettes      : operations type='entree' avec autres sources
 *   - Charges              : operations type='sortie' rattachees a un compte
 *                            SYSCOHADA en classe 6xx hors 6131
 *   - Reversements         : operations type='sortie' rattachees au compte
 *     bailleurs              SYSCOHADA 6131 (locations vehicules)
 *
 * Le rattachement compte SYSCOHADA passe par operations.categorie_id
 * -> categories_operations.compte_syscohada_code.
 */

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const WAVE_BOYAH_LIBELLE = "Wave Boyah"

// ─── Calcul des bornes de periode ────────────────────────────────────────
function pad(n: number): string { return String(n).padStart(2, "0") }
function iso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

type Period = "day" | "week" | "month"
type Range  = { from: string; to: string; label: string }

function rangesFor(period: Period): { current: Range; previous: Range } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (period === "day") {
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
    return {
      current:  { from: iso(today),     to: iso(today),     label: "Aujourd'hui" },
      previous: { from: iso(yesterday), to: iso(yesterday), label: "Hier" },
    }
  }
  if (period === "month") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1)
    const prevFirst = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const prevLast  = new Date(today.getFullYear(), today.getMonth(),     0) // dernier jour du mois precedent
    return {
      current:  { from: iso(first),     to: iso(today),    label: "Ce mois" },
      previous: { from: iso(prevFirst), to: iso(prevLast), label: "Mois dernier" },
    }
  }
  // week (defaut) : lundi -> dimanche
  // JS getDay() : 0=dimanche, 1=lundi, ..., 6=samedi
  const dow = today.getDay()
  const daysSinceMonday = (dow + 6) % 7   // 0 si lundi, 6 si dimanche
  const monday = new Date(today); monday.setDate(today.getDate() - daysSinceMonday)
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
  const prevMonday = new Date(monday); prevMonday.setDate(monday.getDate() - 7)
  const prevSunday = new Date(sunday); prevSunday.setDate(sunday.getDate() - 7)
  return {
    current:  { from: iso(monday),     to: iso(sunday),     label: "Cette semaine"  },
    previous: { from: iso(prevMonday), to: iso(prevSunday), label: "Semaine dernière" },
  }
}

// ─── Calcul des 4 agregats sur 1 fenetre ────────────────────────────────
interface Agregats {
  recettes_wave:          number
  autres_recettes:        number
  charges:                number
  reversements_bailleurs: number
  cash_net:               number
}

async function computeAgregats(
  from: string, to: string,
  waveBoyahId: string,
  catCompteMap: Map<string, string>,   // categorie_id -> code SYSCOHADA
): Promise<Agregats> {
  // Pagination operations sur la fenetre
  const ops: Array<{ type: string; source: string; montant: number; caisse_id: string | null; categorie_id: string | null }> = []
  let pageFrom = 0
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from("operations")
      .select("type, source, montant, caisse_id, categorie_id")
      .eq("statut", "valide")
      .gte("date_operation", from)
      .lte("date_operation", to)
      .range(pageFrom, pageFrom + 999)
    if (error) throw new Error(`operations [${from}..${to}] : ${error.message}`)
    if (!data || data.length === 0) break
    ops.push(...(data as typeof ops))
    if (data.length < 1000) break
    pageFrom += 1000
  }

  let recettes_wave = 0
  let autres_recettes = 0
  let charges = 0
  let reversements_bailleurs = 0

  for (const o of ops) {
    // FIX 23/05/2026 - Exclure les transferts internes des deux cotes.
    // Les transferts internes (Wave Boyah -> Caisse siege pour un retrait cash,
    // par exemple) generent 2 operations jumelles source='transfert_interne' :
    // une sortie sur la caisse source + une entree sur la caisse destination.
    // Ce n'est NI une recette NI une depense : juste un deplacement d'argent.
    // Sans ce filtre, l'entree etait comptabilisee a tort dans autres_recettes
    // (bug remonte 23/05 : ligne "Autres recettes" gonflee par 1 539 200 F
    // sur un simple retrait cash Wave -> Siege).
    if (o.source === "transfert_interne") continue

    const m = Number(o.montant || 0)
    if (o.type === "entree") {
      if (o.source === "recette_wave" && o.caisse_id === waveBoyahId) {
        recettes_wave += m
      } else {
        autres_recettes += m
      }
    } else if (o.type === "sortie") {
      const code = (o.categorie_id && catCompteMap.get(o.categorie_id)) || ""
      // Reversement bailleurs : compte 6131 (locations vehicules)
      if (code === "6131") {
        reversements_bailleurs += m
      } else if (code.startsWith("6")) {
        // Toute charge classe 6xx hors 6131
        charges += m
      }
      // Sinon : sortie hors charge classe 6 (ex sorties tresorerie diverses) -> ignoree
    }
  }

  return {
    recettes_wave:          Math.round(recettes_wave),
    autres_recettes:        Math.round(autres_recettes),
    charges:                Math.round(charges),
    reversements_bailleurs: Math.round(reversements_bailleurs),
    cash_net:               Math.round(
                              recettes_wave + autres_recettes - charges - reversements_bailleurs
                            ),
  }
}

// ─── Route handler ──────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const periodRaw = (url.searchParams.get("period") || "week").toLowerCase()
  if (periodRaw !== "day" && periodRaw !== "week" && periodRaw !== "month") {
    return NextResponse.json(
      { ok: false, error: "period doit etre day | week | month" },
      { status: 400 },
    )
  }
  const period = periodRaw as Period
  const { current, previous } = rangesFor(period)

  // 1. ID caisse Wave Boyah
  const { data: waveBoyahRow, error: waveErr } = await supabaseAdmin
    .from("caisses")
    .select("id")
    .eq("libelle", WAVE_BOYAH_LIBELLE)
    .maybeSingle()
  if (waveErr || !waveBoyahRow) {
    return NextResponse.json({ ok: false, error: `Caisse '${WAVE_BOYAH_LIBELLE}' introuvable` }, { status: 500 })
  }
  const waveBoyahId = (waveBoyahRow as { id: string }).id

  // 2. Map categorie_id -> compte_syscohada_code
  const { data: cats, error: catErr } = await supabaseAdmin
    .from("categories_operations")
    .select("id, compte_syscohada_code")
  if (catErr) {
    return NextResponse.json({ ok: false, error: catErr.message }, { status: 500 })
  }
  const catCompteMap = new Map<string, string>()
  for (const c of cats || []) {
    if (c.id && c.compte_syscohada_code) {
      catCompteMap.set(c.id, c.compte_syscohada_code)
    }
  }

  // 3. Agregats sur les 2 periodes
  let agg: Agregats, aggPrev: Agregats
  try {
    [agg, aggPrev] = await Promise.all([
      computeAgregats(current.from,  current.to,  waveBoyahId, catCompteMap),
      computeAgregats(previous.from, previous.to, waveBoyahId, catCompteMap),
    ])
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }

  const variation = agg.cash_net - aggPrev.cash_net
  const variationPct = aggPrev.cash_net !== 0
    ? Math.round((variation / Math.abs(aggPrev.cash_net)) * 100)
    : (variation !== 0 ? null : 0)

  return NextResponse.json({
    ok:                     true,
    period,
    periode:                { from: current.from,  to: current.to,  label: current.label },
    recettes_wave:          agg.recettes_wave,
    autres_recettes:        agg.autres_recettes,
    charges:                agg.charges,
    reversements_bailleurs: agg.reversements_bailleurs,
    cash_net:               agg.cash_net,
    comparaison: {
      periode_precedente:   { from: previous.from, to: previous.to, label: previous.label },
      cash_net_precedent:   aggPrev.cash_net,
      variation,
      variation_pct:        variationPct,
    },
  })
}
