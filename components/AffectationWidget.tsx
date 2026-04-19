"use client"

import { useEffect, useState, useCallback } from "react"
import { Car, User, Link2, Link2Off, RefreshCw, CheckCircle, AlertCircle } from "lucide-react"
import Image from "next/image"
import Link from "next/link"

type Chauffeur = { id_chauffeur: number; nom: string; actif: boolean; photo?: string | null }
type Vehicule  = { id_vehicule: number; immatriculation: string; statut: string; type_vehicule?: string | null; photo?: string | null }
type Affectation = { id_affectation: number; id_chauffeur: number; id_vehicule: number; chauffeurs: Chauffeur | null; vehicules: Vehicule | null }

type Props =
  | { mode: "chauffeur"; id: number }
  | { mode: "vehicule";  id: number }

export default function AffectationWidget(props: Props) {
  const [affectations, setAffectations] = useState<Affectation[]>([])
  const [options, setOptions]           = useState<(Chauffeur | Vehicule)[]>([])
  const [selected, setSelected]         = useState("")
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [removing, setRemoving]         = useState<number | null>(null)
  const [status, setStatus]             = useState<"idle" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg]         = useState("")
  const [showForm, setShowForm]         = useState(false)

  const isChauffeurMode = props.mode === "chauffeur"
  // Véhicule peut avoir 2 chauffeurs max
  const canAddMore = isChauffeurMode
    ? affectations.length === 0          // chauffeur : 1 véhicule max
    : affectations.length < 2            // véhicule  : 2 chauffeurs max

  const reload = useCallback(async () => {
    const param = isChauffeurMode ? `id_chauffeur=${props.id}` : `id_vehicule=${props.id}`
    const res  = await fetch(`/api/affectations?${param}`)
    const data = await res.json()
    setAffectations(data.affectations || [])
  }, [props.id, isChauffeurMode])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [, optRes] = await Promise.all([
        reload(),
        fetch(isChauffeurMode ? "/api/vehicules/list" : "/api/chauffeurs/list"),
      ])
      const optData = await optRes.json()
      setOptions(isChauffeurMode ? (optData.vehicules || []) : (optData.chauffeurs || []))
      setLoading(false)
    }
    load()
  }, [props.id, isChauffeurMode, reload])

  const handleSave = async () => {
    if (!selected) return
    setSaving(true); setStatus("idle")
    const body = isChauffeurMode
      ? { id_chauffeur: props.id, id_vehicule: Number(selected) }
      : { id_chauffeur: Number(selected), id_vehicule: props.id }

    const res  = await fetch("/api/affectations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const data = await res.json()
    setSaving(false)
    if (data.success) {
      setStatus("success"); setShowForm(false); setSelected("")
      await reload()
      setTimeout(() => setStatus("idle"), 3000)
    } else {
      setStatus("error"); setErrorMsg(data.error || "Erreur")
    }
  }

  const handleRemove = async (idChauffeur: number) => {
    setRemoving(idChauffeur)
    const body = isChauffeurMode
      ? { id_chauffeur: props.id, id_vehicule: affectations[0]?.id_vehicule }
      : { id_chauffeur: idChauffeur, id_vehicule: props.id }
    const res  = await fetch("/api/affectations", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const data = await res.json()
    setRemoving(null)
    if (data.success) { await reload(); setStatus("success"); setTimeout(() => setStatus("idle"), 3000) }
    else { setStatus("error"); setErrorMsg(data.error || "Erreur") }
  }

  if (loading) return (
    <div className="flex items-center gap-2 text-sm text-gray-400">
      <RefreshCw size={13} className="animate-spin" /> Chargement…
    </div>
  )

  const label = isChauffeurMode ? "Véhicule affecté" : "Chauffeurs affectés"

  return (
    <div className="space-y-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
          {label}
          {!isChauffeurMode && (
            <span className="ml-2 text-gray-600 dark:text-gray-600 normal-case font-normal tracking-normal">
              ({affectations.length}/2)
            </span>
          )}
        </p>
        {canAddMore && (
          <button onClick={() => setShowForm(p => !p)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition">
            <Link2 size={11} /> {affectations.length === 0 ? "Affecter" : "Ajouter"}
          </button>
        )}
      </div>

      {/* Affectations actives */}
      {affectations.length === 0 ? (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-200 dark:border-gray-700">
          {isChauffeurMode ? <Car size={16} className="text-gray-300 dark:text-gray-600" /> : <User size={16} className="text-gray-300 dark:text-gray-600" />}
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">
            {isChauffeurMode ? "Aucun véhicule affecté" : "Aucun chauffeur affecté"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {affectations.map((aff) => {
            const item = isChauffeurMode ? aff.vehicules : aff.chauffeurs
            if (!item) return null
            const veh = item as Vehicule
            const ch  = item as Chauffeur
            const isVehicle = isChauffeurMode
            const removeId = aff.id_chauffeur

            return (
              <div key={aff.id_affectation} className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-indigo-100 dark:bg-indigo-900/30 flex-shrink-0 flex items-center justify-center">
                  {isVehicle ? (
                    veh.photo
                      ? <Image src={veh.photo} alt="" width={40} height={40} className="w-full h-full object-cover" />
                      : <Car size={18} className="text-indigo-400" />
                  ) : (
                    ch.photo
                      ? <Image src={ch.photo} alt="" width={40} height={40} className="w-full h-full object-cover rounded-xl" />
                      : <User size={18} className="text-indigo-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300 truncate">
                    {isVehicle ? veh.immatriculation : ch.nom}
                  </p>
                  <p className="text-xs text-indigo-500 dark:text-indigo-400">
                    {isVehicle
                      ? `${veh.type_vehicule || ""} · ${veh.statut}`
                      : ch.actif ? "Actif" : "Inactif"
                    }
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link
                    href={isVehicle ? `/vehicules/${veh.id_vehicule}` : `/chauffeurs/${ch.id_chauffeur}`}
                    className="text-[10px] font-semibold text-indigo-500 hover:text-indigo-700 transition underline underline-offset-2"
                  >
                    Voir
                  </Link>
                  <button
                    onClick={() => handleRemove(removeId)}
                    disabled={removing === removeId}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50"
                    title="Retirer"
                  >
                    {removing === removeId
                      ? <RefreshCw size={12} className="animate-spin" />
                      : <Link2Off size={12} />
                    }
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Formulaire d'ajout */}
      {showForm && (
        <div className="flex gap-2">
          <select value={selected} onChange={e => setSelected(e.target.value)}
            className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">— Choisir {isChauffeurMode ? "un véhicule" : "un chauffeur"} —</option>
            {(options as (Chauffeur & Vehicule)[]).map(o => (
              <option key={o.id_vehicule ?? o.id_chauffeur} value={o.id_vehicule ?? o.id_chauffeur}>
                {o.immatriculation ?? o.nom}
                {o.type_vehicule ? ` · ${o.type_vehicule}` : ""}
                {o.statut ? ` (${o.statut})` : ""}
              </option>
            ))}
          </select>
          <button onClick={handleSave} disabled={!selected || saving}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold transition flex items-center gap-1.5">
            {saving ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle size={13} />}
            Valider
          </button>
        </div>
      )}

      {/* Feedback */}
      {status === "success" && (
        <p className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle size={13} /> Affectation mise à jour
        </p>
      )}
      {status === "error" && (
        <p className="flex items-center gap-2 text-xs text-red-500">
          <AlertCircle size={13} /> {errorMsg}
        </p>
      )}
    </div>
  )
}
