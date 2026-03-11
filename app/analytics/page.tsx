import { supabase } from "@/lib/supabaseClient"

import AnalyticsRevenueChart from "../../components/AnalyticsRevenueChart"
import AnalyticsProfitChart from "../../components/AnalyticsProfitChart"
import AnalyticsVehiculesChart from "../../components/AnalyticsVehiculesChart"
import AnalyticsChauffeursChart from "../../components/AnalyticsChauffeursChart"

export default async function AnalyticsPage(){

/* ---------------- CA TOTAL ---------------- */

const { data: recettes } = await supabase
.from("recettes_wave")
.select('*')

const caTotal =
recettes?.reduce(
(sum,r)=> sum + (r["Montant net"] || 0),
0
) || 0


/* ---------------- DEPENSES ---------------- */

const { data: depenses } = await supabase
.from("depenses_vehicules")
.select("montant")

const depensesTotal =
depenses?.reduce(
(sum,d)=> sum + (d.montant || 0),
0
) || 0


/* ---------------- PROFIT ---------------- */

const profitTotal = caTotal - depensesTotal

const marge =
caTotal > 0
? (profitTotal / caTotal) * 100
: 0


/* ---------------- DATA GRAPHS ---------------- */

const { data: caJour } = await supabase
.from("vue_ca_journalier")
.select("*")
.order("date_recette")

const { data: profitJour } = await supabase
.from("vue_profit_journalier")
.select("*")
.order("date_recette")

const { data: vehicules } = await supabase
.from("vue_ca_vehicules")
.select("*")

const { data: chauffeurs } = await supabase
.from("classement_chauffeurs")
.select("*")



return(

<div className="space-y-6">

{/* KPI */}

<div className="grid grid-cols-4 gap-6">

<div className="bg-white p-6 rounded-xl shadow">

<p className="text-sm text-gray-500">
CA Total
</p>

<p className="text-2xl font-bold text-blue-600">
{caTotal.toLocaleString()} FCFA
</p>

</div>


<div className="bg-white p-6 rounded-xl shadow">

<p className="text-sm text-gray-500">
Dépenses
</p>

<p className="text-2xl font-bold text-red-600">
{depensesTotal.toLocaleString()} FCFA
</p>

</div>


<div className="bg-white p-6 rounded-xl shadow">

<p className="text-sm text-gray-500">
Profit
</p>

<p className={`text-2xl font-bold ${
profitTotal >= 0
? "text-green-600"
: "text-red-600"
}`}>
{profitTotal.toLocaleString()} FCFA
</p>

</div>


<div className="bg-white p-6 rounded-xl shadow">

<p className="text-sm text-gray-500">
Marge
</p>

<p className="text-2xl font-bold text-purple-600">
{marge.toFixed(1)} %
</p>

</div>

</div>


{/* GRAPHIQUES */}

<div className="grid grid-cols-2 gap-6">

<AnalyticsRevenueChart data={caJour || []} />

<AnalyticsProfitChart data={profitJour || []} />

</div>


<div className="grid grid-cols-2 gap-6">

<AnalyticsVehiculesChart data={vehicules || []} />

<AnalyticsChauffeursChart data={chauffeurs || []} />

</div>

</div>

)

}