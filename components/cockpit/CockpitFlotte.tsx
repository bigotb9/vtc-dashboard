"use client"

/**
 * components/cockpit/CockpitFlotte.tsx
 *
 * Zone 4 — Cockpit Boyah : mini-radar flotte en un coup d'œil.
 *   - Bandeau résumé : à jour / en retard / en pause / courses jour / cash net
 *   - Grille de tuiles : 1 par véhicule, cliquable → /vehicules/[id]
 */

import Link from "next/link"
import { formatMontant } from "@/lib/format/montant"
import type { FlottePayload } from "./types"

type Props = {
  data:    FlottePayload | null
  loading: boolean
  error:   string | null
}

export default function CockpitFlotte({ data, loading, error }: Props) {
  if (error) {
    return (
      <section>
        <h2 className="text-[13px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
          Flotte en un coup d&apos;œil
        </h2>
        <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-400">
          Erreur flotte : {error}
        </div>
      </section>
    )
  }

  if (loading || !data) {
    return (
      <section>
        <h2 className="text-[13px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
          Flotte en un coup d&apos;œil
        </h2>
        <div className="h-16 rounded-xl bg-gray-100 dark:bg-white/[0.03] animate-pulse mb-3" />
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-gray-100 dark:bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  const { vehicules, resume } = data

  return (
    <section>
      <h2 className="text-[13px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
        Flotte en un coup d&apos;œil
      </h2>

      {/* Résumé horizontal */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        <ResumeStat label="À jour"        value={`${resume.a_jour}`}              tone="positive" />
        <ResumeStat label="En retard"     value={`${resume.retard}`}              tone={resume.retard > 0 ? "negative" : "neutral"} />
        <ResumeStat label="En pause"      value={`${resume.pause}`}               tone="neutral" />
        <ResumeStat label="Courses jour"  value={`${resume.courses_jour}`}        tone="neutral" />
        <ResumeStat label="Cash net jour" value={`${formatMontant(resume.cash_net)} F`} tone={resume.cash_net >= 0 ? "positive" : "negative"} />
      </div>

      {/* Tuiles véhicules */}
      {vehicules.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic p-4 text-center">
          Aucun véhicule en base.
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {vehicules.map(v => (
            <VehiculeTuile key={v.id_vehicule} v={v} />
          ))}
        </div>
      )}
    </section>
  )
}

function ResumeStat({ label, value, tone }: {
  label: string
  value: string
  tone:  "neutral" | "positive" | "negative"
}) {
  const valueClass = tone === "positive"
    ? "text-emerald-600 dark:text-emerald-400"
    : tone === "negative"
      ? "text-red-600 dark:text-red-400"
      : "text-gray-900 dark:text-white"

  return (
    <div className="rounded-xl border border-gray-100 dark:border-[#1E2D45] bg-white dark:bg-[#0D1424] p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`text-lg font-bold tabular-nums mt-0.5 ${valueClass}`}>{value}</p>
    </div>
  )
}

function VehiculeTuile({ v }: { v: { id_vehicule: number; immatriculation: string; statut: "a_jour" | "retard" | "pause"; meta_principale: string } }) {
  const colorClass =
    v.statut === "retard"
      ? "border-red-200 dark:border-red-500/30 bg-red-50/40 dark:bg-red-500/5 hover:bg-red-50 dark:hover:bg-red-500/10"
      : v.statut === "pause"
        ? "border-gray-200 dark:border-[#1E2D45] bg-gray-50/40 dark:bg-white/[0.02] hover:bg-gray-100/50 dark:hover:bg-white/5"
        : "border-emerald-200/50 dark:border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-500/5 hover:bg-emerald-50/60 dark:hover:bg-emerald-500/10"

  const subClass =
    v.statut === "retard"
      ? "text-red-600 dark:text-red-400"
      : v.statut === "pause"
        ? "text-gray-400 dark:text-gray-500"
        : "text-emerald-700 dark:text-emerald-400"

  return (
    <Link
      href={`/vehicules/${v.id_vehicule}`}
      className={`block rounded-xl border p-2.5 transition cursor-pointer ${colorClass}`}
      title={`${v.immatriculation} · ${v.meta_principale}`}
    >
      <p className="font-mono text-[11.5px] font-bold tracking-wide text-gray-900 dark:text-white truncate">
        {v.immatriculation}
      </p>
      <p className={`text-[10px] font-medium mt-0.5 truncate ${subClass}`}>
        {v.meta_principale}
      </p>
    </Link>
  )
}
