"use client"

/**
 * Logo d'un fournisseur de paiement (caisse mobile money / banque).
 * Charge le SVG depuis `/logos/<code>.svg` si le code est connu, sinon
 * fallback automatique sur des initiales colorées.
 *
 * Référence : doc Phase 3 Écran 1 §3.5.
 */

import { useState } from "react"

export type CaisseLike = {
  id?:       string
  code?:     string | null
  libelle?:  string | null
}

type Size = "xs" | "sm" | "md" | "lg"

type Props = {
  caisse: CaisseLike
  size?:  Size
  className?: string
}

const SIZE_MAP: Record<Size, number> = { xs: 16, sm: 22, md: 28, lg: 36 }

type RegistryEntry = {
  logoUrl?:           string
  bgColor:            string
  fallbackInitials:   string
  fallbackTextColor:  string
}

/** Registry exporté pour usage dans SourceBadge. */
export const LOGO_REGISTRY: Record<string, RegistryEntry> = {
  wave: {
    logoUrl:           "/logos/logowave.png",
    bgColor:           "#FFFFFF",
    fallbackInitials:  "W",
    fallbackTextColor: "#1DC8DD",
  },
  orange_money: {
    logoUrl:           "/logos/logoorangemoney.png",
    bgColor:           "#FFFFFF",
    fallbackInitials:  "OM",
    fallbackTextColor: "#FF7A00",
  },
  mtn_momo: {
    logoUrl:           "/logos/logomtnmoney.png",
    bgColor:           "#FFFFFF",
    fallbackInitials:  "MTN",
    fallbackTextColor: "#FFCC00",
  },
  caisse_principale: {
    bgColor:           "rgba(16,185,129,0.18)",
    fallbackInitials:  "CP",
    fallbackTextColor: "#34D399",
  },
  petite_caisse: {
    bgColor:           "rgba(16,185,129,0.18)",
    fallbackInitials:  "PC",
    fallbackTextColor: "#34D399",
  },
  sgci: {
    logoUrl:           "/logos/sgci.svg",
    bgColor:           "rgba(139,92,246,0.18)",
    fallbackInitials:  "SG",
    fallbackTextColor: "#A78BFA",
  },
  ecobank: {
    logoUrl:           "/logos/ecobank.svg",
    bgColor:           "rgba(139,92,246,0.18)",
    fallbackInitials:  "EC",
    fallbackTextColor: "#A78BFA",
  },
  nsia: {
    logoUrl:           "/logos/nsia.svg",
    bgColor:           "rgba(139,92,246,0.18)",
    fallbackInitials:  "NS",
    fallbackTextColor: "#A78BFA",
  },
}

/**
 * Construit une entry de fallback à partir des initiales du libellé.
 */
function fallbackFromLibelle(libelle?: string | null): RegistryEntry {
  const init = (libelle || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 3)
  return {
    bgColor:           "rgba(156,163,175,0.18)",
    fallbackInitials:  init || "?",
    fallbackTextColor: "#9CA3AF",
  }
}

export function CaisseLogo({ caisse, size = "sm", className }: Props) {
  const [imgFailed, setImgFailed] = useState(false)
  const px    = SIZE_MAP[size]
  const code  = caisse.code ?? ""
  const entry = LOGO_REGISTRY[code] ?? fallbackFromLibelle(caisse.libelle)
  const showImage = !!entry.logoUrl && !imgFailed

  return (
    <div
      className={`flex items-center justify-center rounded-md overflow-hidden flex-shrink-0 ${className ?? ""}`}
      style={{ width: px, height: px, background: entry.bgColor }}
      title={caisse.libelle ?? undefined}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.logoUrl}
          alt={caisse.libelle ?? code}
          width={px}
          height={px}
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span
          className="font-bold leading-none select-none"
          style={{
            fontSize: Math.max(8, Math.round(px * 0.4)),
            color:    entry.fallbackTextColor,
          }}
        >
          {entry.fallbackInitials}
        </span>
      )}
    </div>
  )
}
