/**
 * Preview d'une écriture de transfert interne — calcule le résultat SANS
 * rien insérer en base. Utilisé par l'étape 2 du wizard (modal).
 *
 * Logique miroir de la RPC `create_transfert_interne` (lecture seule) :
 *   - Récupère codes SYSCOHADA + libellés source/dest
 *   - Calcule l'exercice qui couvre la date
 *   - Détermine le numéro d'écriture FUTUR (count(OD) + 1 sur l'exercice)
 *   - Compose le libellé final (auto si non fourni)
 *
 * Retourne `null` si une référence est invalide (caisse/compte inexistante,
 * pas d'exercice ouvert).
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"
import type { TransfertPayload, TransfertPreview } from "@/types/compta-ui"

export type PreviewResult =
  | { ok: true;  preview: TransfertPreview }
  | { ok: false; code: "NOT_FOUND" | "ACCOUNT_NO_MAPPING" | "EXERCICE_CLOSED" | "DB_ERROR"; message: string }

export async function buildTransfertPreview(payload: TransfertPayload): Promise<PreviewResult> {
  // ─ 1. Charger source ───────────────────────────────────────────────────────
  const src = await loadOne(payload.source_caisse_id, payload.source_compte_id)
  if (!src) return { ok: false, code: "NOT_FOUND", message: "Source introuvable" }
  if (!src.code) return { ok: false, code: "ACCOUNT_NO_MAPPING", message: "Source sans mapping SYSCOHADA" }

  // ─ 2. Charger destination ──────────────────────────────────────────────────
  const dst = await loadOne(payload.dest_caisse_id, payload.dest_compte_id)
  if (!dst) return { ok: false, code: "NOT_FOUND", message: "Destination introuvable" }
  if (!dst.code) return { ok: false, code: "ACCOUNT_NO_MAPPING", message: "Destination sans mapping SYSCOHADA" }

  // ─ 3. Exercice ouvert ──────────────────────────────────────────────────────
  const { data: ex, error: exErr } = await supabaseAdmin
    .from("exercices")
    .select("id, date_debut, cloture")
    .lte("date_debut", payload.date_transfert)
    .gte("date_fin",   payload.date_transfert)
    .eq("cloture", false)
    .order("date_debut", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (exErr) return { ok: false, code: "DB_ERROR", message: exErr.message }
  if (!ex)   return { ok: false, code: "EXERCICE_CLOSED", message: `Aucun exercice ouvert ne couvre ${payload.date_transfert}` }

  // ─ 4. Numéro futur OD ──────────────────────────────────────────────────────
  const { count, error: cErr } = await supabaseAdmin
    .from("ecritures_comptables")
    .select("*", { count: "exact", head: true })
    .eq("journal_code", "OD")
    .eq("exercice_id",  ex.id)
  if (cErr) return { ok: false, code: "DB_ERROR", message: cErr.message }
  const annee  = new Date(ex.date_debut + "T00:00:00Z").getUTCFullYear()
  const seq    = String((count ?? 0) + 1).padStart(6, "0")
  const numero = `${annee}-OD-${seq}`

  // ─ 5. Libellé final (auto si non fourni) ───────────────────────────────────
  const libelle = (payload.libelle?.trim() ?? "")
    || `Transfert interne : ${src.libelle} → ${dst.libelle}`

  return {
    ok: true,
    preview: {
      numero_ecriture_futur: numero,
      date_ecriture:         payload.date_transfert,
      libelle,
      lignes: [
        { compte_code: dst.code, libelle: dst.libelle, debit: payload.montant, credit: 0 },
        { compte_code: src.code, libelle: src.libelle, debit: 0,               credit: payload.montant },
      ],
      total_debit:  payload.montant,
      total_credit: payload.montant,
      equilibre:    true,
      source: { id: src.id, kind: src.kind, libelle: src.libelle, code: src.code },
      dest:   { id: dst.id, kind: dst.kind, libelle: dst.libelle, code: dst.code },
    },
  }
}

// ── Helper : charge une caisse OU un compte par son id ────────────────────────
async function loadOne(caisseId?: string | null, compteId?: string | null):
  Promise<{ id: string; kind: "caisse" | "compte"; libelle: string; code: string | null } | null>
{
  if (caisseId) {
    const { data } = await supabaseAdmin
      .from("caisses")
      .select("id, libelle, compte_syscohada_code")
      .eq("id", caisseId)
      .maybeSingle()
    if (!data) return null
    return { id: data.id, kind: "caisse", libelle: data.libelle, code: data.compte_syscohada_code }
  }
  if (compteId) {
    const { data } = await supabaseAdmin
      .from("comptes")
      .select("id, libelle, compte_syscohada_code")
      .eq("id", compteId)
      .maybeSingle()
    if (!data) return null
    return { id: data.id, kind: "compte", libelle: data.libelle, code: data.compte_syscohada_code }
  }
  return null
}
