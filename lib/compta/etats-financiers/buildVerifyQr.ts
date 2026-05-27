/**
 * PATCH Phase 4.2 — Helper QR code + URL raccourcie pour les PDF officiels.
 *
 * Construit l'URL de vérification raccourcie + le data-URL PNG du QR code
 * scannable. Utilisé par les routes export-pdf Bilan + Compte de résultat.
 *
 *   Format URL :  https://fleet.boyahgroup.com/verify/<12-premiers-chars-uuid>
 *   Format QR  :  PNG base64, niveau correction M, 200×200 px source,
 *                 affiché en 50×50 dans le PDF.
 *
 * Fallback dev : si NEXT_PUBLIC_VERIFY_BASE_URL absent → http://localhost:3000.
 */

import QRCode from "qrcode"

export interface VerifyQrBundle {
  /** UUID complet (36 chars) tel que stocké en BDD */
  uuid:        string
  /** 12 premiers caractères du UUID (sans tirets retirés — on garde "xxxxxxxx-xxxx") */
  short_uuid:  string
  /** URL pleine (avec scheme + host) pour QR + footer PDF */
  verify_url:  string
  /** Data URL PNG base64 du QR code */
  qr_data_url: string
}

/**
 * Renvoie la base URL de vérification configurée, sans trailing slash.
 * Priorité :
 *   1. NEXT_PUBLIC_VERIFY_BASE_URL (config explicite — prod)
 *   2. NEXT_PUBLIC_SITE_URL        (config générique)
 *   3. http://localhost:3000        (dev fallback)
 */
export function getVerifyBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_VERIFY_BASE_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, "")
  const generic = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (generic) return generic.replace(/\/$/, "")
  return "http://localhost:3000"
}

/**
 * Construit le short UUID (12 premiers chars, lowercase, incluant le tiret final).
 * Exemple : "a1b2c3d4-e5f6-..." → "a1b2c3d4-e5f"
 *
 * On garde les tirets pour préserver la lisibilité humaine de l'URL
 * imprimée en pied de page (DGI/banque peuvent recopier).
 */
export function makeShortUuid(uuid: string): string {
  return uuid.toLowerCase().slice(0, 12)
}

/**
 * Génère l'URL de vérification + le QR data-URL pour un UUID donné.
 * À appeler depuis les routes /api/compta/etats-financiers/.../export-pdf
 * AVANT de rendre le template (les templates sont sync, le QR est async).
 */
export async function buildVerifyQr(uuid: string): Promise<VerifyQrBundle> {
  const short      = makeShortUuid(uuid)
  const base       = getVerifyBaseUrl()
  const verifyUrl  = `${base}/verify/${short}`

  // QR code : niveau correction M (15 % récupération erreur), bonne lecture
  // sur papier imprimé même légèrement froissé. Source 200 px pour qualité.
  // margin 1 = quiet zone minimale ISO/IEC 18004 (au lieu de 0 qui empêche
  // certains scanners stricts de lire le code).
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    width:             200,
    margin:            1,
    errorCorrectionLevel: "M",
    color: {
      dark:  "#1F4E79",
      light: "#FFFFFF",
    },
  })

  return {
    uuid,
    short_uuid:  short,
    verify_url:  verifyUrl,
    qr_data_url: qrDataUrl,
  }
}
