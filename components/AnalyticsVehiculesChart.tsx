"use client"

import {
BarChart,
Bar,
XAxis,
YAxis,
Tooltip,
ResponsiveContainer
} from "recharts"

type VehiculeCA = {
immatriculation: string
ca_total: number
}

export default function AnalyticsVehiculesChart(
{ data }: { data: VehiculeCA[] }
){

return(

<div className="bg-white p-6 rounded-xl shadow">

<h2 className="text-lg font-semibold mb-4">
CA par véhicule
</h2>

<ResponsiveContainer width="100%" height={300}>

<BarChart data={data}>

<XAxis dataKey="immatriculation"/>

<YAxis/>

<Tooltip
formatter={(v:number)=> v.toLocaleString()+" FCFA"}
/>

<Bar
dataKey="ca_total"
fill="#6366f1"
/>

</BarChart>

</ResponsiveContainer>

</div>

)

}