/**
 * components/cockpit/types.ts
 *
 * Types partagés entre les composants du Cockpit Boyah (Étape 2/3).
 * Reflète strictement les payloads des routes /api/cockpit/*.
 */

// ─── KPIs ─────────────────────────────────────────────────────────────────
export type Kpis = {
  cashflow_jour: {
    value:    number
    recettes: number
    depenses: number
  }
  activite_flotte: {
    courses_jour:  number
    objectif_jour: number
    pourcentage:   number
  }
  vehicules_retard: {
    count:                  number
    montant_du_total:       number
    chauffeurs_a_contacter: number
  }
  dette_clients: {
    montant_total: number
    jours_horizon: number | null
  }
}

// ─── Alertes ──────────────────────────────────────────────────────────────
// Note 01/06/2026 : "marge_baisse" retirée — la marge est une donnée sensible,
// déplacée vers /api/cockpit/finances (gardée par view_finances_cockpit).
export type AlerteNiveau  = "critique" | "attention" | "positive"
export type AlerteType    = "retard_vehicule" | "caisse_negative" | "top_performer"
export type AlerteActionType = "whatsapp" | "voir" | "fait"

export type AlerteContact = {
  nom:    string
  numero: string
}

export type AlerteAction = {
  label:    string
  type:     AlerteActionType
  href?:    string
  contacts?: AlerteContact[]
}

export type Alerte = {
  id:      string
  niveau:  AlerteNiveau
  titre:   string
  meta:    string
  type:    AlerteType
  actions: AlerteAction[]
}

// ─── Conversations ────────────────────────────────────────────────────────
export type ConversationType = "retard_chauffeur" | "retard_client" | "felicitation"

export type Conversation = {
  id:        string
  type:      ConversationType
  titre:     string
  meta:      string
  message:   string
  contacts:  AlerteContact[]
}

// ─── Todos ────────────────────────────────────────────────────────────────
export type Todo = {
  id:         string
  texte:      string
  done:       boolean
  created_by: string | null
  created_at: string
  done_at:    string | null
  done_by:    string | null
}

// ─── Flotte ───────────────────────────────────────────────────────────────
export type FlotteVehicule = {
  id_vehicule:     number
  immatriculation: string
  statut:          "a_jour" | "retard" | "pause"
  meta_principale: string
}

export type FlotteResume = {
  total:        number
  a_jour:       number
  retard:       number
  pause:        number
  courses_jour: number
  cash_net:     number
}

export type FlottePayload = {
  vehicules: FlotteVehicule[]
  resume:    FlotteResume
}

// ─── Finances Cockpit (route /api/cockpit/finances, gardée par ──────────────
//     view_finances_cockpit — données sensibles) ────────────────────────────
export type FinanceDeficitaire = {
  id_vehicule:        number
  immatriculation:    string
  client:             string
  recettes:           number
  loyer_net:          number
  depenses_absorbees: number
  resultat:           number          // < 0 : ce véhicule client coûte ce mois
}

export type CockpitFinances = {
  marge_mois: {
    mois:            string           // 'YYYY-MM' (mois courant)
    marge_reelle:    number
    total_consolide: number
  }
  marge_prec: {
    mois:         string              // 'YYYY-MM' (mois précédent)
    marge_reelle: number
  }
  variation_pct:  number | null       // null si marge précédente <= 0
  marge_en_baisse: boolean
  loyers_dus_ce_mois:    number        // = helper bloc2.loyers_nets_a_verser (le DÛ)
  verses_ce_mois:        number        // = Σ versements_clients WHERE mois = courant
  arriere_mois_courant:  number        // = max(0, dus - versés)
  deficitaires:   FinanceDeficitaire[] // trié par résultat croissant (pire en tête)
  avertissements: string[]
}
