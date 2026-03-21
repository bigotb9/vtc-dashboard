"use client"

import {
LineChart,
Line,
XAxis,
YAxis,
Tooltip,
ResponsiveContainer
} from "recharts"

type Chauffeur = {
nom: string
ca: number
}

type Versement = {
date_recette: string
montant: number
}

type Props = {
classement?: Chauffeur[]
versements?: Versement[]
}

export default function TopChauffeurs({
classement = [],
versements = []
}: Props){

/* sécurisation */

const topChauffeur =
classement.length > 0
? classement[0]
: null

return(

<div className="bg-white p-6 rounded-xl shadow">

<h2 className="text-lg font-semibold mb-4">
🏆 Top chauffeur
</h2>

{topChauffeur ? (

<div className="space-y-4">

<div>

<p className="text-xl font-bold">
{topChauffeur.nom}
</p>

<p className="text-green-600 text-2xl font-bold">
{topChauffeur.ca.toLocaleString()} FCFA
</p>

</div>

<div>

<p className="text-sm text-gray-500 mb-2">
Versements journaliers
</p>

<ResponsiveContainer width="100%" height={120}>

<LineChart data={versements}>

<XAxis dataKey="date_recette" hide />

<YAxis hide />

<Tooltip
formatter={(v)=>Number(v).toLocaleString()+" FCFA"}
/>

<Line
dataKey="montant"
stroke="#22c55e"
strokeWidth={2}
/>

</LineChart>

</ResponsiveContainer>

</div>

</div>

) : (

<p className="text-gray-500">
Aucun chauffeur disponible
</p>

)}

</div>

)

}