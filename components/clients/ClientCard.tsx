"use client"

/**
 * components/clients/ClientCard.tsx
 *
 * Carte client expandable du module Clients (asset management).
 * 3 onglets internes : Finances / Versements / Documents.
 * Actions en bas : imprimer relevé PDF + sortir Client.
 *
 * Patch 23/05/2026 : badge retards (QW2), benefice cumule (B1), onglet
 * Documents (E1), bouton Imprimer Releve (QW1), bouton Sortir (E3).
 *
 * Extrait au Lot T (audit 27/05/2026) depuis app/clients/page.tsx.
 */

import { useCallback, useEffect, useState } from "react"
import {
  AlertTriangle, Archive, CalendarCheck, Car, ChevronDown, ChevronRight,
  Eye, FolderOpen, LogOut, Mail, Phone, Printer, RefreshCw, Trash2,
  TrendingUp, Upload,
} from "lucide-react"
import { authFetch } from "@/lib/authFetch"
import VersementsSection from "./VersementsSection"
import SortirClientModal from "./SortirClientModal"
import UploadDocumentModal from "./UploadDocumentModal"
import type { Client, ClientDocument, VehiculeStat } from "@/types/clients"
import { fmt, sign } from "@/types/clients"

// ── Ligne véhicule (interne à ClientCard) ────────────────────────────────────
function VehiculeRow({ v }: { v: VehiculeStat }) {
  const profitColor = v.profit_boyah >= 0
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-500 dark:text-red-400"
  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition text-xs">
      <td className="px-4 py-2.5 font-mono font-semibold text-gray-700 dark:text-gray-300">{v.immatriculation}</td>
      <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{fmt(v.montant_mensuel_client)} F</td>
      <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white">{fmt(v.revenu)} F</td>
      <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{fmt(v.total_depenses)} F</td>
      <td className="px-4 py-2.5">
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400">
          {fmt(v.boyah_support)} F
        </span>
      </td>
      <td className="px-4 py-2.5">
        {v.surplus_depense > 0
          ? <span className="text-red-500 dark:text-red-400">−{fmt(v.surplus_depense)} F</span>
          : <span className="text-gray-300 dark:text-gray-600">—</span>}
      </td>
      <td className="px-4 py-2.5 font-bold text-indigo-600 dark:text-indigo-400">{fmt(v.net_client)} F</td>
      <td className={`px-4 py-2.5 font-bold ${profitColor}`}>{sign(v.profit_boyah)} F</td>
    </tr>
  )
}

type Props = {
  client:     Client
  moisActuel: string
  onChange?:  () => void
}

export default function ClientCard({ client, moisActuel, onChange }: Props) {
  const [open, setOpen]     = useState(false)
  const [tab, setTab]       = useState<"finances" | "versements" | "documents">("finances")
  const [documents, setDocuments] = useState<ClientDocument[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [showSortirModal, setShowSortirModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)

  const retards = client.retards_count ?? 0
  const benefice = client.benefice_cumule ?? 0
  const beneficeMois = client.benefice_nb_mois ?? 0

  const loadDocuments = useCallback(async () => {
    setDocsLoading(true)
    try {
      const res = await authFetch(`/api/clients/${client.id}/documents`)
      const d = await res.json()
      if (d.ok) setDocuments(d.documents || [])
    } finally { setDocsLoading(false) }
  }, [client.id])

  useEffect(() => {
    if (open && tab === "documents") loadDocuments()
  }, [open, tab, loadDocuments])

  const handleImprimerReleve = async () => {
    // Lot A securite 26/05/2026 : la route /releve est maintenant protegee
    // par requirePermission. On recupere donc le PDF via authFetch (token
    // dans le header), puis on l'ouvre via un Object URL.
    try {
      const res = await authFetch(`/api/clients/${client.id}/releve/${moisActuel}`)
      if (!res.ok) {
        alert("Erreur lors de la generation du PDF")
        return
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      window.open(url, "_blank")
      // Liberation memoire apres ouverture (delai pour laisser le navigateur charger)
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      alert("Erreur reseau : " + (e as Error).message)
    }
  }

  const handleSupprimerDoc = async (docId: string) => {
    if (!confirm("Supprimer ce document ?")) return
    const res = await authFetch(`/api/clients/${client.id}/documents/${docId}`, { method: "DELETE" })
    const d = await res.json()
    if (d.ok) loadDocuments()
    else alert(d.error || "Erreur")
  }

  return (
    <div className={`bg-white dark:bg-[#0D1424] rounded-2xl border overflow-hidden ${open ? "border-indigo-200 dark:border-indigo-500/30" : "border-gray-100 dark:border-[#1E2D45]"} ${client.actif === false ? "opacity-60" : ""}`}>
      {/* En-tête client */}
      <button onClick={() => setOpen(p => !p)} className="w-full text-left">
        <div className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center text-white font-black text-base flex-shrink-0">
              {client.nom[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{client.nom}</p>
                {/* Badge retards (QW2) */}
                {retards > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400 text-[10px] font-bold uppercase tracking-wider">
                    <AlertTriangle size={9} />
                    {retards} mois en retard
                  </span>
                )}
                {/* Badge inactif */}
                {client.actif === false && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                    <Archive size={9} />
                    Inactif
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                {client.telephone && (
                  <span className="flex items-center gap-1 text-xs text-gray-400"><Phone size={10} />{client.telephone}</span>
                )}
                {client.email && (
                  <span className="flex items-center gap-1 text-xs text-gray-400"><Mail size={10} />{client.email}</span>
                )}
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Car size={10} />{client.vehicules.length} véhicule{client.vehicules.length > 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-8 mr-4">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">À verser</p>
              <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{fmt(client.totaux.net_client)} F</p>
            </div>
            <div className="text-right">
              {/* Benefice cumule (B1) */}
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Bénéfice cumulé</p>
              <p className={`text-sm font-bold ${benefice >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                {sign(benefice)} F
              </p>
              {beneficeMois > 0 && (
                <p className="text-[9px] text-gray-400">sur {beneficeMois} mois</p>
              )}
            </div>
          </div>

          {open ? <ChevronDown size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />}
        </div>
      </button>

      {/* Détail */}
      {open && (
        <div className="border-t border-gray-100 dark:border-[#1E2D45]">
          {/* Onglets */}
          <div className="flex border-b border-gray-100 dark:border-[#1E2D45] px-5">
            <button
              onClick={() => setTab("finances")}
              className={`flex items-center gap-1.5 px-1 py-3 text-xs font-bold border-b-2 transition mr-6 ${tab === "finances" ? "border-indigo-500 text-indigo-600 dark:text-indigo-400" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
              <TrendingUp size={12} />Finances du mois
            </button>
            <button
              onClick={() => setTab("versements")}
              className={`flex items-center gap-1.5 px-1 py-3 text-xs font-bold border-b-2 transition mr-6 ${tab === "versements" ? "border-emerald-500 text-emerald-600 dark:text-emerald-400" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
              <CalendarCheck size={12} />Versements
            </button>
            {/* Onglet Documents (E1) */}
            <button
              onClick={() => setTab("documents")}
              className={`flex items-center gap-1.5 px-1 py-3 text-xs font-bold border-b-2 transition ${tab === "documents" ? "border-purple-500 text-purple-600 dark:text-purple-400" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
              <FolderOpen size={12} />Documents
              {documents.length > 0 && (
                <span className="ml-1 px-1.5 rounded-full bg-gray-100 dark:bg-white/10 text-[10px] font-bold text-gray-600 dark:text-gray-400">
                  {documents.length}
                </span>
              )}
            </button>
          </div>

          {/* Onglet finances */}
          {tab === "finances" && (
            <>
              {client.vehicules.length === 0 ? (
                <div className="px-5 py-6 text-sm text-gray-400 text-center">Aucun véhicule sous gestion ce mois-ci.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px]">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-white/[0.02]">
                        {["Véhicule", "Montant mensuel", "Revenu", "Dépenses", "Charge Boyah (50k)", "Déduction client", "Net client", "Bénéfice Boyah"].map(h => (
                          <th key={h} className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-white/[0.03]">
                      {client.vehicules.map(v => <VehiculeRow key={v.id_vehicule} v={v} />)}
                      {client.vehicules.length > 1 && (
                        <tr className="bg-indigo-50/50 dark:bg-indigo-500/5 font-bold text-xs">
                          <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 font-black uppercase tracking-wider">Total</td>
                          <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">—</td>
                          <td className="px-4 py-2.5 text-gray-900 dark:text-white">{fmt(client.totaux.revenu)} F</td>
                          <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">{fmt(client.totaux.total_depenses)} F</td>
                          <td className="px-4 py-2.5 text-amber-700 dark:text-amber-400">{fmt(client.totaux.boyah_support)} F</td>
                          <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">—</td>
                          <td className="px-4 py-2.5 text-indigo-600 dark:text-indigo-400">{fmt(client.totaux.net_client)} F</td>
                          <td className={`px-4 py-2.5 ${client.totaux.profit_boyah >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                            {sign(client.totaux.profit_boyah)} F
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {client.notes && (
                <div className="px-5 py-3 bg-amber-50/50 dark:bg-amber-500/5 border-t border-gray-100 dark:border-[#1E2D45]">
                  <p className="text-xs text-gray-500"><span className="font-semibold">Notes :</span> {client.notes}</p>
                </div>
              )}
            </>
          )}

          {/* Onglet versements */}
          {tab === "versements" && (
            <VersementsSection
              client={client}
              netClientMois={client.totaux.net_client}
              moisActuel={moisActuel}
            />
          )}

          {/* Onglet Documents (E1) */}
          {tab === "documents" && (
            <div className="p-5">
              {docsLoading ? (
                <div className="py-6 text-center text-sm text-gray-400">
                  <RefreshCw size={16} className="inline-block animate-spin mr-2" />
                  Chargement des documents...
                </div>
              ) : documents.length === 0 ? (
                <div className="py-6 text-center">
                  <FolderOpen size={28} className="inline-block text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-sm text-gray-400">Aucun document archivé pour ce Client.</p>
                  <button onClick={() => setShowUploadModal(true)}
                    className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-100 transition">
                    <Upload size={12} />Ajouter un document
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {documents.map(d => {
                      const isPdf = d.mime_type === "application/pdf"
                      const typeLabel: Record<string, string> = {
                        contrat: "Contrat", cni: "CNI", carte_grise: "Carte grise",
                        assurance: "Assurance", justificatif: "Justificatif",
                        etat_comptes_sortie: "État comptes", autre: "Autre",
                      }
                      return (
                        <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition group">
                          <div className={`w-10 h-12 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                            isPdf
                              ? "bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400"
                              : "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          }`}>
                            {isPdf ? "PDF" : "IMG"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">{d.nom_fichier}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {typeLabel[d.type] || d.type} · {fmt(d.taille / 1024)} Ko
                              {d.auto_genere && <span className="ml-1 text-indigo-500">· auto</span>}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            {d.download_url && (
                              <a href={d.download_url} target="_blank" rel="noreferrer"
                                 className="p-1.5 rounded-md text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition">
                                <Eye size={13} />
                              </a>
                            )}
                            {!d.auto_genere && (
                              <button onClick={() => handleSupprimerDoc(d.id)}
                                className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition">
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <button onClick={() => setShowUploadModal(true)}
                    className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-100 transition">
                    <Upload size={12} />Ajouter un document
                  </button>
                </>
              )}
            </div>
          )}

          {/* Barre d'actions en bas (QW1 + E3) */}
          {client.actif !== false && (
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-gray-100 dark:border-[#1E2D45] bg-gray-50/30 dark:bg-white/[0.01]">
              <button onClick={handleImprimerReleve}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-[#0D1424] border border-gray-200 dark:border-[#1E2D45] text-sm font-semibold text-gray-700 dark:text-gray-300 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition shadow-sm">
                <Printer size={13} />Relevé du mois (PDF)
              </button>
              <button onClick={() => setShowSortirModal(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/15 transition">
                <LogOut size={13} />Sortir ce Client
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modals (E1 + E3) */}
      {showSortirModal && (
        <SortirClientModal
          client={client}
          onClose={() => setShowSortirModal(false)}
          onSuccess={() => { setShowSortirModal(false); onChange?.() }}
        />
      )}
      {showUploadModal && (
        <UploadDocumentModal
          clientId={client.id}
          onClose={() => setShowUploadModal(false)}
          onUploaded={() => { setShowUploadModal(false); loadDocuments() }}
        />
      )}
    </div>
  )
}
