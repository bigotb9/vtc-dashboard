"use client"

/**
 * Grille de stats globales (Écran 8 §3.5) — Section 5.
 * Pas un check, juste de l'info contextuelle. Toujours ouverte par défaut.
 */

import type { HealthStatsSection } from "@/types/compta-ui"

const fmt = (n: number) => Math.round(n).toLocaleString("fr-FR")
const fmtCompact = (n: number) => {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`
  if (abs >= 1_000)     return `${(n / 1_000).toFixed(0)}k`
  return fmt(n)
}

type Props = {
  payload: HealthStatsSection
}

export function HealthStatsGrid({ payload }: Props) {
  const s = payload.stats
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Stat title="Chiffre d'affaires" value={`${fmtCompact(s.ca_total)} F`} sub="Cumul tous temps" />
      <Stat title="Dépenses"           value={`${fmtCompact(s.depenses_total)} F`} sub="Cumul tous temps" />
      <Stat title="Résultat net"       value={`${s.resultat_net >= 0 ? "+" : "−"}${fmtCompact(Math.abs(s.resultat_net))} F`} sub="CA − Dépenses" danger={s.resultat_net < 0} />
      <Stat title="Trésorerie"         value={`${s.tresorerie >= 0 ? "" : "−"}${fmtCompact(Math.abs(s.tresorerie))} F`} sub="Caisses + comptes" danger={s.tresorerie < 0} />
      <Stat title="Ops validées"       value={fmt(s.ops_valides)}    sub="Statut = valide" />
      <Stat title="Ops brouillon"      value={fmt(s.ops_brouillon)}  sub="En attente" />
      <Stat title="Ops annulées"       value={fmt(s.ops_annulees)}   sub="Avec extourne" />
      <Stat title="Extournes"          value={fmt(s.extournes)}      sub="Écritures inverses" />
    </div>
  )
}

function Stat({ title, value, sub, danger }: { title: string; value: string; sub?: string; danger?: boolean }) {
  return (
    <div className="rounded-xl bg-gray-50/60 dark:bg-white/[0.02] border border-gray-200/60 dark:border-white/[0.05] px-3 py-2.5">
      <p className="text-[9.5px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em] truncate">{title}</p>
      <p className={`text-[16px] font-black tabular-nums leading-tight mt-0.5 ${
        danger ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"
      }`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">{sub}</p>}
    </div>
  )
}
