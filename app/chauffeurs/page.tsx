import { supabase } from "@/lib/supabaseClient"
import ChauffeursTable from "@/components/ChauffeursTable"
import ChauffeursChart from "@/components/ChauffeursChart"
import TopChauffeurChart from "@/components/TopChauffeurChart"

export default async function ChauffeursPage(){

const { data: chauffeurs } = await supabase
.from("vue_chauffeurs_vehicules")
.select("*")

const totalChauffeurs = chauffeurs?.length || 0

const chauffeursActifs =
chauffeurs?.filter((c:any)=> c.actif === true).length || 0

const chauffeursInactifs =
chauffeurs?.filter((c:any)=> c.actif === false).length || 0


/* CLASSEMENT */

const { data: classement } = await supabase
.from("classement_chauffeurs")
.select("*")
.order("ca",{ascending:false})


const topChauffeur = classement?.[0]


/* VERSEMENTS TOP CHAUFFEUR */

let versementsTop = []

if(topChauffeur){

const { data } = await supabase
.from("vue_ca_chauffeur_jour")
.select("*")
.eq("nom",topChauffeur.nom)

versementsTop = data || []

}


return(

<div className="space-y-6">

{/* KPI */}

<div className="grid grid-cols-3 gap-6">

<div className="bg-white p-6 rounded-xl shadow border border-gray-100">

<p className="text-sm font-medium text-gray-600">
Total chauffeurs
</p>

<p className="text-3xl font-bold text-gray-900 mt-1">
{totalChauffeurs}
</p>

</div>


<div className="bg-white p-6 rounded-xl shadow border border-gray-100">

<p className="text-sm font-medium text-gray-600">
Chauffeurs actifs
</p>

<p className="text-3xl font-bold text-green-600 mt-1">
{chauffeursActifs}
</p>

</div>


<div className="bg-white p-6 rounded-xl shadow border border-gray-100">

<p className="text-sm font-medium text-gray-600">
Chauffeurs inactifs
</p>

<p className="text-3xl font-bold text-red-600 mt-1">
{chauffeursInactifs}
</p>

</div>

</div>


{/* GRAPH + TOP CHAUFFEUR */}

<div className="grid grid-cols-3 gap-6">

<div className="col-span-2 bg-white p-5 rounded-xl shadow">

<h2 className="text-lg font-semibold mb-4">
Performance chauffeurs
</h2>

<ChauffeursChart data={classement || []}/>

</div>


<div className="bg-white p-5 rounded-xl shadow">

<h2 className="text-lg font-semibold mb-4">
🏆 Top chauffeur
</h2>

{topChauffeur && (

<div>

<p className="text-xl font-bold">
{topChauffeur.nom}
</p>

<p className="text-2xl font-bold text-green-600">
{topChauffeur.ca.toLocaleString()} FCFA
</p>

<TopChauffeurChart data={versementsTop}/>

</div>

)}

</div>

</div>


{/* TABLE */}

<ChauffeursTable
chauffeurs={chauffeurs || []}
classement={classement || []}
/>

</div>

)

}