/**
 * Helpers partagés pour les builders de rapports PDF (Phase 4).
 *
 *  - loadSocieteInfo() : charge les infos société depuis parametres_module_compta
 *  - validatePeriod() : valide les dates YYYY-MM-DD
 */

import { supabaseAdmin } from "@/lib/supabaseAdmin"
import { getLogoSignedUrlForPdf } from "@/lib/compta/parametres/getParametresSociete"
import type { SocieteHeaderData } from "@/lib/pdf/buildHeader"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function validatePeriod(dateFrom: string, dateTo: string): { ok: true } | { ok: false; error: string } {
  if (!DATE_RE.test(dateFrom)) return { ok: false, error: `date_from invalide (attendu YYYY-MM-DD) : ${dateFrom}` }
  if (!DATE_RE.test(dateTo))   return { ok: false, error: `date_to invalide (attendu YYYY-MM-DD) : ${dateTo}` }
  if (dateFrom > dateTo)       return { ok: false, error: "date_from doit être ≤ date_to" }
  return { ok: true }
}

/**
 * Charge les infos société pour le header PDF.
 *
 * Phase 4.2 — Source prioritaire = `societe_parametres` (Module 1), avec
 * fallback sur `parametres_module_compta` (Phase 3 Écran 7) pour la
 * rétrocompatibilité tant que l'utilisateur n'a pas configuré la nouvelle
 * page Paramètres société.
 */
export async function loadSocieteInfo(): Promise<SocieteHeaderData> {
  // 1. Tenter `societe_parametres` (singleton Phase 4.2)
  const { data: nouv } = await supabaseAdmin
    .from("societe_parametres")
    .select("nom_commercial, raison_sociale, adresse, telephone, email, rccm, numero_cc, capital_social, logo_storage_path")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (nouv) {
    const logoSignedUrl = await getLogoSignedUrlForPdf(nouv.logo_storage_path)
    return {
      nom_commercial:      nouv.nom_commercial,
      raison_sociale:      nouv.raison_sociale,
      numero_rccm:         nouv.rccm,
      numero_contribuable: null,
      numero_cc:           nouv.numero_cc,
      capital_social:      nouv.capital_social != null ? Number(nouv.capital_social) : null,
      adresse_fiscale:     nouv.adresse,
      telephone:           nouv.telephone,
      email_comptable:     nouv.email,
      logo_signed_url:     logoSignedUrl,
    }
  }

  // 2. Fallback : `parametres_module_compta` (Phase 3 Écran 7)
  const { data } = await supabaseAdmin
    .from("parametres_module_compta")
    .select("raison_sociale, numero_rccm, numero_contribuable, adresse_fiscale, telephone, email_comptable")
    .eq("id", 1)
    .maybeSingle()
  return {
    raison_sociale:      data?.raison_sociale      ?? null,
    numero_rccm:         data?.numero_rccm         ?? null,
    numero_contribuable: data?.numero_contribuable ?? null,
    adresse_fiscale:     data?.adresse_fiscale     ?? null,
    telephone:           data?.telephone           ?? null,
    email_comptable:     data?.email_comptable     ?? null,
    nom_commercial:      null,
    numero_cc:           null,
    capital_social:      null,
    logo_signed_url:     null,
  }
}
