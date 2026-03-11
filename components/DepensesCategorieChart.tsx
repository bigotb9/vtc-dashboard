"use client"

import {
PieChart,
Pie,
Cell,
Tooltip,
ResponsiveContainer,
Legend
} from "recharts"

type DepenseCategorie = {
type_depense: string
total_depenses: number
}

export default function DepensesCategorieChart(
{ data }: { data: DepenseCategorie[] }
){

const COLORS = [
"#ef4444",
"#f97316",
"#eab308",
"#3b82f6",
"#10b981"
]

return(

<div className="bg-white p-6 rounded-xl shadow">

<h2 className="text-lg font-semibold text-gray-800 mb-4">
Dépenses par catégorie
</h2>

<ResponsiveContainer width="100%" height={300}>

<PieChart>

<Pie
data={data}
dataKey="total_depenses"
nameKey="type_depense"
outerRadius={110}
label
>

{data.map((entry,index)=>(

<Cell
key={index}
fill={COLORS[index % COLORS.length]}
/>

))}

</Pie>

<Tooltip
formatter={(v:number)=> v.toLocaleString()+" FCFA"}
/>

<Legend />

</PieChart>

</ResponsiveContainer>

</div>

)

}