"use client"

/**
 * Modal compact de création à la volée d'un tiers (Phase 4.x Vague 2 §3.6).
 *
 * Trigger : bouton "+ Nouveau tiers" depuis le sélecteur de tiers (Écran 4
 * Saisie ou Écran 2 Rétroaction). Création + sélection automatique du
 * nouveau tiers dans le formulaire parent.
 */

import { useEffect, useState } from "react"
import { ArrowRightLeft, Loader2, Plus, X, ChevronDown } from "lucide-react"
import { TiersTypeBadge } from "@/components/compta/TiersTypeBadge"
import { useSuggestSuffix } from "@/hooks/compta/useSuggestSuffix"
import { useCreateTiers } from "@/hooks/compta/useCreateTiers"
import { toast } from "@/lib/toast"
import {
  TIERS_SYSCOHADA_PARENT,
  type TiersCreateResult,
  type TiersType,
} from "@/types/compta-ui"

type Props = {
  open:        boolean
  defaultType?: TiersType
  onClose:     () => void
  onCreated:   (result: TiersCreateResult & { nom: string; type: TiersType }) => void
}

const TYPES: TiersType[] = ["client", "fournisseur", "salarie", "autre"]

export function TiersQuickCreateModal({ open, defaultType = "fournisseur", onClose, onCreated }: Props) {
  const [type,      setType]      = useState<TiersType>(defaultType)
  const [nom,       setNom]       = useState("")
  const [telephone, setTelephone] = useState("")
  const [email,     setEmail]     = useState("")
  const [showEntreprise, setShowEntreprise] = useState(false)
  const [numero_rccm,         setRccm]         = useState("")
  const [numero_contribuable, setContribuable] = useState("")

  const { create, loading } = useCreateTiers()
  const suggest = useSuggestSuffix(nom, type, 200)

  useEffect(() => {
    if (open) {
      setType(defaultType)
      setNom("")
      setTelephone("")
      setEmail("")
      setShowEntreprise(false)
      setRccm("")
      setContribuable("")
    }
  }, [open, defaultType])

  if (!open) return null

  const parent = TIERS_SYSCOHADA_PARENT[type]
  const suggested = suggest.data?.suffix_suggere ?? ""
  const codeFinal = suggested
    ? (suggest.data?.disponible
        ? `${parent}-${suggested}`
        : `${parent}-${suggest.data?.alternatives[0] ?? suggested}`)
    : parent

  async function handleSubmit() {
    if (nom.trim().length < 2) return
    const res = await create({
      nom:                  nom.trim(),
      type,
      telephone:            telephone.trim()         || null,
      email:                email.trim()             || null,
      raison_sociale:       null,
      numero_rccm:          numero_rccm.trim()         || null,
      numero_contribuable:  numero_contribuable.trim() || null,
      suffix_manuel:        null,                       // auto
      notes:                null,
    })
    if (res.ok) {
      toast.success(`Tiers créé · ${res.result.compte_syscohada_code}`)
      onCreated({ ...res.result, nom: nom.trim(), type })
      onClose()
    } else {
      toast.error(res.error)
    }
  }

  const inputCls = "w-full px-3 py-2 rounded-xl bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/60 transition"

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-black/55 backdrop-blur-sm overflow-y-auto"
         onClick={() => !loading && onClose()}>
      <div className="relative w-full max-w-md my-3 sm:my-0 rounded-2xl bg-white dark:bg-[#1a1b1f] border border-gray-200 dark:border-white/[0.08] shadow-2xl"
           onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-200 dark:border-white/[0.05]">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/30 flex-shrink-0">
              <ArrowRightLeft size={15} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-black text-gray-900 dark:text-white">Nouveau tiers (rapide)</h2>
              <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-snug mt-0.5">
                Création express + utilisation immédiate dans le formulaire.
              </p>
            </div>
            <button onClick={onClose} disabled={loading}
              className="w-7 h-7 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.05] inline-flex items-center justify-center transition disabled:opacity-50">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {/* Type pills */}
          <div>
            <label className="block text-[10.5px] font-bold uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400 mb-1.5">
              Type
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TYPES.map(t => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`px-2.5 py-1 rounded-md transition ${
                    type === t
                      ? "bg-indigo-500/15 ring-1 ring-indigo-500/30"
                      : "bg-gray-100 dark:bg-white/[0.05] hover:bg-indigo-500/10"
                  }`}>
                  <TiersTypeBadge type={t} size="xs" />
                </button>
              ))}
            </div>
          </div>

          {/* Nom */}
          <div>
            <label className="block text-[10.5px] font-bold uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400 mb-1.5">
              Nom <span className="text-red-500">*</span>
            </label>
            <input type="text" value={nom} onChange={e => setNom(e.target.value)}
              placeholder="Garage Atta Mécanique" className={inputCls} minLength={2} maxLength={200} autoFocus />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[10.5px] font-bold uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400 mb-1.5">Téléphone</label>
              <input type="tel" value={telephone} onChange={e => setTelephone(e.target.value)} className={inputCls} maxLength={30} />
            </div>
            <div>
              <label className="block text-[10.5px] font-bold uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400 mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} maxLength={120} />
            </div>
          </div>

          {/* Entreprise collapsible */}
          <details className="rounded-xl border border-gray-200/70 dark:border-white/[0.06]" open={showEntreprise}>
            <summary onClick={e => { e.preventDefault(); setShowEntreprise(v => !v) }}
              className="cursor-pointer select-none px-3 py-2 flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                Données entreprise (optionnel)
              </span>
              <ChevronDown size={12} className={`text-gray-400 transition ${showEntreprise ? "rotate-180" : ""}`} />
            </summary>
            <div className="px-3 pb-3 space-y-2">
              <input type="text" value={numero_rccm} onChange={e => setRccm(e.target.value)} placeholder="N° RCCM" className={inputCls} maxLength={60} />
              <input type="text" value={numero_contribuable} onChange={e => setContribuable(e.target.value)} placeholder="N° contribuable" className={inputCls} maxLength={60} />
            </div>
          </details>

          {/* Compta preview */}
          <div className="rounded-xl bg-violet-500/5 border border-violet-500/15 px-3 py-2 flex items-center justify-between">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-violet-700 dark:text-violet-300">
              Code SYSCOHADA
            </div>
            <div className="font-mono font-bold text-violet-700 dark:text-violet-300 tabular-nums">
              {codeFinal}
              {nom.trim() && suggest.loading && <Loader2 size={11} className="animate-spin inline ml-2 text-gray-400" />}
              <span className="text-[10px] text-gray-500 dark:text-gray-400 ml-1.5">auto</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-white/[0.05] bg-gray-50/50 dark:bg-white/[0.02] flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} disabled={loading}
            className="px-3 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition disabled:opacity-50">
            Annuler
          </button>
          <button type="button" onClick={handleSubmit} disabled={loading || nom.trim().length < 2}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white text-sm font-semibold shadow-md shadow-indigo-500/30 transition disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {loading ? "Création…" : "Créer & utiliser"}
          </button>
        </div>
      </div>
    </div>
  )
}
