import { supabase } from "@/lib/supabaseClient"

import DepensesTable from "../../components/DepensesTable"
import DepensesCategorieChart from "../../components/DepensesCategorieChart"
import DepensesJourChart from "../../components/DepensesJourChart"

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