import { supabase } from "@/lib/supabaseClient"
import RecettesTable from "@/components/RecettesTable"
import RecettesChart from "@/components/RecettesChart"
import Link from "next/link"

export default async function RecettesPage(){

/* RECUPERATION DES RECETTES */

const { data: recettes } = await supabase
.from("recettes_wave")
.select('*')
.order("Horodatage",{ascending:false})

/* KPI */

const totalRecettes =
(recettes || []).reduce((sum:number,r:any)=>
sum + (r["Montant net"] || 0)
,0)

const recettesAujourd =
(recettes || []).filter((r:any)=>{

const d = new Date(r["Horodatage"])
const today = new Date()

return(
d.getDate() === today.getDate() &&
d.getMonth() === today.getMonth() &&
d.getFullYear() === today.getFullYear()
)

}).reduce((sum:number,r:any)=> sum + (r["Montant net"] || 0),0)

const transactions = recettes?.length || 0

/* DATA GRAPH */

const graphData =
(recettes || []).map((r:any)=>({

date: r["Horodatage"],
montant: r["Montant net"]

}))

return(

<div className="space-y-6">

{/* HEADER + BOUTON */}

<div className="flex justify-between items-center">
  <div>
    <h1 className="text-2xl font-bold">Recettes</h1>
    <p className="text-gray-500 text-sm">
      Suivi des encaissements Wave
    </p>
  </div>

  <Link href="/recettes/create">
    <button className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg shadow">
      + Ajouter une recette
    </button>
  </Link>
</div>

{/* KPI */}

<div className="grid grid-cols-3 gap-6">

<div className="bg-white p-5 rounded-xl shadow">
<p className="text-sm text-gray-500">Recettes totales</p>
<p className="text-2xl font-bold text-green-600">
{totalRecettes.toLocaleString()} FCFA
</p>
</div>

<div className="bg-white p-5 rounded-xl shadow">
<p className="text-sm text-gray-500">Recettes aujourd'hui</p>
<p className="text-2xl font-bold text-blue-600">
{recettesAujourd.toLocaleString()} FCFA
</p>
</div>

<div className="bg-white p-5 rounded-xl shadow">
<p className="text-sm text-gray-500">Transactions</p>
<p className="text-2xl font-bold">
{transactions}
</p>
</div>

</div>

{/* GRAPH */}

<RecettesChart data={graphData} />

{/* TABLE */}

<RecettesTable recettes={recettes || []} />

</div>

)

}