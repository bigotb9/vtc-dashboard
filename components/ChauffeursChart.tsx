"use client"

import {
BarChart,
Bar,
XAxis,
YAxis,
Tooltip,
ResponsiveContainer,
CartesianGrid
} from "recharts"

export default function ChauffeursChart({ data }){

return(

<div className="bg-white rounded-xl shadow p-6 border border-gray-100">

<h2 className="text-lg font-semibold text-gray-900 mb-4">
Performance des chauffeurs
</h2>

<ResponsiveContainer width="100%" height={220}>

<BarChart data={data}>

<CartesianGrid strokeDasharray="3 3" />

<XAxis
dataKey="nom"
tick={{fill:"#374151"}}
/>

<YAxis
tick={{fill:"#374151"}}
/>

<Tooltip/>

<Bar
dataKey="ca"
fill="#4f46e5"
/>

</BarChart>

</ResponsiveContainer>

</div>

)

}