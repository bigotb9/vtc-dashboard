"use client"

/**
 * Section 5 — Zone dangereuse (Écran 7 §7).
 *
 * 3 actions empilées :
 *  - Réinitialiser premier login (simple confirm)
 *  - Forcer health check (modal résultat)
 *  - Forcer re-toggle Simple → Avancé (double confirm + force=true)
 */

import { useState } from "react"
import { AlertTriangle, RotateCcw, ShieldCheck, RefreshCw, Loader2 } from "lucide-react"
import { ConfirmModal } from "@/components/compta/ConfirmModal"
import { DoubleConfirmModal } from "@/components/compta/DoubleConfirmModal"
import { HealthCheckResultModal } from "@/components/compta/HealthCheckResultModal"
import { useHealthCheck } from "@/hooks/compta/useHealthCheck"
import { useToggleMode } from "@/hooks/compta/useToggleMode"
import { toast } from "@/lib/toast"
import type { ParametresPayload } from "@/types/compta-ui"

type Props = {
  data:     ParametresPayload | null
  loading?: boolean
  onPatch:  (update: Record<string, unknown>) => Promise<{ ok: true } | { ok: false; error: string }>
  onChanged: () => void
}

export function DangerZoneSection({ data, loading, onPatch, onChanged }: Props) {
  const [confirmReset, setConfirmReset]   = useState(false)
  const [confirmRetoggle, setConfirmRetoggle] = useState(false)
  const [healthOpen, setHealthOpen]       = useState(false)
  const { data: healthData, loading: healthLoading, run: runHealth, reset: resetHealth } = useHealthCheck()
  const { toggle, loading: toggling } = useToggleMode({ onPoll: onChanged })

  async function handleResetPremierLogin() {
    const res = await onPatch({ premier_login_effectue: false })
    if (res.ok) toast.success("Premier login réinitialisé")
    else toast.error(res.error)
    setConfirmReset(false)
  }

  async function handleHealthCheck() {
    setHealthOpen(true)
    await runHealth()
  }

  async function handleReToggle() {
    const res = await toggle({
      nouveau_mode: "avance",
      confirmer:    true,
      force:        true,
    })
    if (res.ok) {
      toast.success("Re-toggle terminé · écritures régénérées")
      onChanged()
    } else {
      toast.error(res.error)
    }
    setConfirmRetoggle(false)
  }

  const nbEcritures = data?.stats.nb_ecritures ?? 0

  return (
    <section id="danger" className="relative rounded-2xl bg-red-500/[0.04] dark:bg-red-500/[0.05] border border-red-500/20 p-5 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent" />

      <div className="flex items-start gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white shadow-md shadow-red-500/30 flex-shrink-0">
          <AlertTriangle size={16} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-red-700 dark:text-red-300">Zone dangereuse</h2>
          <p className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
            Actions administratives sensibles, à utiliser avec précaution.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <DangerAction
          Icon={RotateCcw}
          title="Réinitialiser le premier login"
          desc="Permet de re-déclencher l'écran d'onboarding initial pour le directeur. Sans conséquence comptable."
          button="Réinitialiser"
          variant="outline"
          disabled={loading}
          onClick={() => setConfirmReset(true)}
        />
        <DangerAction
          Icon={ShieldCheck}
          title="Forcer un health check"
          desc="Lance une vérification complète : équilibre débit/crédit, opérations orphelines, écritures sans lignes. Lecture seule."
          button={healthLoading ? "Vérification…" : "Lancer la vérification"}
          variant="outline"
          disabled={loading || healthLoading}
          loading={healthLoading}
          onClick={handleHealthCheck}
        />
        <DangerAction
          Icon={RefreshCw}
          title="Forcer re-toggle Simple → Avancé"
          desc={`Régénère toutes les écritures rétroactivement (~${nbEcritures} actuellement). Utile après un import massif. Peut prendre ~10 min. Confirmation double obligatoire.`}
          button={toggling ? "Re-toggle en cours…" : "Lancer le re-toggle"}
          variant="solid"
          disabled={loading || toggling}
          loading={toggling}
          onClick={() => setConfirmRetoggle(true)}
        />
      </div>

      {/* Modal Reset premier login */}
      <ConfirmModal
        open={confirmReset}
        title="Réinitialiser le premier login ?"
        message="L'écran d'onboarding sera affiché lors du prochain accès au module compta. Aucune écriture n'est modifiée."
        confirmLabel="Réinitialiser"
        variant="warning"
        onConfirm={handleResetPremierLogin}
        onCancel={() => setConfirmReset(false)}
      />

      {/* Modal Re-toggle */}
      <DoubleConfirmModal
        open={confirmRetoggle}
        title="Forcer le re-toggle Simple → Avancé"
        message={`Cette opération va régénérer toutes les écritures comptables existantes (~${nbEcritures} actuellement). Durée estimée : ~10 min. Irréversible.`}
        warningList={[
          "Toutes les écritures seront supprimées puis recréées",
          "Les opérations conservent leur statut",
          "Le mode reste 'Avancé' à la fin",
          "Aucune donnée comptable n'est perdue",
        ]}
        confirmWord="CONFIRMER"
        confirmLabel={toggling ? "Re-toggle…" : "Lancer maintenant"}
        onConfirm={handleReToggle}
        onCancel={() => !toggling && setConfirmRetoggle(false)}
      />

      {/* Modal Résultat health */}
      <HealthCheckResultModal
        open={healthOpen}
        result={healthData}
        loading={healthLoading}
        onClose={() => { setHealthOpen(false); resetHealth() }}
      />
    </section>
  )
}

function DangerAction({
  Icon, title, desc, button, variant, disabled, loading, onClick,
}: {
  Icon:     React.ElementType
  title:    string
  desc:     string
  button:   string
  variant:  "outline" | "solid"
  disabled?: boolean
  loading?:  boolean
  onClick:  () => void
}) {
  const btnCls = variant === "solid"
    ? "bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-md shadow-red-500/30 disabled:opacity-50 disabled:shadow-none"
    : "border border-red-300 dark:border-red-500/40 bg-white dark:bg-white/[0.02] text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50"

  return (
    <div className="rounded-xl bg-white dark:bg-white/[0.02] border border-red-200/60 dark:border-red-500/15 p-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0">
          <Icon size={14} />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-gray-900 dark:text-white">{title}</p>
          <p className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{desc}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition flex-shrink-0 ${btnCls}`}
      >
        {loading && <Loader2 size={14} className="animate-spin" />}
        {button}
      </button>
    </div>
  )
}
