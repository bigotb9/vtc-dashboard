/**
 * Constantes partagées du Plan comptable SYSCOHADA (Écran 10).
 *  - Titres + descriptions par classe
 *  - Couleurs par classe (référence SYSCOHADA)
 */

export type SyscoClasse = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export const CLASSE_TITLES: Record<SyscoClasse, { title: string; desc: string }> = {
  1: { title: "Comptes de ressources durables", desc: "Capitaux propres, emprunts, dettes financières" },
  2: { title: "Comptes d'immobilisations",      desc: "Immobilisations incorporelles, corporelles, financières" },
  3: { title: "Comptes de stocks",              desc: "Marchandises, matières premières, produits finis" },
  4: { title: "Comptes de tiers",               desc: "Fournisseurs, clients, personnel, État, associés" },
  5: { title: "Comptes de trésorerie",          desc: "Banques, établissements financiers, caisses" },
  6: { title: "Comptes de charges",             desc: "Achats consommés, services extérieurs, personnel" },
  7: { title: "Comptes de produits",            desc: "Ventes, prestations de services, autres produits" },
  8: { title: "Autres charges/produits",        desc: "Hors activité ordinaire, profits/pertes exceptionnels" },
  9: { title: "Comptabilité analytique",        desc: "Comptes réfléchis, charges et produits par destination" },
}

/** Palette de couleurs par classe — référence SYSCOHADA. */
export const CLASSE_COLORS: Record<SyscoClasse, {
  bg:     string  // background pour pastille
  text:   string  // couleur du texte sur fond clair
  ring:   string  // ring d'accent
}> = {
  1: { bg: "bg-indigo-300/30 dark:bg-indigo-500/15",   text: "text-indigo-700 dark:text-indigo-300",   ring: "ring-indigo-400/30" },
  2: { bg: "bg-violet-300/30 dark:bg-violet-500/15",   text: "text-violet-700 dark:text-violet-300",   ring: "ring-violet-400/30" },
  3: { bg: "bg-fuchsia-300/30 dark:bg-fuchsia-500/15", text: "text-fuchsia-700 dark:text-fuchsia-300", ring: "ring-fuchsia-400/30" },
  4: { bg: "bg-pink-300/30 dark:bg-pink-500/15",       text: "text-pink-700 dark:text-pink-300",       ring: "ring-pink-400/30" },
  5: { bg: "bg-cyan-300/30 dark:bg-cyan-500/15",       text: "text-cyan-700 dark:text-cyan-300",       ring: "ring-cyan-400/30" },
  6: { bg: "bg-red-300/30 dark:bg-red-500/15",         text: "text-red-700 dark:text-red-300",         ring: "ring-red-400/30" },
  7: { bg: "bg-emerald-300/30 dark:bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-300", ring: "ring-emerald-400/30" },
  8: { bg: "bg-amber-300/30 dark:bg-amber-500/15",     text: "text-amber-700 dark:text-amber-300",     ring: "ring-amber-400/30" },
  9: { bg: "bg-gray-300/40 dark:bg-white/[0.10]",      text: "text-gray-700 dark:text-gray-300",       ring: "ring-gray-400/30" },
}

export const ALL_CLASSES: SyscoClasse[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]
