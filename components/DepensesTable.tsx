"use client"

type Depense = {
id_depense: string
date_depense: string
montant: number
type_depense: string
description: string
immatriculation: string
}

export default function DepensesTable(
{ depenses }: { depenses: Depense[] }
){

return(

<div className="bg-white rounded-xl shadow p-6">

<h2 className="text-lg font-semibold text-gray-800 mb-4">
Liste des dépenses
</h2>

<div className="max-h-[400px] overflow-y-auto">

<table className="w-full text-sm">

<thead className="border-b text-gray-700">

<tr>

<th className="text-left py-2">
Date
</th>

<th className="text-center">
Véhicule
</th>

<th className="text-center">
Type
</th>

<th className="text-center">
Montant
</th>

<th className="text-center">
Description
</th>

</tr>

</thead>

<tbody>

{depenses.map(d => (

<tr
key={d.id_depense}
className="border-b hover:bg-gray-50"
>

<td className="py-2">
{new Date(d.date_depense).toLocaleDateString()}
</td>

<td className="text-center">
{d.immatriculation}
</td>

<td className="text-center">
{d.type_depense}
</td>

<td className="text-center font-semibold text-red-600">
{d.montant.toLocaleString()} FCFA
</td>

<td className="text-center">
{d.description}
</td>

</tr>

))}

</tbody>

</table>

</div>

</div>

)

}