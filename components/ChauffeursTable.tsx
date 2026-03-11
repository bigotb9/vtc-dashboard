"use client"

import Link from "next/link"

export default function ChauffeursTable({ chauffeurs, classement }){

const getCA = (nom:string)=>{

const chauffeur = classement?.find((c:any)=> c.nom === nom)

return chauffeur?.ca || 0

}

return(

<div className="bg-white rounded-xl shadow p-6">

<h2 className="text-xl font-semibold text-gray-900 mb-4">
Liste des chauffeurs
</h2>

<div className="max-h-[500px] overflow-y-auto">

<table className="w-full text-sm">

<thead className="border-b text-gray-700">

<tr>

<th className="text-left py-3">Chauffeur</th>
<th className="text-center">Téléphone</th>
<th className="text-center">Véhicule</th>
<th className="text-center">CA mensuel</th>
<th className="text-center">Statut</th>
<th className="text-center">Commentaire</th>
<th className="text-center">Action</th>

</tr>

</thead>

<tbody>

{chauffeurs.map((c:any)=>{

const ca = getCA(c.nom)

return(

<tr
key={c.id_chauffeur}
className="border-b hover:bg-gray-50"
>

<td className="py-3 font-medium text-gray-900">
{c.nom}
</td>

<td className="text-center text-gray-800">
{c.numero_wave || "-"}
</td>

<td className="text-center text-gray-800">
{c.immatriculation || "-"}
</td>

<td className="text-center text-blue-600 font-semibold">
{ca.toLocaleString()} FCFA
</td>

<td className="text-center">

<span className={`px-3 py-1 rounded-full text-xs font-semibold
${c.actif
? "bg-green-100 text-green-700"
: "bg-gray-200 text-gray-700"}
`}>

{c.actif ? "ACTIF" : "INACTIF"}

</span>

</td>

<td className="text-center text-gray-700">
{c.commentaire || "-"}
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