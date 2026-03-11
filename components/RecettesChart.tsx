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

export default function RecettesChart({ data }){

return(

<div className="bg-white p-6 rounded-xl shadow">

<h2 className="text-lg font-semibold mb-4">
Evolution des recettes
</h2>

<ResponsiveContainer width="100%" height={250}>

<LineChart data={data}>

<CartesianGrid strokeDasharray="3 3"/>

<XAxis dataKey="date_recette"/>

<YAxis/>

<Tooltip
formatter={(v)=> v.toLocaleString()+" FCFA"}
/>

<Line
type="monotone"
dataKey="montant"
stroke="#16a34a"
strokeWidth={2}
/>

</LineChart>

</ResponsiveContainer>

</div>

)

}