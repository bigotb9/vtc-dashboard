import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabaseClient"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { requirePermission } from "@/lib/requirePermission"
import { calculLoyerNet } from "@/lib/clients/calculLoyerNet"

// ── Types ─────────────────────────────────────────────────────────────────────
type VehiculeRow = {
  id_vehicule: number
  immatriculation: string
  montant_mensuel_client: number
  sous_gestion: boolean
  id_client: number
  // Lot M (audit 27/05/2026) : valeur_acquisition_client recuperee ici pour
  // eviter un 2e SELECT vehicules sur le meme dataset.
  valeur_acquisition_client?: number | null
}

type RecetteRow = {
  immatriculation?: string
  Horodatage?: string
  [key: string]: unknown
}

type DepenseRow = {
  montant:        number
  date_depense:   string
  // Lot U (audit 27/05/2026) : type_depense charge pour filtrer les reversements
  // lors du calcul du loyer net (fix finding 1.1 — page Clients incluait
  // les reversements dans total_depenses, divergence avec PDF Releve).
  type_depense?: string | null
}

type ClientRow = {
  id: number
  nom: string
  telephone?: string | null
  email?: string | null
  notes?: string | null
  actif?: boolean
  tiers_id?: string | null
  created_at?: string
}

// ── GET /api/clients?mois=2026-03&statut=actifs|inactifs|tous ────────────────
// Patch 24/05/2026 (v3) :
//   - param `?statut=actifs|inactifs|tous` (defaut: actifs) - semantique EXCLUSIVE
//   - retro-compat : ?inactifs=true => statut=inactifs (mappe ancienne API)
//   - fix calcul retards (filtre par mois de creation du Client)
//   - utilise supabaseAdmin pour versements_clients (bypass RLS auth requise)
//   - coercition Number sur les ids pour eviter mismatch type string/number
export async function GET(req: NextRequest) {
  try {
    const auth = await requirePermission(req, "manage_clients")
    if (!auth.ok) return auth.response

    const mois = req.nextUrl.searchParams.get("mois") || new Date().toISOString().slice(0, 7)

    // Bug 1 v2 (24/05/2026) : nouveau parametre statut (exclusif).
    // Retro-compat avec l'ancien ?inactifs=true (additif).
    const statutParam = req.nextUrl.searchParams.get("statut")
    const inactifsLegacy = req.nextUrl.searchParams.get("inactifs") === "true"
    let statutFilter: "actifs" | "inactifs" | "tous" = "actifs"
    if (statutParam === "inactifs" || statutParam === "tous") {
      statutFilter = statutParam
    } else if (statutParam === "actifs") {
      statutFilter = "actifs"
    } else if (inactifsLegacy) {
      statutFilter = "inactifs"  // retro-compat
    }

    const [year, month] = mois.split("-").map(Number)
    const dateFrom = `${mois}-01`
    const dateTo   = new Date(year, month, 1).toISOString().slice(0, 10)

    let clientQ = supabase.from("clients").select("*").order("nom")
    if (statutFilter === "actifs")   clientQ = clientQ.eq("actif", true)
    if (statutFilter === "inactifs") clientQ = clientQ.eq("actif", false)
    // "tous" : pas de filtre

    // ── Lot M (audit 27/05/2026) : 4 SELECT indépendants en parallèle ─────
    // Auparavant : clients → vehicules → recettes → depenses séquentiels
    // (~4 round-trips série). Aucun de ces SELECT ne dépend des autres
    // (recettes/depenses utilisent dateFrom/dateTo connus avant tout fetch).
    // Le SELECT vehicules récupère désormais aussi `valeur_acquisition_client`
    // pour éliminer le 2e SELECT vehicules (l. 230-234 historique).
    const [
      clientsRes,
      vehiculesRes,
      recettesRes,
      depensesRes,
    ] = await Promise.all([
      clientQ,
      supabase
        .from("vehicules")
        .select("id_vehicule, immatriculation, montant_mensuel_client, sous_gestion, id_client, valeur_acquisition_client")
        .eq("sous_gestion", true),
      supabase
        .from("vue_recettes_vehicules")
        .select(`immatriculation, "Montant net", Horodatage`)
        .gte("Horodatage", dateFrom)
        .lt("Horodatage",  dateTo),
      supabase
        .from("depenses_vehicules")
        // Lot U (audit 27/05/2026) : ajout type_depense pour filtrer
        // les reversements dans calculLoyerNet (fix finding 1.1).
        .select("id_vehicule, montant, date_depense, type_depense")
        .gte("date_depense", dateFrom)
        .lt("date_depense",  dateTo),
    ])

    if (clientsRes.error) return NextResponse.json({ ok: false, error: clientsRes.error.message }, { status: 500 })
    if (vehiculesRes.error) return NextResponse.json({ ok: false, error: vehiculesRes.error.message }, { status: 500 })

    const clients      = (clientsRes.data   ?? []) as ClientRow[]
    const vehicules    = (vehiculesRes.data ?? []) as VehiculeRow[]
    const recettesData = (recettesRes.data  ?? []) as RecetteRow[]
    const depenses     = (depensesRes.data  ?? []) as (DepenseRow & { id_vehicule: number })[]

    function getRevenu(immat: string): number {
      return recettesData
        .filter(r => (r.immatriculation || "").toLowerCase() === immat.toLowerCase())
        .reduce((s, r) => s + Number((r as Record<string, unknown>)["Montant net"] || 0), 0)
    }

    /** Lot U (audit 27/05/2026) : retourne les dépenses brutes du véhicule.
     *  Le filtre reversement est appliqué par calculLoyerNet (helper unique). */
    function getDepensesBrutes(idVehicule: number): DepenseRow[] {
      return depenses.filter(d => d.id_vehicule === idVehicule)
    }

    const clientsAvecData = clients.map(client => {
      const vehsClient = vehicules.filter(v => v.id_client === client.id)

      const vehDetails = vehsClient.map(v => {
        const revenu         = getRevenu(v.immatriculation)
        const depensesBrutes = getDepensesBrutes(v.id_vehicule)
        const montantMensuel = Number(v.montant_mensuel_client || 0)
        // Lot U : calcul centralisé. `depensesIncluses` exclut les reversements
        // (fix finding 1.1 : page Clients vs PDF Relevé divergeaient).
        const { loyerNet, depensesIncluses, surplus, chargeBoyah } = calculLoyerNet(
          montantMensuel, depensesBrutes,
        )
        const profitBoyah = revenu - loyerNet - chargeBoyah

        return {
          id_vehicule:            v.id_vehicule,
          immatriculation:        v.immatriculation,
          montant_mensuel_client: montantMensuel,
          revenu,
          total_depenses:         depensesIncluses,
          boyah_support:          chargeBoyah,
          surplus_depense:        surplus,
          net_client:             loyerNet,
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

    const global = clientsAvecData.reduce((acc, c) => ({
      revenu:        acc.revenu        + c.totaux.revenu,
      boyah_support: acc.boyah_support + c.totaux.boyah_support,
      net_client:    acc.net_client    + c.totaux.net_client,
      profit_boyah:  acc.profit_boyah  + c.totaux.profit_boyah,
    }), { revenu: 0, boyah_support: 0, net_client: 0, profit_boyah: 0 })

    let beneficeMap = new Map<number, { benefice_total: number; nb_mois: number; premier_mois: string | null; dernier_mois: string | null }>()
    try {
      const { calculBeneficeCumuleByClient } = await import("@/lib/clients/calculBeneficeCumule")
      beneficeMap = await calculBeneficeCumuleByClient(clients.map(c => Number(c.id)))
    } catch (e) {
      console.error("[clients] calcul benefice cumule echoue (non bloquant) :", e)
    }

    const today = new Date()
    const todayYear = today.getFullYear()
    const todayMonth = today.getMonth()

    const mois12: string[] = []
    for (let i = 1; i <= 12; i++) {
      const d = new Date(todayYear, todayMonth - i, 1)
      mois12.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    }

    const clientIds = clients.map(c => Number(c.id))

    // Note : on utilise supabaseAdmin pour bypass la RLS de versements_clients
    // (la policy authenticated_all_versements requiert un user authentifie, 
    // ce qui n'est pas le cas dans cet endpoint server-side)
    const { data: versementsRecents } = await supabaseAdmin
      .from("versements_clients")
      .select("id_client, mois")
      .in("id_client", clientIds)
      .in("mois", mois12)

    const versementsByClient = new Map<number, Set<string>>()
    for (const v of (versementsRecents || []) as Array<{ id_client: number | string; mois: string }>) {
      const cid = Number(v.id_client)
      if (!versementsByClient.has(cid)) versementsByClient.set(cid, new Set())
      versementsByClient.get(cid)!.add(String(v.mois).trim())
    }

    const retardsByClient = new Map<number, number>()

    for (const c of clients) {
      const cid = Number(c.id)
      const verses = versementsByClient.get(cid) || new Set<string>()

      const createdAt = c.created_at ? new Date(c.created_at) : new Date(todayYear, todayMonth - 12, 1)
      const createdMonth = createdAt.getMonth()
      const createdYear = createdAt.getFullYear()

      const aDesVehicules = vehicules.some(v => Number(v.id_client) === cid)
      if (!aDesVehicules) {
        retardsByClient.set(cid, 0)
        continue
      }

      let n = 0
      for (const ym of mois12) {
        const [y, m] = ym.split("-").map(Number)

        // Skip si ce mois est anterieur au mois de creation du Client
        if (y < createdYear || (y === createdYear && (m - 1) < createdMonth)) continue

        // Date limite : 10 du mois suivant
        const jour10Next = new Date(y, m, 10, 23, 59, 59)
        if (today <= jour10Next) continue

        // Compter comme retard si pas de versement enregistre
        if (!verses.has(ym)) n++
      }

      retardsByClient.set(cid, n)
    }

    // Lot M (audit 27/05/2026) : capital géré calculé en mémoire depuis
    // `vehicules` déjà chargé en Promise.all (auparavant 2e SELECT vehicules
    // identique sauf `.in("id_client", clientIds)` qui est de toute facon
    // redondant car le lookup via Map filtre par id_client connu).
    const clientIdsSet = new Set(clientIds)
    const capitalByClient = new Map<number, number>()
    for (const v of vehicules) {
      const cid = Number(v.id_client)
      if (!clientIdsSet.has(cid)) continue
      const cur = capitalByClient.get(cid) || 0
      capitalByClient.set(cid, cur + Number(v.valeur_acquisition_client || 0))
    }

    const clientsEnrichis = clientsAvecData.map(c => {
      const cid = Number(c.id)
      return {
        ...c,
        benefice_cumule:   beneficeMap.get(cid)?.benefice_total ?? 0,
        benefice_nb_mois:  beneficeMap.get(cid)?.nb_mois ?? 0,
        retards_count:     retardsByClient.get(cid) ?? 0,
        capital_gere:      capitalByClient.get(cid) ?? 0,
        actif:             (c as { actif?: boolean }).actif !== false,
      }
    })

    clientsEnrichis.sort((a, b) => {
      if (a.retards_count !== b.retards_count) return b.retards_count - a.retards_count
      return (a.nom || "").localeCompare(b.nom || "")
    })

    const totalCapital = [...capitalByClient.values()].reduce((s, v) => s + v, 0)
    const totalRetards = [...retardsByClient.values()].reduce((s, v) => s + v, 0)
    const globalEnrichi = {
      ...global,
      capital_gere:    totalCapital,
      clients_actifs:  clientsEnrichis.filter(c => c.actif).length,
      retards_total:   totalRetards,
    }

    return NextResponse.json({ ok: true, clients: clientsEnrichis, global: globalEnrichi, mois })
  } catch (err) {
    console.error("Erreur API clients:", err)
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePermission(req, "manage_clients")
    if (!auth.ok) return auth.response

    const body = await req.json()
    const { error, data: client } = await supabase
      .from("clients")
      .insert([{ nom: body.nom, telephone: body.telephone, email: body.email, notes: body.notes }])
      .select()
      .single()

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })

    try {
      let suffix = (client.nom || "")
        .replace(/\s+/g, "")
        .slice(0, 2)
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
      if (suffix.length < 2) suffix = "CL"

      let finalSuffix = suffix
      let attempt = 0
      for (;;) {
        const { data: existing } = await supabaseAdmin
          .from("tiers")
          .select("id")
          .eq("compte_syscohada_parent", "411")
          .eq("compte_syscohada_suffix", finalSuffix)
          .maybeSingle()
        if (!existing) break
        attempt += 1
        if (attempt > 99) break
        finalSuffix = suffix + attempt.toString()
      }

      const { data: tiers } = await supabaseAdmin
        .from("tiers")
        .insert({
          nom:                      client.nom,
          type:                     "client",
          telephone:                client.telephone,
          email:                    client.email,
          compte_syscohada_parent:  "411",
          compte_syscohada_suffix:  finalSuffix,
          actif:                    true,
          notes:                    `Tiers cree automatiquement par /api/clients (client_id=${client.id}).`,
        })
        .select("id")
        .single()

      if (tiers?.id) {
        await supabaseAdmin
          .from("clients")
          .update({ tiers_id: tiers.id })
          .eq("id", client.id)
      }
    } catch (cascadeErr) {
      console.error("[clients] Cascade tiers echouee (non bloquant) :", cascadeErr)
    }

    return NextResponse.json({ ok: true, client })
  } catch {
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 })
  }
}