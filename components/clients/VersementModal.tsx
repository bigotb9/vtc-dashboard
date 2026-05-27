"use client"

/**
 * components/clients/VersementModal.tsx
 *
 * Modal de saisie d'un versement client mensuel.
 * Extrait au Lot T (audit 27/05/2026) depuis app/clients/page.tsx.
 *
 * - noBackdropClose=true : modal de saisie, ne ferme pas au clic backdrop
 * - cascade caisse/compte source pour le trigger Flux A (versement → operation)
 */

import { useEffect, useState } from "react"
import { AlertCircle, Banknote, Check, RefreshCw } from "lucide-react"
import { authFetch } from "@/lib/authFetch"
import ModalShell from "@/components/ModalShell"
import type { Client, Versement } from "@/types/clients"
import { fmt, moisLabel } from "@/types/clients"

type CaisseOption = { id: string; libelle: string; kind: "caisse" | "compte" }

type Props = {
  client:            Client
  mois:              string
  montantSuggere:    number
  versementExistant: Versement | null
  onClose:           () => void
  onSaved:           () => void
}

export default function VersementModal({
  client, mois, montantSuggere, versementExistant, onClose, onSaved,
}: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const [montant, setMontant]   = useState(String(versementExistant?.montant ?? Math.round(montantSuggere)))
  const [date, setDate]         = useState(versementExistant?.date_versement ?? today)
  const [notes, setNotes]       = useState(versementExistant?.notes ?? "")
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState("")
  // Cascade versements - caisse/compte source
  const [caisses, setCaisses]   = useState<CaisseOption[]>([])
  const [selKey, setSelKey]     = useState<string>("")  // format "kind:id"

  // Chargement de la liste caisses + comptes bancaires actifs (2 endpoints)
  useEffect(() => {
    const load = async () => {
      try {
        const [resC, resB] = await Promise.all([
          fetch("/api/compta/caisses?actif=true"),
          fetch("/api/compta/comptes?actif=true"),
        ])
        const dataC = await resC.json().catch(() => ({}))
        const dataB = await resB.json().catch(() => ({}))
        const opts: CaisseOption[] = []
        if (dataC.ok && Array.isArray(dataC.items)) {
          for (const x of dataC.items) {
            if (x.actif !== false) opts.push({ id: x.id, libelle: x.libelle, kind: "caisse" })
          }
        }
        if (dataB.ok && Array.isArray(dataB.items)) {
          for (const x of dataB.items) {
            if (x.actif !== false) opts.push({ id: x.id, libelle: x.libelle, kind: "compte" })
          }
        }
        setCaisses(opts)
        // Default : Wave Boyah
        const wave = opts.find(o => o.libelle === "Wave Boyah")
        if (wave) setSelKey(`${wave.kind}:${wave.id}`)
        else if (opts[0]) setSelKey(`${opts[0].kind}:${opts[0].id}`)
      } catch { /* silencieux : fallback Wave Boyah cote backend (trigger) */ }
    }
    load()
  }, [])

  const save = async () => {
    if (!montant || isNaN(Number(montant))) { setError("Montant invalide"); return }
    setLoading(true)
    try {
      const [kind, id] = selKey.split(":")
      const body: Record<string, unknown> = {
        id_client:      client.id,
        mois,
        montant:        Number(montant),
        date_versement: date,
        notes,
      }
      if (kind === "caisse" && id) body.caisse_id = id
      if (kind === "compte" && id) body.compte_id = id

      const res  = await authFetch("/api/clients/versements", {
        method:  "POST",
        body:    JSON.stringify(body),
      })
      const data = await res.json()
      if (data.ok) { onSaved() }
      else { setError(data.error || "Erreur"); setLoading(false) }
    } catch { setLoading(false) }
  }

  const inp = "w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"

  return (
    <ModalShell
      open
      onClose={onClose}
      title={`Versement — ${moisLabel(mois)}`}
      subtitle={client.nom}
      size="sm"
      noBackdropClose
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition">Annuler</button>
          <button onClick={save} disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition disabled:opacity-50">
            {loading ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
            {versementExistant ? "Modifier" : "Confirmer versement"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Montant suggéré */}
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl">
          <Banknote size={14} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <p className="text-xs text-emerald-700 dark:text-emerald-300">
            Net client calculé : <span className="font-bold">{fmt(montantSuggere)} FCFA</span>
          </p>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Montant versé (FCFA) *</label>
          <input type="number" className={inp} value={montant} onChange={e => setMontant(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Date du versement</label>
          <input type="date" className={inp} value={date} onChange={e => setDate(e.target.value)} />
        </div>
        {/* Cascade versements (24/05/2026) : dropdown Caisse / Compte source */}
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Caisse / Compte source *</label>
          <select className={inp} value={selKey} onChange={e => setSelKey(e.target.value)}>
            {caisses.length === 0 && <option value="">Chargement...</option>}
            {caisses.filter(o => o.kind === "caisse").length > 0 && (
              <optgroup label="Caisses">
                {caisses.filter(o => o.kind === "caisse").map(o => (
                  <option key={`caisse:${o.id}`} value={`caisse:${o.id}`}>{o.libelle}</option>
                ))}
              </optgroup>
            )}
            {caisses.filter(o => o.kind === "compte").length > 0 && (
              <optgroup label="Comptes bancaires">
                {caisses.filter(o => o.kind === "compte").map(o => (
                  <option key={`compte:${o.id}`} value={`compte:${o.id}`}>{o.libelle}</option>
                ))}
              </optgroup>
            )}
          </select>
          <p className="text-[10px] text-gray-400 mt-1">D&apos;où l&apos;argent part. Cette caisse sera débitée du montant.</p>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Notes (optionnel)</label>
          <input className={inp} placeholder="Virement Wave, espèces..." value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-xs text-red-600 dark:text-red-400">
            <AlertCircle size={12} />{error}
          </div>
        )}
      </div>
    </ModalShell>
  )
}
