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

type DepenseJour = {
date_depense: string
total_depenses: number
}

export default function DepensesJourChart(
{ data }: { data: DepenseJour[] }
){

return(

<div className="bg-white p-6 rounded-xl shadow">

<h2 className="text-lg font-semibold text-gray-800 mb-4">
Evolution des dépenses
</h2>

<ResponsiveContainer width="100%" height={300}>

<LineChart data={data}>

<CartesianGrid strokeDasharray="3 3"/>

<XAxis dataKey="date_depense"/>

<YAxis/>

<Tooltip
formatter={(v)=> Number(v).toLocaleString()+" FCFA"}
/>

<Line
type="monotone"
dataKey="total_depenses"
stroke="#ef4444"
strokeWidth={3}
/>

</LineChart>

</ResponsiveContainer>

</div>

)

}