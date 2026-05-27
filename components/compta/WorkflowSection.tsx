"use client"

/**
 * Section 3 — Workflow et numérotation (Écran 7 §5).
 *
 * 3 lignes :
 *  - Toggle Workflow de validation
 *  - Toggle Numérotation automatique
 *  - Sélecteur Journal par défaut
 *
 * Chaque action déclenche un PATCH immédiat (pas de bouton "Enregistrer")
 * avec toast de feedback.
 */

import { Route } from "lucide-react"
import { ToggleSwitch } from "@/components/compta/ToggleSwitch"
import { toast } from "@/lib/toast"
import type { ParametresPayload } from "@/types/compta-ui"

const JOURNAUX = [
  { code: "BQ", label: "BQ — Banque" },
  { code: "CA", label: "CA — Caisse" },
  { code: "AC", label: "AC — Achats" },
  { code: "VE", label: "VE — Ventes" },
  { code: "PA", label: "PA — Paie" },
  { code: "OD", label: "OD — Opérations diverses" },
]

type Props = {
  data:    ParametresPayload | null
  loading?: boolean
  patching?: boolean
  onPatch: (update: Record<string, unknown>) => Promise<{ ok: true } | { ok: false; error: string }>
}

export function WorkflowSection({ data, loading, patching, onPatch }: Props) {
  async function setFlag(field: string, value: boolean | string) {
    const res = await onPatch({ [field]: value })
    if (res.ok) toast.success("Paramètre enregistré")
    else toast.error(res.error)
  }

  return (
    <section id="workflow" className="relative rounded-2xl bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.06] p-5 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />

      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-500 flex items-center justify-center text-white shadow-md shadow-cyan-500/30 flex-shrink-0">
          <Route size={16} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-cyan-700 dark:text-cyan-300">Workflow et numérotation</h2>
          <p className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
            Comportement par défaut des opérations et écritures comptables.
          </p>
        </div>
      </div>

      {loading || !data ? (
        <div className="h-36 rounded-xl animate-pulse bg-gray-100 dark:bg-white/[0.04]" />
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-white/[0.06]">
          <Row title="Workflow de validation" desc="Si activé, toute opération créée passe en brouillon avant validation par le directeur.">
            <ToggleSwitch
              checked={data.workflow_validation_actif}
              onChange={v => setFlag("workflow_validation_actif", v)}
              loading={patching}
            />
          </Row>
          <Row title="Numérotation automatique" desc="Préfixe l'écriture par le code journal : VE pour ventes, OD pour opérations diverses, etc.">
            <ToggleSwitch
              checked={data.numerotation_auto}
              onChange={v => setFlag("numerotation_auto", v)}
              loading={patching}
            />
          </Row>
          <Row title="Journal par défaut" desc="Utilisé quand la catégorie d'une opération ne fixe pas de journal spécifique.">
            <select
              value={data.journal_par_defaut}
              onChange={e => setFlag("journal_par_defaut", e.target.value)}
              disabled={patching}
              className="text-xs bg-white dark:bg-white/[0.02] border border-gray-200/70 dark:border-white/[0.08] rounded-md px-2 py-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-500/30 font-mono"
            >
              {JOURNAUX.map(j => <option key={j.code} value={j.code}>{j.label}</option>)}
            </select>
          </Row>
        </div>
      )}
    </section>
  )
}

function Row({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-gray-900 dark:text-white">{title}</p>
        <p className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug max-w-[480px]">{desc}</p>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}
