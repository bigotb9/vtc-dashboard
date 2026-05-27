"use client"

/**
 * Étape 1 du wizard transfert interne (Phase 4.x Vague 1 §3.3).
 *
 * Affiche :
 *   - bloc "Depuis <source>"
 *   - liste verticale des destinations possibles (caisses + comptes Boyah,
 *     sans la source)
 *   - formulaire montant / date / libellé
 *
 * Le parent contrôle l'état (selectedDest, montant, …) et fournit les setters.
 */

import { Calendar, FileText, Wallet, Loader2, AlertCircle } from "lucide-react"
import { DestinationOption } from "@/components/compta/DestinationOption"
import { CaisseLogo } from "@/components/compta/CaisseLogo"
import type { TransfertDestinationItem } from "@/types/compta-ui"

function formatF(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "—"
  return Math.round(n).toLocaleString("fr-FR").replace(/ | /g, " ") + " F"
}

type Props = {
  source:        TransfertDestinationItem
  destinations:  TransfertDestinationItem[]
  selectedDest:  TransfertDestinationItem | null
  onSelectDest:  (d: TransfertDestinationItem) => void

  montant:       number
  onMontantChange: (n: number) => void

  date:          string
  onDateChange:  (s: string) => void

  libelle:       string
  onLibelleChange: (s: string) => void

  loadingDestinations?: boolean
}

export function TransfertStep1Destination({
  source, destinations, selectedDest, onSelectDest,
  montant, onMontantChange,
  date, onDateChange,
  libelle, onLibelleChange,
  loadingDestinations,
}: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const filtered = destinations.filter(d => !(d.kind === source.kind && d.id === source.id))
  const soldeSource = source.solde_courant
  const overSolde   = soldeSource !== null && montant > soldeSource

  return (
    <div className="space-y-4">
      {/* Bandeau source */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-violet-500/10 to-cyan-500/10 border border-violet-500/20">
        <CaisseLogo caisse={{ code: source.code, libelle: source.libelle }} size="md" />
        <div className="flex-1 min-w-0">
          <div className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-300">
            Depuis
          </div>
          <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
            {source.libelle}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
            <span className="font-mono">{source.syscohada_code ?? "—"}</span>
            <span className="text-gray-300 dark:text-gray-700">·</span>
            <span className={`font-mono tabular-nums font-semibold ${
              soldeSource !== null && soldeSource < 0
                ? "text-red-500 dark:text-red-400"
                : "text-gray-700 dark:text-gray-200"
            }`}>
              solde {formatF(soldeSource)}
            </span>
          </div>
        </div>
      </div>

      {/* Liste destinations */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Wallet size={13} className="text-violet-500" />
          <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-gray-600 dark:text-gray-300">
            Où veux-tu transférer ?
          </span>
          {loadingDestinations && <Loader2 size={11} className="animate-spin text-gray-400" />}
        </div>
        {filtered.length === 0 && !loadingDestinations ? (
          <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/[0.08] p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
            Aucune autre caisse/compte disponible.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {filtered.map(d => (
              <DestinationOption
                key={`${d.kind}-${d.id}`}
                item={d}
                selected={!!selectedDest && selectedDest.kind === d.kind && selectedDest.id === d.id}
                onClick={() => onSelectDest(d)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Form grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Montant */}
        <div className="col-span-1">
          <label className="block text-[10.5px] font-bold uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400 mb-1.5">
            Montant (F CFA)
          </label>
          <div className="relative">
            <input
              type="number"
              min={1}
              step={1}
              value={montant > 0 ? montant : ""}
              onChange={e => onMontantChange(Number(e.target.value) || 0)}
              placeholder="200 000"
              className={`w-full px-3 py-2 rounded-xl bg-white dark:bg-white/[0.04] border text-sm font-mono font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition tabular-nums ${
                overSolde
                  ? "border-amber-400/60 focus:ring-amber-500/40"
                  : "border-gray-200 dark:border-white/[0.08] focus:ring-violet-500/40 focus:border-violet-500/60"
              }`}
            />
          </div>
          {overSolde && (
            <div className="mt-1 flex items-start gap-1 text-[10.5px] text-amber-600 dark:text-amber-400">
              <AlertCircle size={11} className="mt-0.5 shrink-0" />
              <span>Montant supérieur au solde courant — autorisé mais à vérifier.</span>
            </div>
          )}
        </div>

        {/* Date */}
        <div className="col-span-1">
          <label className="block text-[10.5px] font-bold uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400 mb-1.5">
            <Calendar size={11} className="inline -mt-0.5 mr-1" />
            Date du transfert
          </label>
          <input
            type="date"
            value={date}
            max={today}
            onChange={e => onDateChange(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-sm font-mono text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60 transition"
          />
        </div>

        {/* Libellé (full width) */}
        <div className="col-span-2">
          <label className="block text-[10.5px] font-bold uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400 mb-1.5">
            <FileText size={11} className="inline -mt-0.5 mr-1" />
            Libellé (optionnel)
          </label>
          <input
            type="text"
            value={libelle}
            maxLength={255}
            onChange={e => onLibelleChange(e.target.value)}
            placeholder={`Ex: Transfert ${source.libelle} → destination`}
            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60 transition"
          />
          <div className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-600">
            Si vide, libellé auto-généré : &quot;Transfert interne : source → destination&quot;.
          </div>
        </div>
      </div>
    </div>
  )
}
