"use client"

export default function RecettesTable({ recettes }){

return(

<div className="bg-white rounded-xl shadow p-6">

<h2 className="text-lg font-semibold mb-4">
Liste des recettes
</h2>

<div className="max-h-[500px] overflow-y-auto">

<table className="w-full text-sm">

<thead className="border-b text-gray-700">

<tr>

<th className="text-left py-2">
Date
</th>

<th className="text-center">
Chauffeur
</th>

<th className="text-center">
Montant
</th>

</tr>

</thead>

<tbody>

{recettes.map((r)=>(

<tr
key={r.id}
className="border-b hover:bg-gray-50"
>

<td className="py-2 text-gray-800">
{new Date(r.date_recette).toLocaleDateString()}
</td>

<td className="text-center text-gray-800">
{r.chauffeur}
</td>

<td className="text-center text-green-600 font-semibold">
{r.montant.toLocaleString()} FCFA
</td>

</tr>

))}

</tbody>

</table>

</div>

</div>

)

}