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

/* ---------------- TYPE DES DONNÉES ---------------- */

type ChauffeurPerformance = {
nom: string
ca: number
}

/* ---------------- TYPE DES PROPS ---------------- */

type Props = {
data: ChauffeurPerformance[]
}

export default function ChauffeursChart({ data }: Props){

return(

<div className="bg-white rounded-xl shadow p-6 border border-gray-100">

<h2 className="text-lg font-semibold text-gray-900 mb-4">
Performance des chauffeurs
</h2>

<ResponsiveContainer width="100%" height={320}>

<BarChart data={data}>

<CartesianGrid strokeDasharray="3 3" />

<XAxis
dataKey="nom"
tick={{fontSize:11}}
/>

<YAxis />

<Tooltip
formatter={(v)=>Number(v).toLocaleString()+" FCFA"}
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