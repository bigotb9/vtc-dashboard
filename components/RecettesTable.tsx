"use client"

type Recette = {
  "Horodatage": string
  "chauffeur": string
  "Montant net": number
}

export default function RecettesTable({ recettes }: { recettes: Recette[] }) {

  return (

    <div className="bg-white rounded-xl shadow p-6">

      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Liste des recettes
      </h2>

      <div className="max-h-[500px] overflow-y-auto">

        <table className="w-full text-sm">

          <thead className="border-b text-gray-900 font-semibold">
            <tr>
              <th className="text-left py-2">Date</th>
              <th className="text-center">Chauffeur</th>
              <th className="text-center">Montant</th>
            </tr>
          </thead>

          <tbody>

            {recettes.map((r, i) => {

              const date = r["Horodatage"]
                ? new Date(r["Horodatage"]).toLocaleDateString()
                : "-"

              const chauffeur = r["chauffeur"] || "-"

              const montant = Number(r["Montant net"] || 0)

              return (

                <tr
                  key={i}
                  className="border-b hover:bg-gray-50 transition"
                >

                  <td className="py-2 text-gray-800 font-medium">
                    {date}
                  </td>

                  <td className="text-center text-gray-800">
                    {chauffeur}
                  </td>

                  <td className="text-center font-semibold text-blue-600">
                    {montant.toLocaleString()} FCFA
                  </td>

                </tr>

              )

            })}

          </tbody>

        </table>

      </div>

    </div>

  )

}