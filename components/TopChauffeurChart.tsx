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

export default function TopChauffeurChart({ data }){

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

<Tooltip/>

<Line
type="monotone"
dataKey="ca_jour"
stroke="#16a34a"
strokeWidth={2}
dot={false}
/>

</LineChart>

</ResponsiveContainer>

</div>

)

}