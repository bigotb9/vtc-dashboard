import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"

// ── Types ─────────────────────────────────────────────────────────────────────
type VehiculeRow = {
  id_vehicule: number
  immatriculation: string
  montant_mensuel_client: number
  sous_gestion: boolean
  id_client: number
}

type RecetteRow = {
  immatriculation?: string
  Horodatage?: string
  [key: string]: unknown
}

type DepenseRow = {
  montant: number
  date_depense: string
}

const BOYAH_EXPENSE_CAP = 50_000

// ── GET /api/clients?mois=2026-03 ────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const mois = req.nextUrl.searchParams.get("mois") || new Date().toISOString().slice(0, 7)
    const [year, month] = mois.split("-").map(Number)
    const dateFrom = `${mois}-01`
    const dateTo   = new Date(year, month, 1).toISOString().slice(0, 10) // first day of next month

    // ── 1. Tous les clients ───────────────────────────────────────────────────
    const { data: clientsRaw, error: errClients } = await supabase
      .from("clients")
      .select("*")
      .order("nom")

    if (errClients) return NextResponse.json({ ok: false, error: errClients.message }, { status: 500 })

    // ── 2. Véhicules sous gestion ─────────────────────────────────────────────
    const { data: vehiculesRaw, error: errVeh } = await supabase
      .from("vehicules")
      .select("id_vehicule, immatriculation, montant_mensuel_client, sous_gestion, id_client")
      .eq("sous_gestion", true)

    if (errVeh) return NextResponse.json({ ok: false, error: errVeh.message }, { status: 500 })

    const vehicules = (vehiculesRaw ?? []) as VehiculeRow[]

    // ── 3. Revenus du mois (vue_recettes_vehicules) ───────────────────────────
    const { data: recettesRaw } = await supabase
      .from("vue_recettes_vehicules")
      .select(`immatriculation, "Montant net", Horodatage`)
      .gte("Horodatage", dateFrom)
      .lt("Horodatage",  dateTo)

    const recettesData: RecetteRow[] = (recettesRaw ?? []) as RecetteRow[]

    // ── 4. Dépenses du mois ───────────────────────────────────────────────────
    const { data: depensesRaw } = await supabase
      .from("depenses_vehicules")
      .select("id_vehicule, montant, date_depense")
      .gte("date_depense", dateFrom)
      .lt("date_depense",  dateTo)

    const depenses = (depensesRaw ?? []) as (DepenseRow & { id_vehicule: number })[]

    // ── 5. Calculs par véhicule ───────────────────────────────────────────────
    function getRevenu(immat: string): number {
      return recettesData
        .filter(r => (r.immatriculation || "").toLowerCase() === immat.toLowerCase())
        .reduce((s, r) => s + Number((r as Record<string, unknown>)["Montant net"] || 0), 0)
    }

    function getDepenses(idVehicule: number): number {
      return depenses
        .filter(d => d.id_vehicule === idVehicule)
        .reduce((s, d) => s + Number(d.montant || 0), 0)
    }

    // ── 6. Agréger par client ─────────────────────────────────────────────────
    const clientsAvecData = (clientsRaw ?? []).map(client => {
      const vehsClient = vehicules.filter(v => v.id_client === client.id)

      const vehDetails = vehsClient.map(v => {
        const revenu              = getRevenu(v.immatriculation)
        const totalDepenses       = getDepenses(v.id_vehicule)
        const boyahSupport        = Math.min(totalDepenses, BOYAH_EXPENSE_CAP)
        const surplusDepense      = Math.max(0, totalDepenses - BOYAH_EXPENSE_CAP)
        const montantMensuel      = Number(v.montant_mensuel_client || 0)
        const netClient           = Math.max(0, montantMensuel - surplusDepense)
        const profitBoyah         = revenu - netClient - boyahSupport

        return {
          id_vehicule:            v.id_vehicule,
          immatriculation:        v.immatriculation,
          montant_mensuel_client: montantMensuel,
          revenu,
          total_depenses:         totalDepenses,
          boyah_support:          boyahSupport,
          surplus_depense:        surplusDepense,
          net_client:             netClient,
          profit_boyah:           profitBoyah,
        }
      })

      const totaux = vehDetails.reduce((acc, v) => ({
        revenu:         acc.revenu         + v.revenu,
        total_depenses: acc.total_depenses + v.total_depenses,
        boyah_support:  acc.boyah_support  + v.boyah_support,
        net_client:     acc.net_client     + v.net_client,
        profit_boyah:   acc.profit_boyah   + v.profit_boyah,
      }), { revenu: 0, total_depenses: 0, boyah_support: 0, net_client: 0, profit_boyah: 0 })

      return { ...client, vehicules: vehDetails, totaux }
    })

    // Totaux globaux
    const global = clientsAvecData.reduce((acc, c) => ({
      revenu:        acc.revenu        + c.totaux.revenu,
      boyah_support: acc.boyah_support + c.totaux.boyah_support,
      net_client:    acc.net_client    + c.totaux.net_client,
      profit_boyah:  acc.profit_boyah  + c.totaux.profit_boyah,
    }), { revenu: 0, boyah_support: 0, net_client: 0, profit_boyah: 0 })

    return NextResponse.json({ ok: true, clients: clientsAvecData, global, mois })
  } catch (err) {
    console.error("Erreur API clients:", err)
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 })
  }
}

// ── POST /api/clients ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { error, data } = await supabase
      .from("clients")
      .insert([{ nom: body.nom, telephone: body.telephone, email: body.email, notes: body.notes }])
      .select()
      .single()

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true, client: data })
  } catch {
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 })
  }
}
