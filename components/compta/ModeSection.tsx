"use client"

/**
 * Section 1 — Mode de fonctionnement (Écran 7 §3).
 *
 * 2 cards radio Simple/Avancé. Click sur la card non active ouvre une modale
 * de confirmation double. Warning ambre intégré en bas.
 */

import { useState } from "react"
import { Pencil, BookOpen, ArrowLeftRight, AlertTriangle, Loader2 } from "lucide-react"
import { DoubleConfirmModal } from "@/components/compta/DoubleConfirmModal"
import { useToggleMode } from "@/hooks/compta/useToggleMode"
import { toast } from "@/lib/toast"
import type { ParametresPayload } from "@/types/compta-ui"

type Props = {
  data:     ParametresPayload | null
  loading?: boolean
  onChanged: () => void
}

export function ModeSection({ data, loading, onChanged }: Props) {
  const mode = data?.mode_actif ?? "avance"
  const nbEcritures = data?.stats.nb_ecritures ?? 0
  const nbOps       = data?.stats.nb_operations ?? 0
  const [target, setTarget] = useState<"simple" | "avance" | null>(null)
  const { toggle, loading: toggling } = useToggleMode({ onPoll: onChanged })

  async function handleConfirm() {
    if (!target) return
    const res = await toggle({
      nouveau_mode: target,
      confirmer:    true,
    })
    if (res.ok) {
      toast.success(`Mode basculé en ${target === "avance" ? "Avancé" : "Simple"}`)
      onChanged()
      setTarget(null)
    } else {
      toast.error(res.error)
      setTarget(null)
    }
  }

  return (
    <section id="mode" className="relative rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-5 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-violet-500 to-transparent" />

      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-violet-500/30 flex-shrink-0">
          <ArrowLeftRight size={16} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-violet-700 dark:text-violet-300">Mode de fonctionnement</h2>
          <p className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
            Détermine si les écritures comptables SYSCOHADA sont générées à chaque validation d&apos;opération.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ModeCard
          mode="simple"
          active={mode === "simple"}
          disabled={loading || toggling}
          Icon={Pencil}
          title="Mode Simple"
          desc="Suivi des entrées/sorties uniquement. Pas d'écriture comptable générée. Plus rapide, moins rigoureux."
          onActivate={() => setTarget("simple")}
        />
        <ModeCard
          mode="avance"
          active={mode === "avance"}
          disabled={loading || toggling}
          Icon={BookOpen}
          title="Mode Avancé"
          desc="Écriture SYSCOHADA générée à chaque validation. Partie double, balance, journaux. Conformité comptable."
          onActivate={() => setTarget("avance")}
        />
      </div>

      <div className="mt-4 rounded-xl bg-amber-500/5 border border-amber-500/20 px-3 py-2.5 flex items-start gap-2">
        <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-[11.5px] text-amber-700 dark:text-amber-300 leading-snug">
          Basculer le mode entraîne une <strong>régénération rétroactive</strong> de toutes les écritures
          (<span className="tabular-nums">~{nbEcritures}</span> actuellement).
          Opération longue (~10 min) et irréversible. Confirmation à double saisie requise.
        </p>
      </div>

      <DoubleConfirmModal
        open={target !== null}
        title={target === "avance" ? "Basculer en mode Avancé" : "Basculer en mode Simple"}
        message={
          target === "avance"
            ? "Toutes les écritures SYSCOHADA vont être générées rétroactivement pour les opérations existantes."
            : "Les écritures SYSCOHADA seront conservées en lecture seule. Les futures opérations ne généreront plus d'écritures."
        }
        warningList={[
          `${nbOps} opérations seront traitées`,
          target === "avance"
            ? `Génération rétroactive de ~${nbEcritures} écritures`
            : `Les ~${nbEcritures} écritures actuelles sont conservées`,
          "Durée estimée : ~10 min selon le volume",
          "Action irréversible (annulation = re-toggle dans l'autre sens)",
        ]}
        confirmWord="CONFIRMER"
        confirmLabel={toggling ? "Bascule en cours…" : "Basculer maintenant"}
        onConfirm={handleConfirm}
        onCancel={() => !toggling && setTarget(null)}
      />
    </section>
  )
}

function ModeCard({
  active, disabled, Icon, title, desc, onActivate,
}: {
  mode:     "simple" | "avance"
  active:   boolean
  disabled: boolean
  Icon:     React.ElementType
  title:    string
  desc:     string
  onActivate: () => void
}) {
  return (
    <button
      type="button"
      disabled={active || disabled}
      onClick={onActivate}
      className={`text-left rounded-2xl border p-4 transition relative overflow-hidden disabled:cursor-default ${
        active
          ? "bg-violet-500/5 dark:bg-violet-500/10 border-violet-500/40 ring-2 ring-violet-500/30"
          : "bg-white dark:bg-white/[0.02] border-gray-200/70 dark:border-white/[0.06] hover:border-violet-300 dark:hover:border-violet-500/30 cursor-pointer"
      } ${disabled && !active ? "opacity-60 cursor-not-allowed" : ""}`}
    >
      {active && (
        <span className="absolute top-3 right-3 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20">
          Actif
        </span>
      )}
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${
          active
            ? "bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-violet-500/40"
            : "bg-violet-500/10 text-violet-600 dark:text-violet-400"
        }`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-black tracking-tight ${active ? "text-violet-700 dark:text-violet-300" : "text-gray-900 dark:text-white"}`}>
            {title}
          </p>
          <p className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">
            {desc}
          </p>
        </div>
      </div>
    </button>
  )
}
