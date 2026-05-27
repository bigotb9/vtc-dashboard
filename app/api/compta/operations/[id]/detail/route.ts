/**
 * GET /api/compta/operations/[id]/detail
 *
 * Réponse enrichie pour la page de détail (Écran 2 Phase 3).
 * Réservé directeur. Référence : doc Phase 3 Écran 2 §5.1.
 *
 * Inclus dans la réponse :
 *   - operation : objet complet + relations (caisse/compte/categorie/exercice +
 *     vehicule, chauffeur, client) + noms des created_by/valide_par
 *   - ecriture  : si operation.ecriture_id existe → ecriture + lignes (avec
 *     libellé SYSCOHADA résolu) + totaux + flag is_equilibree
 *   - extourne  : si operation.statut=annule → écriture d'extourne associée
 *   - historique : timeline reconstituée (création / validation / écriture
 *     générée / annulation / extourne générée) à partir des timestamps
 *     internes + activity_logs
 */

import type { NextRequest } from "next/server"
import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { requireDirecteurCompta } from "@/lib/compta/auth"
import { comptaError, comptaOk } from "@/lib/compta/errors"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const JOURNAL_LIBELLES: Record<string, string> = {
  BQ: "Banque",
  CA: "Caisse",
  AC: "Achats",
  VE: "Ventes",
  PA: "Paie",
  OD: "Opérations diverses",
}

const SOURCE_LABELS: Record<string, string> = {
  manuel:            "Saisie manuelle",
  recette_wave:      "Reprise automatique Wave",
  depense_vehicule:  "Reprise dépense véhicule",
  versement_client:  "Reprise versement client",
  import_csv:        "Import CSV",
  transfert_interne: "Transfert interne",
  dotation_amort:    "Dotation amortissement",
}

async function resolveUserName(userId: string | null): Promise<string | null> {
  if (!userId) return null
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("name")
    .eq("id", userId)
    .maybeSingle()
  return data?.name ?? null
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const auth = await requireDirecteurCompta(req)
  if (!auth.ok) return auth.response

  const { id } = await ctx.params

  // 1. Charger l'opération avec relations FK
  const { data: opRaw, error: opErr } = await supabaseAdmin
    .from("operations")
    .select(`
      id, date_operation, type, montant, libelle, reference_externe,
      compte_id, caisse_id, categorie_id, tiers_id,
      vehicule_id, chauffeur_id, client_id,
      source, source_ref, statut,
      valide_le, valide_par,
      ecriture_id, exercice_id,
      created_at, created_by, updated_at, updated_by, notes,
      compte:compte_id ( id, libelle, code ),
      caisse:caisse_id ( id, libelle, type, code ),
      categorie:categorie_id ( id, libelle, type ),
      exercice:exercice_id ( id, libelle ),
      tiers:tiers_id ( id, nom, type, compte_syscohada_code, actif )
    `)
    .eq("id", id)
    .maybeSingle()
  if (opErr) return comptaError("DB_ERROR", { hint: opErr.message })
  if (!opRaw) return comptaError("NOT_FOUND")

  // 2. Enrichir véhicule / chauffeur / client (pas de FK formelle)
  const [vehRes, chRes, clRes] = await Promise.all([
    opRaw.vehicule_id != null
      ? supabaseAdmin.from("vehicules").select("id_vehicule, immatriculation").eq("id_vehicule", opRaw.vehicule_id).maybeSingle()
      : Promise.resolve({ data: null }),
    opRaw.chauffeur_id != null
      ? supabaseAdmin.from("chauffeurs").select("id_chauffeur, nom").eq("id_chauffeur", opRaw.chauffeur_id).maybeSingle()
      : Promise.resolve({ data: null }),
    opRaw.client_id != null
      ? supabaseAdmin.from("clients").select("id, nom").eq("id", opRaw.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  // 3. Résoudre noms users (created_by / valide_par)
  const [createdByName, valideParName] = await Promise.all([
    resolveUserName(opRaw.created_by),
    resolveUserName(opRaw.valide_par),
  ])

  // ─── Sections 4 / 5 / 5.b / 6 parallélisées (Lot K audit 26/05/2026) ─────
  // Auparavant 4 blocs séquentiels (écriture → lignes → comptes_syscohada,
  // extourne, transfert jumelle, activity_logs). Tous ces blocs ne dépendent
  // que de `opRaw` déjà chargé → on les lance en parallèle via Promise.all.
  //
  // À l'intérieur de la section 4, les SELECT ecr + lignes sont aussi
  // parallélisés (les 2 ne dépendent que de `opRaw.ecriture_id` connu).

  type EcritureView = {
    id:              string
    numero:          string
    journal_code:    string
    journal_libelle: string
    date_ecriture:   string
    libelle:         string
    statut:          string
    cloture:         boolean
    created_at:      string | null
    valide_le:       string | null
    lignes:          {
      id:                       string
      ordre:                    number
      compte_syscohada_code:    string
      compte_syscohada_libelle: string | null
      libelle_ligne:            string | null
      debit:                    number
      credit:                   number
    }[]
    total_debit:     number
    total_credit:    number
    is_equilibree:   boolean
  }
  type ExtourneInfo = { id: string; numero: string; date_ecriture: string; created_at: string | null }
  type TransfertJumelle = {
    transfert_id:    string
    jumelle_id:      string
    jumelle_type:    "entree" | "sortie"
    jumelle_libelle: string
    montant:         number
    sens:            "depuis" | "vers"
  }
  type ActivityLogRow = {
    action:     string
    details:    Record<string, unknown> | null
    created_at: string
    user_name:  string | null
  }

  const fetchEcriture = async (): Promise<EcritureView | null> => {
    if (!opRaw.ecriture_id) return null
    const [ecrRes, lignesRes] = await Promise.all([
      supabaseAdmin
        .from("ecritures_comptables")
        .select("id, numero, date_ecriture, journal_code, libelle, statut, cloture, created_at, valide_le")
        .eq("id", opRaw.ecriture_id)
        .maybeSingle(),
      supabaseAdmin
        .from("lignes_ecritures")
        .select("id, ordre, compte_syscohada_code, libelle, debit, credit")
        .eq("ecriture_id", opRaw.ecriture_id)
        .order("ordre", { ascending: true }),
    ])
    const ecr = ecrRes.data
    if (!ecr) return null
    const lignesRaw = lignesRes.data
    const codes = Array.from(new Set((lignesRaw ?? []).map(l => l.compte_syscohada_code)))
    const libellesMap = new Map<string, string>()
    if (codes.length > 0) {
      const { data: comptes } = await supabaseAdmin
        .from("comptes_syscohada")
        .select("code, libelle")
        .in("code", codes)
      for (const c of comptes ?? []) libellesMap.set(c.code, c.libelle ?? "")
    }
    const lignes = (lignesRaw ?? []).map(l => ({
      id:                       l.id,
      ordre:                    l.ordre,
      compte_syscohada_code:    l.compte_syscohada_code,
      compte_syscohada_libelle: libellesMap.get(l.compte_syscohada_code) ?? null,
      libelle_ligne:            l.libelle,
      debit:                    Number(l.debit  || 0),
      credit:                   Number(l.credit || 0),
    }))
    const totalDebit  = lignes.reduce((s, l) => s + l.debit,  0)
    const totalCredit = lignes.reduce((s, l) => s + l.credit, 0)
    return {
      id:              ecr.id,
      numero:          ecr.numero,
      journal_code:    ecr.journal_code,
      journal_libelle: JOURNAL_LIBELLES[ecr.journal_code] ?? ecr.journal_code,
      date_ecriture:   ecr.date_ecriture,
      libelle:         ecr.libelle,
      statut:          ecr.statut,
      cloture:         ecr.cloture,
      created_at:      ecr.created_at,
      valide_le:       ecr.valide_le,
      lignes,
      total_debit:     totalDebit,
      total_credit:    totalCredit,
      is_equilibree:   Math.abs(totalDebit - totalCredit) < 0.01,
    }
  }

  const fetchExtourne = async (): Promise<ExtourneInfo | null> => {
    if (opRaw.statut !== "annule" || !opRaw.ecriture_id) return null
    const { data: ex } = await supabaseAdmin
      .from("ecritures_comptables")
      .select("id, numero, date_ecriture, created_at")
      .eq("extourne_de", opRaw.ecriture_id)
      .maybeSingle()
    if (!ex) return null
    return { id: ex.id, numero: ex.numero, date_ecriture: ex.date_ecriture, created_at: ex.created_at }
  }

  const fetchTransfertJumelle = async (): Promise<TransfertJumelle | null> => {
    if (opRaw.source !== "transfert_interne" || !opRaw.source_ref) return null
    const { data: tx } = await supabaseAdmin
      .from("transferts_internes")
      .select(`
        id, montant,
        operation_sortie_id, operation_entree_id,
        source_caisse_id, source_compte_id,
        dest_caisse_id,    dest_compte_id
      `)
      .eq("id", opRaw.source_ref)
      .maybeSingle()
    if (!tx) return null
    const isOursSortie = tx.operation_sortie_id === opRaw.id
    const jumelleId    = isOursSortie ? tx.operation_entree_id : tx.operation_sortie_id
    if (!jumelleId) return null
    const jumelleKind: "entree" | "sortie" = isOursSortie ? "entree" : "sortie"
    const sens: "depuis" | "vers" = isOursSortie ? "vers" : "depuis"
    // Libellé du côté jumelle (caisse/compte) — toujours 1 seul SELECT,
    // pas de gain net à paralléliser au-delà (1 fetch sequentiel ok)
    let jumelleLibelle = "—"
    if (isOursSortie) {
      if (tx.dest_caisse_id) {
        const { data } = await supabaseAdmin.from("caisses").select("libelle").eq("id", tx.dest_caisse_id).maybeSingle()
        jumelleLibelle = data?.libelle ?? "—"
      } else if (tx.dest_compte_id) {
        const { data } = await supabaseAdmin.from("comptes").select("libelle").eq("id", tx.dest_compte_id).maybeSingle()
        jumelleLibelle = data?.libelle ?? "—"
      }
    } else {
      if (tx.source_caisse_id) {
        const { data } = await supabaseAdmin.from("caisses").select("libelle").eq("id", tx.source_caisse_id).maybeSingle()
        jumelleLibelle = data?.libelle ?? "—"
      } else if (tx.source_compte_id) {
        const { data } = await supabaseAdmin.from("comptes").select("libelle").eq("id", tx.source_compte_id).maybeSingle()
        jumelleLibelle = data?.libelle ?? "—"
      }
    }
    return {
      transfert_id:    tx.id,
      jumelle_id:      jumelleId,
      jumelle_type:    jumelleKind,
      jumelle_libelle: jumelleLibelle,
      montant:         Number(tx.montant),
      sens,
    }
  }

  const fetchActivityLogs = async (): Promise<ActivityLogRow[] | null> => {
    const { data } = await supabaseAdmin
      .from("activity_logs")
      .select("action, details, created_at, user_name")
      .eq("entity", id)
      .like("action", "compta.operation.%")
      .order("created_at", { ascending: true })
    return data as ActivityLogRow[] | null
  }

  const [ecriture, extourne, transfertJumelle, logs] = await Promise.all([
    fetchEcriture(),
    fetchExtourne(),
    fetchTransfertJumelle(),
    fetchActivityLogs(),
  ])

  // 7. Construction de la timeline historique
  type HistoryItem = {
    timestamp: string
    type:      string
    title:     string
    detail:    string
    variant:   "success" | "warning" | "danger" | "default"
  }
  const historique: HistoryItem[] = []

  // 7a. Création
  if (opRaw.created_at) {
    historique.push({
      timestamp: opRaw.created_at,
      type:      "creation",
      title:     "Opération créée",
      detail:    `${createdByName ? "par " + createdByName : "Création"} · ${SOURCE_LABELS[opRaw.source] ?? opRaw.source}`,
      variant:   "default",
    })
  }
  // 7b. Validation
  if (opRaw.valide_le) {
    historique.push({
      timestamp: opRaw.valide_le,
      type:      "validation",
      title:     "Validation de l'opération",
      detail:    valideParName ? `par ${valideParName}` : "Auto-validée lors de la reprise",
      variant:   "success",
    })
  }
  // 7c. Écriture comptable générée
  if (ecriture?.created_at) {
    historique.push({
      timestamp: ecriture.created_at,
      type:      "ecriture_generated",
      title:     `Écriture comptable générée (${ecriture.numero})`,
      detail:    "Auto-générée mode Avancé",
      variant:   "success",
    })
  }
  // 7d. Annulation — déduit de l'activity_log si présent, sinon updated_at
  if (opRaw.statut === "annule") {
    const annulationLog = logs?.find(l => l.action === "compta.operation.annuler")
    const annulTs = annulationLog?.created_at ?? opRaw.updated_at
    const raison =
      (annulationLog?.details as Record<string, unknown> | null | undefined)?.raison as string | undefined
    if (annulTs) {
      historique.push({
        timestamp: annulTs,
        type:      "annulation",
        title:     "Opération annulée",
        detail:    [
          annulationLog?.user_name ? `par ${annulationLog.user_name}` : null,
          raison ? `motif : ${raison}` : null,
        ].filter(Boolean).join(" · ") || "Annulation",
        variant:   "danger",
      })
    }
  }
  // 7e. Extourne générée
  if (extourne?.created_at) {
    historique.push({
      timestamp: extourne.created_at,
      type:      "extourne_generated",
      title:     `Extourne générée (${extourne.numero})`,
      detail:    "Inversion débit/crédit de l'écriture d'origine",
      variant:   "warning",
    })
  }

  // Tri chronologique croissant
  historique.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  // 8. Construction de la réponse
  const veh = vehRes.data
    ? { id: vehRes.data.id_vehicule, immatriculation: vehRes.data.immatriculation }
    : null
  const ch = chRes.data
    ? { id: chRes.data.id_chauffeur, nom: chRes.data.nom }
    : null
  const cl = clRes.data
    ? { id: clRes.data.id, nom: clRes.data.nom }
    : null

  return comptaOk({
    operation: {
      id:                opRaw.id,
      date_operation:    opRaw.date_operation,
      type:              opRaw.type,
      montant:           Number(opRaw.montant),
      libelle:           opRaw.libelle,
      reference_externe: opRaw.reference_externe,
      compte:            opRaw.compte    ?? null,
      caisse:            opRaw.caisse    ?? null,
      categorie:         opRaw.categorie ?? null,
      exercice:          opRaw.exercice  ?? null,
      // Phase 4.x Vague 2 — référence tiers (null si pas lié)
      tiers:             opRaw.tiers     ?? null,
      source:            opRaw.source,
      source_label:      SOURCE_LABELS[opRaw.source] ?? opRaw.source,
      source_ref:        opRaw.source_ref,
      statut:            opRaw.statut,
      vehicule:          veh,
      chauffeur:         ch,
      client:            cl,
      ecriture_id:       opRaw.ecriture_id,
      notes:             opRaw.notes,
      created_at:        opRaw.created_at,
      created_by:        opRaw.created_by,
      created_by_name:   createdByName,
      valide_le:         opRaw.valide_le,
      valide_par:        opRaw.valide_par,
      valide_par_name:   valideParName,
      updated_at:        opRaw.updated_at,
    },
    ecriture,
    extourne,
    transfert_jumelle: transfertJumelle,
    historique,
  })
}
