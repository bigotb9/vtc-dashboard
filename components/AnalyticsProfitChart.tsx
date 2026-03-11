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

type ProfitJour = {
date: string
profit: number
}

export default function AnalyticsProfitChart(
{ data }: { data: ProfitJour[] }
){

return(

<div className="bg-white p-6 rounded-xl shadow">

<h2 className="text-lg font-semibold mb-4">
Evolution du profit
</h2>

<ResponsiveContainer width="100%" height={300}>

<LineChart data={data}>

<CartesianGrid strokeDasharray="3 3"/>

<XAxis dataKey="date"/>

<YAxis/>

<Tooltip
formatter={(v:number)=> v.toLocaleString()+" FCFA"}
/>

<Line
type="monotone"
dataKey="profit"
stroke="#22c55e"
strokeWidth={3}
/>

</LineChart>

</ResponsiveContainer>

</div>

)

}