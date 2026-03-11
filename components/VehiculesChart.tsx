"use client"

import {
LineChart,
Line,
XAxis,
YAxis,
Tooltip,
ResponsiveContainer
} from "recharts"

export default function VehiculesChart({data}:{data:any[]}){

return(

<div className="bg-white p-6 rounded-xl shadow">

<h2 className="text-lg font-semibold mb-4">
Chiffre d'affaires véhicules
</h2>

<ResponsiveContainer width="100%" height={300}>

<LineChart data={data}>

<XAxis dataKey="date_recette" />

<YAxis />

<Tooltip />

<Line
type="monotone"
dataKey="ca_jour"
stroke="#6366f1"
strokeWidth={3}
/>

</LineChart>

</ResponsiveContainer>

</div>

)

}