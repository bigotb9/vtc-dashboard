"use client"

/**
 * Badge de la colonne "Source" d'une opération.
 * Si l'opération provient d'un fournisseur connu (Wave/OM/MTN) ET que la
 * caisse associée a un code identifié, on affiche le logo + label.
 * Sinon, fallback sur un badge avec icône.
 *
 * Référence : doc Phase 3 Écran 1 §3.8.
 */

import { Car, UserCheck, FilePlus, ArrowLeftRight, Sparkles } from "lucide-react"
import type { SourceOperation } from "@/types/compta-ui"
import { CaisseLogo, LOGO_REGISTRY } from "./CaisseLogo"

type Props = {
  source:     SourceOperation
  caisseCode?: string | null
  caisseLibelle?: string | null
}

const SOURCE_FALLBACK: Record<SourceOperation, {
  label: string
  bg:    string
  text:  string
  Icon:  React.ElementType
}> = {
  recette_wave: {
    label: "Recette Wave",
    bg:    "bg-cyan-500/12 dark:bg-cyan-500/15 ring-1 ring-cyan-500/20",
    text:  "text-cyan-700 dark:text-cyan-300",
    Icon:  Sparkles,
  },
  depense_vehicule: {
    label: "Dépense",
    bg:    "bg-red-400/12 dark:bg-red-400/15 ring-1 ring-red-400/20",
    text:  "text-red-700 dark:text-red-300",
    Icon:  Car,
  },
  versement_client: {
    label: "Versement client",
    bg:    "bg-violet-500/12 dark:bg-violet-500/15 ring-1 ring-violet-500/20",
    text:  "text-violet-700 dark:text-violet-300",
    Icon:  UserCheck,
  },
  manuel: {
    label: "Manuel",
    bg:    "bg-gray-500/12 dark:bg-gray-500/15 ring-1 ring-gray-500/20",
    text:  "text-gray-700 dark:text-gray-300",
    Icon:  FilePlus,
  },
  import_csv: {
    label: "Import CSV",
    bg:    "bg-gray-500/12 dark:bg-gray-500/15 ring-1 ring-gray-500/20",
    text:  "text-gray-700 dark:text-gray-300",
    Icon:  FilePlus,
  },
  transfert_interne: {
    // Phase 4.x Vague 1 §3.6 — badge violet "Transfert" sur la liste opérations
    label: "Transfert",
    bg:    "bg-gradient-to-r from-violet-500/15 to-cyan-500/15 ring-1 ring-violet-500/25",
    text:  "text-violet-700 dark:text-violet-300",
    Icon:  ArrowLeftRight,
  },
  dotation_amort: {
    label: "Dotation",
    bg:    "bg-pink-500/12 dark:bg-pink-500/15 ring-1 ring-pink-500/20",
    text:  "text-pink-700 dark:text-pink-300",
    Icon:  Sparkles,
  },
}

/** Si le code caisse est connu (Wave/OM/MTN), afficher le logo dans le badge. */
function badgeAvecLogo(caisseCode: string, label: string) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-500/8 dark:bg-white/[0.04] ring-1 ring-gray-500/15 text-gray-700 dark:text-gray-200">
      <CaisseLogo caisse={{ code: caisseCode, libelle: label }} size="xs" />
      {label}
    </span>
  )
}

const LABELS_FOURNISSEUR: Record<string, string> = {
  wave:         "Wave",
  orange_money: "Orange Money",
  mtn_momo:     "MTN MoMo",
}

export function SourceBadge({ source, caisseCode, caisseLibelle }: Props) {
  // Cas spécial : recette Wave d'un fournisseur de paiement connu → logo
  if (source === "recette_wave" && caisseCode && LOGO_REGISTRY[caisseCode]) {
    const lib = LABELS_FOURNISSEUR[caisseCode] ?? caisseLibelle ?? "Mobile money"
    return badgeAvecLogo(caisseCode, lib)
  }

  // Fallback : badge avec icône Lucide
  const cfg = SOURCE_FALLBACK[source]
  if (!cfg) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-500/12 text-gray-700 dark:text-gray-300">
        {source}
      </span>
    )
  }
  const Icon = cfg.Icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
      <Icon size={11} strokeWidth={2.5} />
      {cfg.label}
    </span>
  )
}
