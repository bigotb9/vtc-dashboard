"use client"

/**
 * Modal wizard 2 étapes — Transfert interne (Phase 4.x Vague 1 §3.2).
 *
 * Orchestre :
 *   - Header avec icône ArrowRightLeft + titre + close
 *   - Stepper 2 dots (Étape 1 / Étape 2)
 *   - Body : <TransfertStep1Destination> ou <TransfertStep2Preview>
 *   - Footer : actions selon l'étape
 *
 * Hooks consommés :
 *   - useDestinations()        → liste caisses+comptes
 *   - usePreviewTransfert()    → preview live SYSCOHADA en étape 2
 *   - useCreateTransfert()     → POST atomique
 *
 * Props :
 *   - open / onClose
 *   - source (caisse OU compte pré-rempli depuis la page détail)
 *   - onSuccess(result) callback après succès (pour rafraîchir la page parente)
 */

import { useEffect, useMemo, useState } from "react"
import { ArrowRightLeft, Loader2, X, ChevronRight, Check } from "lucide-react"
import { TransfertStep1Destination } from "@/components/compta/TransfertStep1Destination"
import { TransfertStep2Preview } from "@/components/compta/TransfertStep2Preview"
import { useDestinations } from "@/hooks/compta/useDestinations"
import { usePreviewTransfert } from "@/hooks/compta/usePreviewTransfert"
import { useCreateTransfert } from "@/hooks/compta/useCreateTransfert"
import { toast } from "@/lib/toast"
import type {
  TransfertCreateResult, TransfertDestinationItem, TransfertPayload, TransfertWizardStep,
} from "@/types/compta-ui"

type Props = {
  open:      boolean
  source:    TransfertDestinationItem | null
  onClose:   () => void
  onSuccess?: (result: TransfertCreateResult) => void
}

function todayISO(): string {
  const d   = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function TransfertInterneModal({ open, source, onClose, onSuccess }: Props) {
  // ─── State du wizard ─────────────────────────────────────────────────────
  const [step,          setStep]          = useState<TransfertWizardStep>("destination")
  const [selectedDest,  setSelectedDest]  = useState<TransfertDestinationItem | null>(null)
  const [montant,       setMontant]       = useState<number>(0)
  const [date,          setDate]          = useState<string>(todayISO())
  const [libelle,       setLibelle]       = useState<string>("")

  // Reset à l'ouverture
  useEffect(() => {
    if (open) {
      setStep("destination")
      setSelectedDest(null)
      setMontant(0)
      setDate(todayISO())
      setLibelle("")
    }
  }, [open])

  const { items: destinations, loading: destLoading } = useDestinations()
  const { create, loading: creating } = useCreateTransfert()

  // ─── Payload mémoïsé pour le preview ─────────────────────────────────────
  const payload: TransfertPayload | null = useMemo(() => {
    if (!source || !selectedDest) return null
    const p: TransfertPayload = {
      date_transfert:   date,
      montant,
      libelle:          libelle.trim() || null,
      source_caisse_id: source.kind === "caisse" ? source.id : null,
      source_compte_id: source.kind === "compte" ? source.id : null,
      dest_caisse_id:   selectedDest.kind === "caisse" ? selectedDest.id : null,
      dest_compte_id:   selectedDest.kind === "compte" ? selectedDest.id : null,
    }
    return p
  }, [source, selectedDest, date, montant, libelle])

  // Preview live uniquement en étape 2 (pour économiser des fetches)
  const preview = usePreviewTransfert(step === "preview" ? payload : null, 200)

  // ─── Validations ─────────────────────────────────────────────────────────
  const canContinue = !!source && !!selectedDest && montant > 0 && !!date
  const canConfirm  = canContinue && !creating && !!preview.data?.equilibre

  // ─── Actions ─────────────────────────────────────────────────────────────
  async function handleConfirm() {
    if (!payload) return
    const res = await create(payload)
    if (res.ok) {
      toast.success(`Transfert effectué : ${formatF(montant)} F transférés.`)
      onSuccess?.(res.result)
      onClose()
    } else {
      toast.error(res.error)
    }
  }

  if (!open || !source) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-black/55 backdrop-blur-sm overflow-y-auto"
      onClick={() => !creating && onClose()}
    >
      <div
        className="relative w-full max-w-xl my-3 sm:my-0 rounded-2xl bg-white dark:bg-[#1a1b1f] border border-gray-200 dark:border-white/[0.08] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ─── Header ──────────────────────────────────────────────────── */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-200 dark:border-white/[0.05]">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/30 flex-shrink-0">
              <ArrowRightLeft size={17} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-black text-gray-900 dark:text-white">
                Transfert interne
              </h2>
              <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-snug mt-0.5">
                Déplacer des fonds entre vos caisses / comptes Boyah.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="w-7 h-7 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.05] inline-flex items-center justify-center transition disabled:opacity-50"
            >
              <X size={14} />
            </button>
          </div>

          {/* Stepper 2 dots */}
          <div className="mt-3 flex items-center gap-2">
            <StepDot index={1} label="Destination & montant" active={step === "destination"} done={step === "preview"} />
            <div className={`flex-1 h-[2px] rounded-full transition ${
              step === "preview" ? "bg-violet-500/60" : "bg-gray-200 dark:bg-white/[0.08]"
            }`} />
            <StepDot index={2} label="Récap & validation" active={step === "preview"} done={false} />
          </div>
        </div>

        {/* ─── Body ────────────────────────────────────────────────────── */}
        <div className="px-5 py-4 max-h-[calc(100vh-220px)] sm:max-h-[60vh] overflow-y-auto">
          {step === "destination" && (
            <TransfertStep1Destination
              source={source}
              destinations={destinations}
              selectedDest={selectedDest}
              onSelectDest={setSelectedDest}
              montant={montant}
              onMontantChange={setMontant}
              date={date}
              onDateChange={setDate}
              libelle={libelle}
              onLibelleChange={setLibelle}
              loadingDestinations={destLoading}
            />
          )}
          {step === "preview" && selectedDest && (
            <TransfertStep2Preview
              source={source}
              dest={selectedDest}
              montant={montant}
              libelle={libelle}
              onLibelleChange={setLibelle}
              preview={preview.data}
              previewLoading={preview.loading}
              previewError={preview.error}
            />
          )}
        </div>

        {/* ─── Footer actions ──────────────────────────────────────────── */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-white/[0.05] bg-gray-50/50 dark:bg-white/[0.02]">
          {step === "destination" ? (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.04] transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => setStep("preview")}
                disabled={!canContinue}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600 text-white text-sm font-semibold shadow-md shadow-violet-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                Continuer
                <ChevronRight size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep("destination")}
                disabled={creating}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/[0.08] text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.04] transition disabled:opacity-50"
              >
                ← Précédent
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={creating}
                  className="px-3 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!canConfirm}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-sm font-semibold shadow-md shadow-emerald-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {creating
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Check size={14} />
                  }
                  {creating ? "Création…" : "Confirmer le transfert"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sous-composant : un dot du stepper ─────────────────────────────────────
function StepDot({ index, label, active, done }: { index: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition ${
        done
          ? "bg-violet-500/60 text-white"
          : active
            ? "bg-gradient-to-br from-violet-500 to-cyan-500 text-white shadow-md shadow-violet-500/30 ring-2 ring-violet-500/20"
            : "bg-gray-100 dark:bg-white/[0.06] text-gray-400 dark:text-gray-500"
      }`}>
        {done ? <Check size={12} /> : index}
      </div>
      <span className={`text-[11px] font-semibold uppercase tracking-wider truncate hidden sm:inline ${
        active
          ? "text-violet-600 dark:text-violet-300"
          : done
            ? "text-violet-400 dark:text-violet-400/60"
            : "text-gray-400 dark:text-gray-500"
      }`}>
        Étape {index}
      </span>
    </div>
  )
}

function formatF(n: number): string {
  return Math.round(n).toLocaleString("fr-FR").replace(/ | /g, " ")
}
