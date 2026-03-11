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

type CAJour = {
date_recette: string
chiffre_affaire: number
}

export default function AnalyticsRevenueChart(
{ data }: { data: CAJour[] }
){

return(

<div className="bg-white p-6 rounded-xl shadow">

<h2 className="text-lg font-semibold mb-4">
Evolution du CA
</h2>

<ResponsiveContainer width="100%" height={300}>

<LineChart data={data}>

<CartesianGrid strokeDasharray="3 3"/>

<XAxis dataKey="date_recette"/>

<YAxis/>

<Tooltip
formatter={(v:number)=> v.toLocaleString()+" FCFA"}
/>

<Line
type="monotone"
dataKey="chiffre_affaire"
stroke="#3b82f6"
strokeWidth={3}
/>

</LineChart>

</ResponsiveContainer>

</div>

)

}