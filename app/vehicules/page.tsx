import { supabase } from "@/lib/supabaseClient"
import VehiclesTable from "@/components/VehiclesTable"
import VehiculesChart from "@/components/VehiculesChart"

export default async function VehiculesPage(){

/* KPI VEHICULES */

const { data: vehicules } = await supabase
.from("vue_dashboard_vehicules")
.select("*")

const totalVehicules = vehicules?.length || 0

const vehiculesActifs =
vehicules?.filter(v => v.statut === "ACTIF").length || 0

const caTotal =
vehicules?.reduce((sum,v)=> sum + (v.ca_mensuel || 0),0) || 0

const profitTotal =
vehicules?.reduce((sum,v)=> sum + (v.profit || 0),0) || 0

/* GRAPH DATA */

const { data: graph } = await supabase
.from("vue_ca_vehicule_jour")
.select("*")
.order("date_recette")

return(

<div className="space-y-6">

<div className="grid grid-cols-4 gap-6">

<div className="bg-white p-5 rounded-xl shadow">
<p className="text-sm text-gray-500">Total véhicules</p>
<p className="text-2xl font-bold">{totalVehicules}</p>
</div>

<div className="bg-white p-5 rounded-xl shadow">
<p className="text-sm text-gray-500">Véhicules actifs</p>
<p className="text-2xl font-bold text-green-600">
{vehiculesActifs}
</p>
</div>

<div className="bg-white p-5 rounded-xl shadow">
<p className="text-sm text-gray-500">CA flotte mensuel</p>
<p className="text-2xl font-bold text-blue-600">
{caTotal.toLocaleString()} FCFA
</p>
</div>

<div className="bg-white p-5 rounded-xl shadow">
<p className="text-sm text-gray-500">Profit flotte</p>
<p className="text-2xl font-bold text-purple-600">
{profitTotal.toLocaleString()} FCFA
</p>
</div>

</div>

<VehiclesTable vehicules={vehicules || []} />

<VehiculesChart data={graph || []} />

</div>

)

}