"use client"

import Link from "next/link"

type Vehicule = {
  id_vehicule: number
  immatriculation: string
  proprietaire: string
  statut: string
  ca_aujourdhui: number
  ca_mensuel: number
  profit: number
}

export default function VehiculesTable({
  vehicules,
}: {
  vehicules: Vehicule[]
}) {

  const formatMoney = (value: number) => {
    return value.toLocaleString("fr-FR") + " FCFA"
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">

      <h2 className="text-xl font-bold text-gray-800 mb-6">
        Flotte véhicules
      </h2>

      <table className="w-full text-sm">

        <thead>

          <tr className="border-b text-gray-500">

            <th className="text-left py-3">Immatriculation</th>

            <th className="text-left py-3">Propriétaire</th>

            <th className="text-left py-3">CA Aujourd'hui</th>

            <th className="text-left py-3">CA Mensuel</th>

            <th className="text-left py-3">Profit</th>

            <th className="text-left py-3">Statut</th>

            <th className="text-left py-3">Action</th>

          </tr>

        </thead>

        <tbody>

          {vehicules.map((v) => (

            <tr
              key={v.id_vehicule}
              className="border-b hover:bg-gray-50"
            >

              <td className="py-3 font-semibold text-gray-800">
                {v.immatriculation}
              </td>

              <td className="py-3 text-gray-600">
                {v.proprietaire || "-"}
              </td>

              <td className="py-3 text-green-600 font-semibold">
                {v.ca_aujourdhui
                  ? formatMoney(v.ca_aujourdhui)
                  : "-"}
              </td>

              <td className="py-3 text-blue-600 font-semibold">
                {v.ca_mensuel
                  ? formatMoney(v.ca_mensuel)
                  : "-"}
              </td>

              <td className="py-3 font-semibold">

                {v.profit >= 0 ? (

                  <span className="text-green-600">
                    {formatMoney(v.profit)}
                  </span>

                ) : (

                  <span className="text-red-600">
                    {formatMoney(v.profit)}
                  </span>

                )}

              </td>

              <td className="py-3">

                {v.statut === "ACTIF" ? (

                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">
                    ACTIF
                  </span>

                ) : (

                  <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs">
                    INACTIF
                  </span>

                )}

              </td>

              <td className="py-3">

                <Link
                  href={`/vehicules/${v.id_vehicule}`}
                  className="text-purple-600 hover:underline font-medium"
                >
                  Voir
                </Link>

              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>
  )
}