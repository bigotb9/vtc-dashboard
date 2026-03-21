"use client"

import Link from "next/link"

/* ---------------- TYPES ---------------- */

type Chauffeur = {
  id_chauffeur: number
  nom: string
  numero_wave?: string
  actif: boolean
}

type Classement = {
  nom: string
  ca: number
}

/* ---------------- PROPS ---------------- */

type Props = {
  chauffeurs: Chauffeur[]
  classement: Classement[]
}

export default function ChauffeursTable({ chauffeurs, classement }: Props) {

  /* récupérer le CA d'un chauffeur */

  const getCA = (nom: string) => {
    const chauffeur = classement?.find((c) => c.nom === nom)
    return chauffeur?.ca || 0
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow">

      <h2 className="text-lg font-semibold mb-4">
        Liste des chauffeurs
      </h2>

      <div className="max-h-[500px] overflow-y-auto">

        <table className="w-full text-sm">

          <thead className="border-b text-gray-700">
            <tr>
              <th className="text-left py-2">Chauffeur</th>
              <th className="text-center">Téléphone</th>
              <th className="text-center">CA mensuel</th>
              <th className="text-center">Statut</th>
              <th className="text-center">Action</th>
            </tr>
          </thead>

          <tbody>

            {chauffeurs.map((c) => {

              const ca = getCA(c.nom)

              return (
                <tr key={c.id_chauffeur} className="border-b">

                  <td className="py-2">
                    {c.nom}
                  </td>

                  <td className="text-center">
                    {c.numero_wave || "-"}
                  </td>

                  <td className="text-center font-semibold text-blue-600">
                    {ca.toLocaleString()} FCFA
                  </td>

                  <td className="text-center">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        c.actif
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {c.actif ? "Actif" : "Inactif"}
                    </span>
                  </td>

                  <td className="text-center">
                    <Link
                      href={`/chauffeurs/${c.id_chauffeur}`}
                      className="text-blue-600 hover:underline"
                    >
                      Voir
                    </Link>
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