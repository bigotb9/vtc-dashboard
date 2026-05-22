/**
 * GET /api/vehicules/marge?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Renvoie la marge nette (recettes - charges) par vehicule actif sur la
 * periode demandee. Par defaut : 1er du mois en cours -> aujourd'hui.
 *
 * Sources :
 *   - Recettes : versement_attribution.montant_attribue agrege par id_vehicule
 *     sur jour_exploitation (parce que les ops source='recette_wave' ont
 *     vehicule_id=NULL en mode Option X depuis le patch v3 du 18/05).
 *   - Charges  : operations type='sortie' source='depense_vehicule' agregees
 *     par vehicule_id sur date_operation.
 *
 * Reponse triee par marge nette decroissante.
 */

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function firstDayOfMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
}
function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export interface MargeVehiculeRow {
  id_vehicule:     number
  immatriculation: string
  recettes:        number
  charges:         number
  marge:           number
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const from = url.searchParams.get("from") ?? firstDayOfMonth()
  const to   = url.searchParams.get("to")   ?? todayIso()

  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json(
      { ok: false, error: "Parametres 'from' et 'to' doivent etre au format YYYY-MM-DD" },
      { status: 400 },
    )
  }

  // 1. Vehicules actifs
  const { data: vehicules, error: vErr } = await supabaseAdmin
    .from("vehicules")
    .select("id_vehicule, immatriculation")
    .eq("statut", "ACTIF")
    .order("immatriculation")
  if (vErr) return NextResponse.json({ ok: false, error: vErr.message }, { status: 500 })

  // 2. Recettes par vehicule sur la periode (via versement_attribution)
  // Pagination par chunks de 1000 pour eviter la limite Supabase
  const recettesMap = new Map<number, number>()
  let pageFrom = 0
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from("versement_attribution")
      .select("id_vehicule, montant_attribue")
      .gte("jour_exploitation", from)
      .lte("jour_exploitation", to)
      .range(pageFrom, pageFrom + 999)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    if (!data || data.length === 0) break
    for (const a of data) {
      if (a.id_vehicule == null) continue
      recettesMap.set(a.id_vehicule, (recettesMap.get(a.id_vehicule) || 0) + Number(a.montant_attribue || 0))
    }
    if (data.length < 1000) break
    pageFrom += 1000
  }

  // 3. Charges par vehicule sur la periode (operations source='depense_vehicule')
  const chargesMap = new Map<number, number>()
  pageFrom = 0
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from("operations")
      .select("vehicule_id, montant")
      .eq("type", "sortie")
      .eq("source", "depense_vehicule")
      .eq("statut", "valide")
      .not("vehicule_id", "is", null)
      .gte("date_operation", from)
      .lte("date_operation", to)
      .range(pageFrom, pageFrom + 999)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    if (!data || data.length === 0) break
    for (const o of data) {
      if (o.vehicule_id == null) continue
      chargesMap.set(o.vehicule_id, (chargesMap.get(o.vehicule_id) || 0) + Number(o.montant || 0))
    }
    if (data.length < 1000) break
    pageFrom += 1000
  }

  // 4. Assemblage + tri par marge nette desc
  const rows: MargeVehiculeRow[] = (vehicules || []).map(v => {
    const recettes = recettesMap.get(v.id_vehicule) || 0
    const charges  = chargesMap.get(v.id_vehicule)  || 0
    return {
      id_vehicule:     v.id_vehicule,
      immatriculation: v.immatriculation ?? "?",
      recettes:        Math.round(recettes),
      charges:         Math.round(charges),
      marge:           Math.round(recettes - charges),
    }
  })
  rows.sort((a, b) => b.marge - a.marge)

  return NextResponse.json({
    ok:     true,
    periode: { from, to },
    rows,
  })
}
