import { supabase } from "@/lib/supabaseClient"

import DepensesTable from "../../components/DepensesTable"
import DepensesCategorieChart from "../../components/DepensesCategorieChart"
import DepensesJourChart from "../../components/DepensesJourChart"
import Link from "next/link"

export default async function DepensesPage(){

/* ---------------- KPI ---------------- */

const { data: depenses } = await supabase
.from("vue_dashboard_depenses")
.select("*")

const { data: categorie } = await supabase
.from("vue_depenses_par_categorie")
.select("*")

const { data: jours } = await supabase
.from("vue_depenses_journalieres")
.select("*")

const totalDepenses =
depenses?.reduce((sum,d)=> sum + (d.montant || 0),0) || 0

const totalOperations = depenses?.length || 0

const depensesMoyenne =
totalOperations > 0 ? totalDepenses / totalOperations : 0


return(

<div className="space-y-6">

{/* HEADER + BOUTON */}

<div className="flex justify-between items-center">
  <div>
    <h1 className="text-2xl font-bold">Dépenses</h1>
    <p className="text-gray-500 text-sm">
      Suivi des coûts et charges
    </p>
  </div>

  <Link href="/depenses/create">
    <button className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg shadow">
      + Ajouter une dépense
    </button>
  </Link>
</div>

{/* ---------------- KPI ---------------- */}

<div className="grid grid-cols-3 gap-6">

<div className="bg-white p-6 rounded-xl shadow">

<p className="text-gray-600 text-sm">
Total dépenses
</p>

<p className="text-2xl font-bold text-red-600">
{totalDepenses.toLocaleString()} FCFA
</p>

</div>


<div className="bg-white p-6 rounded-xl shadow">

<p className="text-gray-600 text-sm">
Nombre d'opérations
</p>

<p className="text-2xl font-bold">
{totalOperations}
</p>

</div>


<div className="bg-white p-6 rounded-xl shadow">

<p className="text-gray-600 text-sm">
Dépense moyenne
</p>

<p className="text-2xl font-bold text-orange-600">
{depensesMoyenne.toLocaleString()} FCFA
</p>

</div>

</div>


{/* ---------------- GRAPHIQUES ---------------- */}

<div className="grid grid-cols-2 gap-6">

<DepensesCategorieChart data={categorie || []} />

<DepensesJourChart data={jours || []} />

</div>


{/* ---------------- TABLE ---------------- */}

<DepensesTable depenses={depenses || []} />

</div>

)

}