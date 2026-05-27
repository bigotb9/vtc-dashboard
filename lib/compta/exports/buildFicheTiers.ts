/**
 * Builder de la fiche tiers PDF (Phase 4.x Vague 2 §4.4).
 *
 * Données agrégées pour le template HTML :
 *   - Identité + entreprise + comptabilité
 *   - Historique des opérations sur la période
 *   - Sous-totaux entrées / sorties / net
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"
import type { TiersType } from "@/types/compta-ui"

export interface FicheTiersOperation {
  id:             string
  date_operation: string
  type:           "entree" | "sortie"
  montant:        number
  libelle:        string
  ref:            string | null              // référence externe ou numéro écriture
  categorie:      string | null
  caisse:         string | null              // libellé caisse OU compte
  /** Phase 4.x Vague 3 — nombre de justificatifs actifs. */
  justificatifs_count: number
}

/** Phase 4.x Vague 3 — ligne dans l'annexe "Justificatifs joints". */
export interface FicheTiersJustificatif {
  id:             string
  operation_id:   string
  operation_date: string
  operation_libelle: string
  operation_montant: number
  operation_type: "entree" | "sortie"
  filename:       string
  mime_type:      string
  uploaded_at:    string
}

export interface FicheTiersData {
  tiers: {
    id:                    string
    nom:                   string
    type:                  TiersType
    type_label:            string            // "Fournisseur", "Client", "Salarié", "Autre"
    telephone:             string | null
    email:                 string | null
    adresse:               string | null
    raison_sociale:        string | null
    numero_rccm:           string | null
    numero_contribuable:   string | null
    compte_syscohada_code: string
    notes:                 string | null
    actif:                 boolean
  }
  periode:        { date_from: string; date_to: string }
  operations:     FicheTiersOperation[]
  totals:         { entrees: number; sorties: number; net: number; nb_ops: number }
  /** Phase 4.x Vague 3 — annexe justificatifs joints. */
  justificatifs:  FicheTiersJustificatif[]
  generated_at:   string
}

const TYPE_LABEL: Record<TiersType, string> = {
  client:      "Client",
  fournisseur: "Fournisseur",
  salarie:     "Salarié",
  autre:       "Autre",
}

export async function buildFicheTiers(
  tiersId:  string,
  dateFrom: string,
  dateTo:   string,
): Promise<FicheTiersData | null> {
  // 1. Charger le tiers
  const { data: t, error: tErr } = await supabaseAdmin
    .from("tiers")
    .select(`
      id, nom, type, telephone, email, adresse,
      raison_sociale, numero_rccm, numero_contribuable,
      compte_syscohada_code, notes, actif
    `)
    .eq("id", tiersId)
    .maybeSingle()
  if (tErr) throw tErr
  if (!t) return null

  // 2. Charger les opérations liées sur la période
  const { data: ops, error: oErr } = await supabaseAdmin
    .from("operations")
    .select(`
      id, date_operation, type, montant, libelle, reference_externe, statut,
      caisse:caisse_id ( libelle ),
      compte:compte_id ( libelle ),
      categorie:categorie_id ( libelle ),
      ecriture:ecriture_id ( numero )
    `)
    .eq("tiers_id", tiersId)
    .eq("statut",   "valide")
    .gte("date_operation", dateFrom)
    .lte("date_operation", dateTo)
    .order("date_operation", { ascending: true })
  if (oErr) throw oErr

  type OpRow = {
    id: string
    date_operation: string
    type: "entree" | "sortie"
    montant: number | string
    libelle: string
    reference_externe: string | null
    caisse:    { libelle: string }            | null
    compte:    { libelle: string }            | null
    categorie: { libelle: string }            | null
    ecriture:  { numero: string }             | null
  }
  const opIds = (ops ?? []).map(r => (r as unknown as { id: string }).id)

  // Phase 4.x Vague 3 — compteurs justificatifs en bulk
  const justifCount = new Map<string, number>()
  if (opIds.length > 0) {
    const { data: jc } = await supabaseAdmin
      .from("justificatifs")
      .select("operation_id")
      .in("operation_id", opIds)
      .is("deleted_at", null)
    for (const r of (jc ?? []) as Array<{ operation_id: string }>) {
      justifCount.set(r.operation_id, (justifCount.get(r.operation_id) ?? 0) + 1)
    }
  }

  const list: FicheTiersOperation[] = (ops ?? []).map(r => {
    const row = r as unknown as OpRow
    return {
      id:                  row.id,
      date_operation:      row.date_operation,
      type:                row.type,
      montant:             Number(row.montant),
      libelle:             row.libelle,
      ref:                 row.reference_externe ?? row.ecriture?.numero ?? null,
      categorie:           row.categorie?.libelle ?? null,
      caisse:              row.caisse?.libelle ?? row.compte?.libelle ?? null,
      justificatifs_count: justifCount.get(row.id) ?? 0,
    }
  })

  // 3. Totaux signés
  let entrees = 0, sorties = 0
  for (const op of list) {
    if (op.type === "entree") entrees += op.montant
    else                       sorties += op.montant
  }

  // Phase 4.x Vague 3 — annexe justificatifs joints
  let justificatifs: FicheTiersJustificatif[] = []
  if (opIds.length > 0) {
    const { data: jx } = await supabaseAdmin
      .from("justificatifs")
      .select("id, operation_id, filename, mime_type, uploaded_at")
      .in("operation_id", opIds)
      .is("deleted_at", null)
      .order("uploaded_at", { ascending: true })
    const opMap = new Map<string, FicheTiersOperation>()
    for (const o of list) opMap.set(o.id, o)
    justificatifs = ((jx ?? []) as Array<{
      id: string; operation_id: string; filename: string; mime_type: string; uploaded_at: string
    }>).flatMap(r => {
      const op = opMap.get(r.operation_id)
      if (!op) return []
      return [{
        id:                r.id,
        operation_id:      r.operation_id,
        operation_date:    op.date_operation,
        operation_libelle: op.libelle,
        operation_montant: op.montant,
        operation_type:    op.type,
        filename:          r.filename,
        mime_type:         r.mime_type,
        uploaded_at:       r.uploaded_at,
      }]
    })
    // Tri annexe : date opération desc
    justificatifs.sort((a, b) => b.operation_date.localeCompare(a.operation_date))
  }

  return {
    tiers: {
      id:                    t.id,
      nom:                   t.nom,
      type:                  t.type as TiersType,
      type_label:            TYPE_LABEL[t.type as TiersType],
      telephone:             t.telephone,
      email:                 t.email,
      adresse:               t.adresse,
      raison_sociale:        t.raison_sociale,
      numero_rccm:           t.numero_rccm,
      numero_contribuable:   t.numero_contribuable,
      compte_syscohada_code: t.compte_syscohada_code,
      notes:                 t.notes,
      actif:                 !!t.actif,
    },
    periode:       { date_from: dateFrom, date_to: dateTo },
    operations:    list,
    totals: {
      entrees,
      sorties,
      net:    entrees - sorties,
      nb_ops: list.length,
    },
    justificatifs,
    generated_at: new Date().toISOString(),
  }
}
