export const dynamic = 'force-dynamic'

import { supabaseAdmin } from "@/lib/supabaseAdmin"
import DepensesPageClient from "@/components/DepensesPageClient"

export default async function DepensesPage() {
  const [{ data: depenses }, { data: categorie }, { data: jours }] = await Promise.all([
    supabaseAdmin.from("vue_dashboard_depenses").select("*").order("date_depense", { ascending: false }),
    supabaseAdmin.from("vue_depenses_par_categorie").select("*"),
    supabaseAdmin.from("vue_depenses_journalieres").select("*").order("date_depense", { ascending: true }),
  ])

  return (
    <DepensesPageClient
      depenses={depenses || []}
      categories={categorie || []}
      jours={jours || []}
    />
  )
}
