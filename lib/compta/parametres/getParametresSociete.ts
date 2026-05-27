/**
 * Helper : récupérer les paramètres société + signed URL du logo
 * (Phase 4.2 Module 1).
 *
 * Le bucket `logos` étant privé, on génère une signed URL TTL 5 min pour
 * l'affichage UI. Les PDF côté serveur utilisent le path direct via
 * `getLogoSignedUrlForPdf()` avec TTL plus long.
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"
import type { SocieteParametres } from "@/types/compta-ui"

const LOGO_BUCKET = "logos"
const LOGO_SIGNED_TTL_UI  = 5 * 60     // 5 min pour UI
const LOGO_SIGNED_TTL_PDF = 5 * 60     // 5 min pour PDF (génération synchrone)

export async function getSocieteParametres(): Promise<SocieteParametres | null> {
  const { data, error } = await supabaseAdmin
    .from("societe_parametres")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  let logo_signed_url: string | null = null
  if (data.logo_storage_path) {
    const { data: signed } = await supabaseAdmin.storage
      .from(LOGO_BUCKET)
      .createSignedUrl(data.logo_storage_path, LOGO_SIGNED_TTL_UI)
    logo_signed_url = signed?.signedUrl ?? null
  }

  return {
    id:                   data.id,
    nom_commercial:       data.nom_commercial,
    raison_sociale:       data.raison_sociale,
    forme_juridique:      data.forme_juridique,
    adresse:              data.adresse,
    telephone:            data.telephone,
    email:                data.email,
    site_web:             data.site_web,
    rccm:                 data.rccm,
    numero_cc:            data.numero_cc,
    capital_social:       data.capital_social != null ? Number(data.capital_social) : null,
    regime_fiscal:        data.regime_fiscal,
    nif:                  data.nif,
    code_naf:             data.code_naf,
    logo_storage_path:    data.logo_storage_path,
    logo_signed_url,
    exercice_debut_jj_mm: data.exercice_debut_jj_mm,
    exercice_fin_jj_mm:   data.exercice_fin_jj_mm,
    // PHASE 4.3 — Notes annexes
    methodes_comptables:    data.methodes_comptables ?? null,
    engagements_hors_bilan: data.engagements_hors_bilan ?? null,
    methode_amortissement:  (data.methode_amortissement ?? "lineaire") as "lineaire" | "degressif",
    methode_stocks:         (data.methode_stocks        ?? "fifo")     as "fifo" | "cmp" | "lifo",
    created_at:           data.created_at,
    updated_at:           data.updated_at,
  }
}

/** Signed URL spécifique aux PDF (TTL court — génération synchrone). */
export async function getLogoSignedUrlForPdf(path: string | null): Promise<string | null> {
  if (!path) return null
  const { data } = await supabaseAdmin.storage
    .from(LOGO_BUCKET)
    .createSignedUrl(path, LOGO_SIGNED_TTL_PDF)
  return data?.signedUrl ?? null
}
