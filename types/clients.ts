/**
 * types/clients.ts
 *
 * Types partages du module Clients (asset management Boyah Group).
 * Extrait du fichier monolithique `app/clients/page.tsx` lors du Lot T
 * (audit 27/05/2026, decoupage du fichier 1349 lignes en composants).
 */

export type VehiculeStat = {
  id_vehicule:            number
  immatriculation:        string
  montant_mensuel_client: number
  revenu:                 number
  total_depenses:         number
  boyah_support:          number
  surplus_depense:        number
  net_client:             number
  profit_boyah:           number
}

export type Versement = {
  id:             number
  id_client:      number
  mois:           string
  montant:        number
  date_versement: string
  notes:          string | null
}

export type Client = {
  id:                number
  nom:               string
  telephone:         string | null
  email:             string | null
  notes:             string | null
  // Refonte 23/05/2026
  actif?:            boolean
  benefice_cumule?:  number
  benefice_nb_mois?: number
  retards_count?:    number
  capital_gere?:     number
  date_creation?:    string
  vehicules:         VehiculeStat[]
  totaux: {
    revenu:         number
    total_depenses: number
    boyah_support:  number
    net_client:     number
    profit_boyah:   number
  }
}

// E1 - Type Document
export type ClientDocument = {
  id:             string
  type:           "contrat" | "cni" | "carte_grise" | "assurance" | "justificatif" | "etat_comptes_sortie" | "autre"
  nom_fichier:    string
  storage_path:   string
  taille:         number
  mime_type:      string
  auto_genere:    boolean
  uploaded_at:    string
  notes:          string | null
  download_url:   string | null
}

export type Global = {
  revenu:          number
  boyah_support:   number
  // Refonte 23/05/2026 (G1)
  capital_gere?:   number
  clients_actifs?: number
  retards_total?:  number
  net_client:      number
  profit_boyah:    number
}

// ── Versement status / fenetre de paiement ──────────────────────────────────
// Les clients sont payés entre le 5 et le 10 du mois SUIVANT l'exploitation.
// Ex : exploitation mars 2026 → versement entre le 5 et le 10 avril 2026.
export type VersementStatus =
  | "deja_verse"    // vert — déjà payé
  | "a_verser"      // orange pulsé — fenêtre ouverte (5-10 du mois suivant)
  | "en_retard"     // rouge — passé le 10 sans paiement
  | "pas_encore_du" // bleu clair — mois terminé mais avant le 5 du suivant
  | "en_cours"      // gris clair — exploitation en cours (pas encore fini)
  | "futur"         // gris foncé — mois non encore commencé

export function getVersementStatus(
  mois: string, today: Date, versement: { id: number } | null,
): VersementStatus {
  if (versement) return "deja_verse"
  const [y, m] = mois.split("-").map(Number)
  const debutMois  = new Date(y, m - 1, 1)
  const finMois    = new Date(y, m, 0, 23, 59, 59)
  const jour5Next  = new Date(y, m, 5)
  const jour10Next = new Date(y, m, 10, 23, 59, 59)

  if (today < debutMois)   return "futur"
  if (today <= finMois)    return "en_cours"
  if (today < jour5Next)   return "pas_encore_du"
  if (today <= jour10Next) return "a_verser"
  return "en_retard"
}

export function fenetrePaiement(mois: string): string {
  const [y, m] = mois.split("-").map(Number)
  const j5  = new Date(y, m, 5)
  const j10 = new Date(y, m, 10)
  return `${j5.toLocaleDateString("fr-FR", { day: "numeric" })}–${j10.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`
}

/** Génère les 12 derniers mois (du plus récent au plus ancien) */
export function derniersMois(n = 12): string[] {
  const mois: string[] = []
  const d = new Date()
  for (let i = 0; i < n; i++) {
    mois.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    d.setMonth(d.getMonth() - 1)
  }
  return mois
}

export const STATUS_CONFIG: Record<VersementStatus, {
  label: string; bg: string; border: string; iconBg: string; text: string; btnVariant: "primary" | "warn" | "danger" | "muted"
}> = {
  deja_verse: {
    label: "Payé", bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-200 dark:border-emerald-500/20",
    iconBg: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400", btnVariant: "muted",
  },
  a_verser: {
    label: "À verser", bg: "bg-amber-50 dark:bg-amber-500/10", border: "border-amber-300 dark:border-amber-500/40",
    iconBg: "bg-amber-500", text: "text-amber-700 dark:text-amber-400", btnVariant: "warn",
  },
  en_retard: {
    label: "En retard", bg: "bg-red-50 dark:bg-red-500/10", border: "border-red-300 dark:border-red-500/40",
    iconBg: "bg-red-500", text: "text-red-700 dark:text-red-400", btnVariant: "danger",
  },
  pas_encore_du: {
    label: "Pas encore dû", bg: "bg-blue-50/50 dark:bg-blue-500/5", border: "border-blue-100 dark:border-blue-500/15",
    iconBg: "bg-blue-400", text: "text-blue-600 dark:text-blue-400", btnVariant: "primary",
  },
  en_cours: {
    label: "Exploitation en cours", bg: "bg-indigo-50/50 dark:bg-indigo-500/5", border: "border-indigo-100 dark:border-indigo-500/15",
    iconBg: "bg-indigo-400", text: "text-indigo-600 dark:text-indigo-400", btnVariant: "muted",
  },
  futur: {
    label: "À venir", bg: "bg-gray-50 dark:bg-white/[0.02]", border: "border-gray-100 dark:border-white/5",
    iconBg: "bg-gray-300 dark:bg-gray-700", text: "text-gray-400 dark:text-gray-600", btnVariant: "muted",
  },
}

// ── Helpers de formatage ─────────────────────────────────────────────────────
export const fmt       = (n: number) => Math.round(n).toLocaleString("fr-FR")
export const sign      = (n: number) => (n >= 0 ? "+" : "") + fmt(n)
export const moisLabel = (m: string) =>
  new Date(m + "-15").toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
