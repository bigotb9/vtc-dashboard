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

type ChauffeurPerformance = {
nom: string
ca: number
}

export default function AnalyticsChauffeursChart(
{ data }: { data: ChauffeurPerformance[] }
){

return(

<div className="bg-white p-6 rounded-xl shadow">

<h2 className="text-lg font-semibold text-gray-800 mb-4">
Performance chauffeurs
</h2>

<ResponsiveContainer width="100%" height={300}>

<BarChart data={data}>

<CartesianGrid strokeDasharray="3 3" />

<XAxis dataKey="nom" />

<YAxis />

<Tooltip
formatter={(value:number)=>
value.toLocaleString()+" FCFA"
}
/>

<Bar
dataKey="ca"
fill="#22c55e"
/>

</BarChart>

</ResponsiveContainer>

</div>

)

}