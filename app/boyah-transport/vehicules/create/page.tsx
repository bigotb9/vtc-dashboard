"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

export default function Page() {
  const router = useRouter()

  const [form, setForm] = React.useState({
    immatriculation: "",
    type_vehicule: "",
    proprietaire: "",
    statut: "ACTIF",
  })

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    try {
      const res = await fetch("/api/vehicules/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (data?.success) {
        router.push("/boyah-transport/vehicules")
      } else {
        alert(data?.error || "Erreur lors de la création")
      }
    } catch (err) {
      console.error(err)
      alert("Erreur serveur")
    }
  }

  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-2xl font-bold mb-4">
        Ajouter un véhicule
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Immatriculation"
          className="border p-2 w-full"
          value={form.immatriculation}
          onChange={(e) =>
            setForm({ ...form, immatriculation: e.target.value })
          }
        />

        <input
          type="text"
          placeholder="Type véhicule"
          className="border p-2 w-full"
          value={form.type_vehicule}
          onChange={(e) =>
            setForm({ ...form, type_vehicule: e.target.value })
          }
        />

        <input
          type="text"
          placeholder="Propriétaire"
          className="border p-2 w-full"
          value={form.proprietaire}
          onChange={(e) =>
            setForm({ ...form, proprietaire: e.target.value })
          }
        />

        <select
          className="border p-2 w-full"
          value={form.statut}
          onChange={(e) =>
            setForm({ ...form, statut: e.target.value })
          }
        >
          <option value="ACTIF">ACTIF</option>
          <option value="INACTIF">INACTIF</option>
        </select>

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Créer véhicule
        </button>
      </form>
    </div>
  )
}