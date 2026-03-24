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
    <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow border border-gray-100 dark:border-gray-800">

      <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
        Liste des chauffeurs
      </h2>

      <div className="max-h-[500px] overflow-y-auto overflow-x-auto">

        <table className="w-full text-sm min-w-[480px]">

          <thead className="border-b border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
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
                <tr key={c.id_chauffeur} className="border-b border-gray-100 dark:border-gray-800">

                  <td className="py-2 text-gray-900 dark:text-white">
                    {c.nom}
                  </td>

                  <td className="text-center text-gray-600 dark:text-gray-400">
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