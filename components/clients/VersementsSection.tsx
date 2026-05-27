"use client"

/**
 * components/clients/VersementsSection.tsx
 *
 * Section "Suivi des versements" affichée dans l'onglet Versements de la
 * ClientCard. Liste les 12 derniers mois avec leur statut de paiement.
 *
 * Extrait au Lot T (audit 27/05/2026) depuis app/clients/page.tsx.
 */

import { useCallback, useEffect, useState } from "react"
import {
  AlertCircle, Banknote, CalendarCheck, Check, Clock,
  Plus, RefreshCw, Trash2,
} from "lucide-react"
import { authFetch } from "@/lib/authFetch"
import VersementModal from "./VersementModal"
import type { Client, Versement } from "@/types/clients"
import {
  STATUS_CONFIG, derniersMois, fenetrePaiement, fmt,
  getVersementStatus, moisLabel,
} from "@/types/clients"

type Props = {
  client:        Client
  netClientMois: number
  moisActuel:    string
}

export default function VersementsSection({ client, netClientMois, moisActuel }: Props) {
  const [versements, setVersements] = useState<Versement[]>([])
  const [loadingV, setLoadingV]     = useState(true)
  const [modal, setModal]           = useState<{ mois: string; montantSuggere: number; existant: Versement | null } | null>(null)
  const [deleting, setDeleting]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadingV(true)
    const res  = await authFetch(`/api/clients/versements?id_client=${client.id}`)
    const data = await res.json()
    if (data.ok) setVersements(data.versements || [])
    setLoadingV(false)
  }, [client.id])

  useEffect(() => { load() }, [load])

  const moisListe = derniersMois(12)

  const getVersement = (m: string) => versements.find(v => v.mois === m) || null

  const annuler = async (mois: string) => {
    if (!confirm(`Annuler le versement de ${moisLabel(mois)} ?`)) return
    setDeleting(mois)
    await authFetch(`/api/clients/versements?id_client=${client.id}&mois=${mois}`, { method: "DELETE" })
    await load()
    setDeleting(null)
  }

  // Compteurs (basés sur la fenêtre de paiement 5-10 du mois suivant)
  const today        = new Date()
  const totalVerse   = versements.reduce((s, v) => s + Number(v.montant), 0)
  const nbPaye       = versements.length
  const nbEnAttente  = moisListe.filter(m => {
    const st = getVersementStatus(m, today, getVersement(m))
    return st === "a_verser" || st === "en_retard"
  }).length
  const nbEnRetard   = moisListe.filter(m => getVersementStatus(m, today, getVersement(m)) === "en_retard").length

  return (
    <div className="border-t border-gray-100 dark:border-[#1E2D45]">
      {/* En-tête section */}
      <div className="flex items-center justify-between px-5 py-3 bg-gray-50/50 dark:bg-white/[0.02] flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <CalendarCheck size={14} className="text-indigo-500" />
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Suivi des versements</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {nbPaye} payé{nbPaye > 1 ? "s" : ""}
          </span>
          {nbEnAttente > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="font-semibold text-amber-700 dark:text-amber-400">{nbEnAttente} à verser</span>
            </span>
          )}
          {nbEnRetard > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="font-bold text-red-600 dark:text-red-400">{nbEnRetard} en retard</span>
            </span>
          )}
          <span className="font-semibold text-gray-700 dark:text-gray-300">
            Total versé : {fmt(totalVerse)} F
          </span>
        </div>
      </div>

      {loadingV ? (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <RefreshCw size={16} className="animate-spin mr-2" />
          <span className="text-xs">Chargement…</span>
        </div>
      ) : (
        <div className="px-5 py-4">
          {/* Info règle de paiement */}
          <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/15">
            <Clock size={12} className="text-indigo-500 flex-shrink-0" />
            <p className="text-[11px] text-indigo-600 dark:text-indigo-400">
              Les versements sont dus <strong>entre le 5 et le 10 du mois suivant</strong> l&apos;exploitation.
            </p>
          </div>

          <div className="space-y-2">
            {moisListe.map(m => {
              const v          = getVersement(m)
              const isDeleting = deleting === m
              const today      = new Date()
              const status     = getVersementStatus(m, today, v)
              const cfg        = STATUS_CONFIG[status]
              const isFutur    = status === "futur"
              const canMark    = status !== "futur" && status !== "en_cours"
              const showAmount = status === "a_verser" || status === "en_retard" || status === "pas_encore_du"

              const btnClass =
                cfg.btnVariant === "danger"  ? "bg-red-500 hover:bg-red-600 text-white shadow-sm shadow-red-500/20" :
                cfg.btnVariant === "warn"    ? "bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/20" :
                cfg.btnVariant === "muted"   ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-500/30" :
                                               "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"

              return (
                <div key={m} className={`flex items-center justify-between px-4 py-3 rounded-xl border transition ${cfg.bg} ${cfg.border} ${isFutur ? "opacity-50" : ""} ${status === "a_verser" ? "ring-2 ring-amber-400/30" : ""}`}>
                  {/* Mois + badge */}
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.iconBg}`}>
                      {status === "deja_verse"    ? <Check size={14} className="text-white" /> :
                       status === "a_verser"      ? <Banknote size={13} className="text-white" /> :
                       status === "en_retard"     ? <AlertCircle size={13} className="text-white" /> :
                       status === "pas_encore_du" ? <Clock size={12} className="text-white" /> :
                       status === "en_cours"      ? <RefreshCw size={12} className="text-white" /> :
                                                    <Clock size={12} className="text-white" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold capitalize text-gray-800 dark:text-gray-200">
                        {moisLabel(m)}
                        <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase ${cfg.text} ${cfg.bg} border ${cfg.border}`}>
                          {cfg.label}
                        </span>
                      </p>
                      {v && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Versé le {new Date(v.date_versement).toLocaleDateString("fr-FR")}
                          {v.notes && ` · ${v.notes}`}
                        </p>
                      )}
                      {status === "a_verser" && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                          🟡 Fenêtre ouverte : {fenetrePaiement(m)}
                        </p>
                      )}
                      {status === "en_retard" && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                          ⚠ Retard — devait être payé avant le {fenetrePaiement(m).split("–")[1]}
                        </p>
                      )}
                      {status === "pas_encore_du" && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                          Fenêtre à partir du {fenetrePaiement(m).split("–")[0]}
                        </p>
                      )}
                      {status === "en_cours" && (
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
                          Exploitation en cours · fenêtre prévue {fenetrePaiement(m)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Montant + actions */}
                  <div className="flex items-center gap-3">
                    {v && (
                      <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        {fmt(v.montant)} F
                      </span>
                    )}
                    {!v && showAmount && (
                      <span className={`text-xs font-medium ${cfg.text}`}>
                        ≈ {fmt(m === moisActuel ? netClientMois : 0)} F
                      </span>
                    )}

                    {canMark && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setModal({ mois: m, montantSuggere: m === moisActuel ? netClientMois : (v?.montant ?? 0), existant: v })}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${btnClass}`}>
                          {v ? <><Check size={11} />Modifier</> : <><Plus size={11} />Marquer payé</>}
                        </button>
                        {v && (
                          <button
                            onClick={() => annuler(m)}
                            disabled={isDeleting}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition">
                            {isDeleting ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal versement */}
      {modal && (
        <VersementModal
          client={client}
          mois={modal.mois}
          montantSuggere={modal.montantSuggere}
          versementExistant={modal.existant}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}
