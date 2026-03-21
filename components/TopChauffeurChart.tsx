"use client"

import {
LineChart,
Line,
XAxis,
YAxis,
Tooltip,
ResponsiveContainer,
CartesianGrid
} from "recharts"

/* TYPE DES DONNÉES */

type Versement = {
date_recette: string
montant: number
}

/* TYPE DES PROPS */

type Props = {
data: Versement[]
}

export default function TopChauffeurChart({ data }: Props){

return(

<div className="mt-5">

<p className="text-sm text-gray-600 mb-2">
Versements journaliers
</p>

<ResponsiveContainer width="100%" height={120}>

<LineChart data={data}>

<CartesianGrid strokeDasharray="3 3"/>

<XAxis
dataKey="date_recette"
tick={{fill:"#374151",fontSize:11}}
/>

<YAxis hide/>

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

)

}