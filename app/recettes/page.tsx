import { supabase } from "@/lib/supabaseClient"
import RecettesTable from "@/components/RecettesTable"
import RecettesChart from "@/components/RecettesChart"

export default async function RecettesPage(){

const { data: recettes } = await supabase
.from("vue_dashboard_recettes")
.select("*")
.order("date_recette",{ascending:false})

/* KPI */

const totalRecettes = recettes?.reduce(
(sum,r)=> sum + r.montant,0
) || 0

const recettesAujourdhui = recettes?.filter(r=>{

const today = new Date().toISOString().slice(0,10)

return r.date_recette?.startsWith(today)

}).reduce((sum,r)=> sum + r.montant,0) || 0


const totalTransactions = recettes?.length || 0

return(

<div className="space-y-6">

{/* KPI */}

<div className="grid grid-cols-3 gap-6">

<div className="bg-white p-6 rounded-xl shadow">

<p className="text-sm text-gray-500">
Recettes totales
</p>

<p className="text-2xl font-bold text-green-600">
{totalRecettes.toLocaleString()} FCFA
</p>

</div>


<div className="bg-white p-6 rounded-xl shadow">

<p className="text-sm text-gray-500">
Recettes aujourd'hui
</p>

<p className="text-2xl font-bold text-blue-600">
{recettesAujourdhui.toLocaleString()} FCFA
</p>

</div>


<div className="bg-white p-6 rounded-xl shadow">

<p className="text-sm text-gray-500">
Transactions
</p>

<p className="text-2xl font-bold text-gray-900">
{totalTransactions}
</p>

</div>

</div>


{/* GRAPH */}

<RecettesChart data={recettes || []}/>


{/* TABLE */}

<RecettesTable recettes={recettes || []}/>

</div>

)

}