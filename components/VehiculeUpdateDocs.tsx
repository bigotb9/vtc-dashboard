"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle, AlertCircle, RefreshCw } from "lucide-react"

type Props = {
  id: number
  initial: {
    km_actuel:               number | null
    km_derniere_vidange:     number | null
    date_derniers_pneus:     string | null
    date_assurance:          string | null
    date_expiration_assurance: string | null
    date_visite_technique:   string | null
    date_expiration_visite:  string | null
    date_carte_stationnement:             string | null
    date_expiration_carte_stationnement:  string | null
    date_patente:            string | null
    date_expiration_patente: string | null
  }
}

export default function VehiculeUpdateDocs({ id, initial }: Props) {

  const router = useRouter()
  const [loading, setSaving] = useState(false)
  const [status, setStatus]  = useState<"idle" | "success" | "error">("idle")
  const [errMsg, setErrMsg]  = useState("")

  const [form, setForm] = useState({
    km_actuel:               initial.km_actuel?.toString()           ?? "",
    km_derniere_vidange:     initial.km_derniere_vidange?.toString() ?? "",
    date_derniers_pneus:     initial.date_derniers_pneus             ?? "",
    date_assurance:          initial.date_assurance                  ?? "",
    date_expiration_assurance: initial.date_expiration_assurance     ?? "",
    date_visite_technique:   initial.date_visite_technique           ?? "",
    date_expiration_visite:  initial.date_expiration_visite          ?? "",
    date_carte_stationnement:            initial.date_carte_stationnement            ?? "",
    date_expiration_carte_stationnement: initial.date_expiration_carte_stationnement ?? "",
    date_patente:            initial.date_patente            ?? "",
    date_expiration_patente: initial.date_expiration_patente ?? "",
  })

  const set = (k: keyof typeof form, v: string) =>
    setForm(p => ({ ...p, [k]: v }))

  const inp = "w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 rounded-xl px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white"

  const handleSave = async () => {
    setSaving(true)
    setStatus("idle")

    const payload = {
      id,
      km_actuel:               form.km_actuel             !== "" ? Number(form.km_actuel)           : null,
      km_derniere_vidange:     form.km_derniere_vidange   !== "" ? Number(form.km_derniere_vidange) : null,
      date_derniers_pneus:     form.date_derniers_pneus     || null,
      date_assurance:          form.date_assurance           || null,
      date_expiration_assurance: form.date_expiration_assurance || null,
      date_visite_technique:   form.date_visite_technique   || null,
      date_expiration_visite:  form.date_expiration_visite  || null,
      date_carte_stationnement:            form.date_carte_stationnement            || null,
      date_expiration_carte_stationnement: form.date_expiration_carte_stationnement || null,
      date_patente:            form.date_patente            || null,
      date_expiration_patente: form.date_expiration_patente || null,
    }

    const res = await fetch("/api/vehicules/update", {
      method: "PATCH",
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    setSaving(false)

    if (data.success) {
      setStatus("success")
      router.refresh()
      setTimeout(() => setStatus("idle"), 3000)
    } else {
      setStatus("error")
      setErrMsg(data.error)
    }
  }

  return (
    <div className="space-y-5">

      {/* Kilométrage */}
      <div className="space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Kilométrage</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-gray-600 dark:text-gray-400">Kilométrage actuel (km)</label>
            <input type="number" min={0} placeholder="0" className={inp}
              value={form.km_actuel} onChange={e => set("km_actuel", e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-gray-600 dark:text-gray-400">Km à la dernière vidange</label>
            <input type="number" min={0} placeholder="0" className={inp}
              value={form.km_derniere_vidange} onChange={e => set("km_derniere_vidange", e.target.value)} />
          </div>

        </div>
      </div>

      {/* Dates */}
      <div className="space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Dates des documents</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-gray-600 dark:text-gray-400">Derniers pneus</label>
            <input type="date" className={inp}
              value={form.date_derniers_pneus} onChange={e => set("date_derniers_pneus", e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-gray-600 dark:text-gray-400">Date assurance</label>
            <input type="date" className={inp}
              value={form.date_assurance} onChange={e => set("date_assurance", e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-gray-600 dark:text-gray-400">Expiration assurance</label>
            <input type="date" className={inp}
              value={form.date_expiration_assurance} onChange={e => set("date_expiration_assurance", e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-gray-600 dark:text-gray-400">Date visite technique</label>
            <input type="date" className={inp}
              value={form.date_visite_technique} onChange={e => set("date_visite_technique", e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-gray-600 dark:text-gray-400">Expiration visite technique</label>
            <input type="date" className={inp}
              value={form.date_expiration_visite} onChange={e => set("date_expiration_visite", e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-gray-600 dark:text-gray-400">Date carte de stationnement</label>
            <input type="date" className={inp}
              value={form.date_carte_stationnement} onChange={e => set("date_carte_stationnement", e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-gray-600 dark:text-gray-400">Expiration carte de stationnement</label>
            <input type="date" className={inp}
              value={form.date_expiration_carte_stationnement} onChange={e => set("date_expiration_carte_stationnement", e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-gray-600 dark:text-gray-400">Date patente</label>
            <input type="date" className={inp}
              value={form.date_patente} onChange={e => set("date_patente", e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-gray-600 dark:text-gray-400">Expiration patente</label>
            <input type="date" className={inp}
              value={form.date_expiration_patente} onChange={e => set("date_expiration_patente", e.target.value)} />
          </div>

        </div>
      </div>

      {/* Feedback */}
      {status === "success" && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 text-sm">
          <CheckCircle size={16} /><span className="font-medium">Informations mises à jour avec succès</span>
        </div>
      )}
      {status === "error" && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          <AlertCircle size={16} /><span>{errMsg}</span>
        </div>
      )}

      {/* Bouton */}
      <button onClick={handleSave} disabled={loading}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold transition shadow-sm">
        {loading
          ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Mise à jour...</>
          : <><RefreshCw size={14} />Mettre à jour</>
        }
      </button>

    </div>
  )
}
