/**
 * lib/finance/loyerEcheance.ts
 *
 * Source de vérité UNIQUE pour le DÉCALAGE DE PAIEMENT des loyers Clients
 * (asset management Boyah Group).
 *
 * Règle métier (validée Emmanuel le 01/06/2026) :
 *   Le loyer d'un mois M est versé au Client entre le 5 et le 10 du mois M+1.
 *   À une date de consultation donnée, l'état d'un loyer du mois M est :
 *     - "futur"      : le mois M n'a même pas commencé
 *     - "en_cours"   : on est dans le mois M (le loyer se constitue encore)
 *     - "a_venir"    : on est dans M+1 mais AVANT le 5 (pas encore exigible)
 *     - "a_verser"   : on est entre le 5 et le 10 de M+1 inclus (exigible)
 *     - "en_retard"  : on est après le 10 de M+1 et le loyer n'est pas soldé
 *     - "deja_verse" : le loyer a été soldé (versement enregistré couvrant le dû)
 *
 *   À toute date, le « loyer à traiter » est celui du mois PRÉCÉDENT (M−1).
 *   Exemple au 1er juin : le loyer de mai est "a_venir" (versé entre le 5 et
 *   le 10 juin) ; les loyers d'avril et antérieurs non soldés sont "en_retard" ;
 *   le loyer de juin n'est pas concerné (il sera versé en juillet).
 *
 * Convention temporelle : Abidjan = UTC+0 (pas de DST). On raisonne donc
 * entièrement en UTC (Date.UTC / getUTC*) pour éviter tout off-by-one aux
 * bornes de mois selon le fuseau du serveur.
 *
 * Sémantique BD rappelée : versements_clients.mois = la PÉRIODE du loyer (M),
 * PAS le mois de paiement (M+1). date_versement = la date réelle de paiement.
 */

export type LoyerEtat =
  | "futur"
  | "en_cours"
  | "a_venir"
  | "a_verser"
  | "en_retard"
  | "deja_verse"

const RE_MOIS = /^\d{4}-(0[1-9]|1[0-2])$/

/** Parse 'YYYY-MM' → [année, mois 1-indexé]. Lève si invalide. */
function parseMois(moisLoyer: string): [number, number] {
  if (!RE_MOIS.test(moisLoyer)) {
    throw new Error(`Mois invalide : "${moisLoyer}" (attendu 'YYYY-MM')`)
  }
  const [y, m] = moisLoyer.split("-").map(Number)
  return [y, m]
}

/**
 * Détermine l'état d'échéance d'un loyer de période `moisLoyer` à la date
 * `today`. Si `solde` est vrai (le dû a été couvert par un/des versements),
 * renvoie directement "deja_verse".
 *
 * @param moisLoyer 'YYYY-MM' — période couverte par le loyer (mois M).
 * @param today     Date de consultation.
 * @param solde     true si le loyer est déjà soldé (versé ≥ dû). Défaut false.
 */
export function getLoyerStatus(
  moisLoyer: string,
  today: Date,
  solde = false,
): LoyerEtat {
  if (solde) return "deja_verse"

  const [y, m] = parseMois(moisLoyer)
  const t = today.getTime()

  // m est 1-indexé. En index JS 0-based, le mois M = m-1, donc :
  //   Date.UTC(y, m - 1, …) = jour du mois M
  //   Date.UTC(y, m,     …) = jour du mois M+1 (débordement d'année géré par JS)
  const debutMois = Date.UTC(y, m - 1, 1, 0, 0, 0, 0)        // 1er du mois M
  const debutMP1  = Date.UTC(y, m, 1, 0, 0, 0, 0)            // 1er du mois M+1
  const jour5     = Date.UTC(y, m, 5, 0, 0, 0, 0)            // 5 de M+1 (00:00)
  const jour10Fin = Date.UTC(y, m, 10, 23, 59, 59, 999)      // 10 de M+1 (fin de journée)

  if (t < debutMois) return "futur"
  if (t < debutMP1)  return "en_cours"
  if (t < jour5)     return "a_venir"
  if (t <= jour10Fin) return "a_verser"
  return "en_retard"
}

/**
 * Renvoie 'YYYY-MM' du « loyer à traiter » à la date `today` : c'est toujours
 * le mois PRÉCÉDENT (M−1), car le loyer du mois courant ne sera versé que le
 * mois prochain.
 */
export function moisATraiter(today: Date): string {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1))
  return d.toISOString().slice(0, 7)
}

/**
 * Fenêtre de paiement d'un loyer de période `moisLoyer` : du 5 au 10 du mois
 * M+1 (bornes incluses). Utile pour l'affichage « à verser avant le 10/06 ».
 */
export function fenetrePaiement(moisLoyer: string): { debut: Date; fin: Date } {
  const [y, m] = parseMois(moisLoyer)
  return {
    debut: new Date(Date.UTC(y, m, 5, 0, 0, 0, 0)),
    fin:   new Date(Date.UTC(y, m, 10, 23, 59, 59, 999)),
  }
}

/** Libellé court FR d'un état, pour l'UI (badges Cockpit). */
export function libelleEtat(etat: LoyerEtat): string {
  switch (etat) {
    case "futur":      return "À venir"
    case "en_cours":   return "En cours"
    case "a_venir":    return "À venir"
    case "a_verser":   return "À verser"
    case "en_retard":  return "En retard"
    case "deja_verse": return "Versé"
  }
}
