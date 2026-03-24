import { supabase } from "@/lib/supabaseClient"
import ChauffeursTable from "@/components/ChauffeursTable"
import ChauffeursChart from "@/components/ChauffeursChart"
import TopChauffeurChart from "@/components/TopChauffeurChart"
import Link from "next/link"

export default async function ChauffeursPage(){

const { data: chauffeurs } = await supabase
.from("vue_chauffeurs_vehicules")
.select("*")

const totalChauffeurs = chauffeurs?.length || 0

const chauffeursActifs =
chauffeurs?.filter((c)=> c.actif === true).length || 0

const chauffeursInactifs =
chauffeurs?.filter((c)=> c.actif === false).length || 0

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

{/* HEADER + BOUTON */}

<div className="flex flex-wrap justify-between items-start gap-3">
  <div>
    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Chauffeurs</h1>
    <p className="text-gray-500 text-sm">
      Gestion des chauffeurs
    </p>
  </div>

  <Link href="/chauffeurs/create">
    <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow text-sm">
      + Ajouter un chauffeur
    </button>
  </Link>
</div>

{/* KPI */}

<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

<div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow border border-gray-100 dark:border-gray-800">

<p className="text-sm font-medium text-gray-600 dark:text-gray-400">
Total chauffeurs
</p>

<p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
{totalChauffeurs}
</p>

</div>

<div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow border border-gray-100 dark:border-gray-800">

<p className="text-sm font-medium text-gray-600 dark:text-gray-400">
Chauffeurs actifs
</p>

<p className="text-3xl font-bold text-green-600 mt-1">
{chauffeursActifs}
</p>

</div>

<div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow border border-gray-100 dark:border-gray-800">

<p className="text-sm font-medium text-gray-600 dark:text-gray-400">
Chauffeurs inactifs
</p>

<p className="text-3xl font-bold text-red-600 mt-1">
{chauffeursInactifs}
</p>

</div>

</div>

{/* GRAPH + TOP CHAUFFEUR */}

<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

<div className="lg:col-span-2 bg-white dark:bg-gray-900 p-5 rounded-xl shadow border border-gray-100 dark:border-gray-800">

<h2 className="text-lg font-semibold mb-4">
Performance chauffeurs
</h2>

<ChauffeursChart data={classement || []}/>

</div>

<div className="bg-white dark:bg-gray-900 p-5 rounded-xl shadow border border-gray-100 dark:border-gray-800">

<h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
🏆 Top chauffeur
</h2>

{topChauffeur && (

<div>

<p className="text-xl font-bold text-gray-900 dark:text-white">
{topChauffeur.nom}
</p>

<p className="text-xl font-bold text-green-600 break-words">
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