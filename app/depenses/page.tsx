export const dynamic = 'force-dynamic'

import { supabase } from "@/lib/supabaseClient"
import DepensesPageClient from "@/components/DepensesPageClient"

export default async function DepensesPage() {
  const [{ data: depenses }, { data: categorie }, { data: jours }] = await Promise.all([
    supabase.from("vue_dashboard_depenses").select("*").order("date_depense", { ascending: false }),
    supabase.from("vue_depenses_par_categorie").select("*"),
    supabase.from("vue_depenses_journalieres").select("*").order("date_depense", { ascending: true }),
  ])

  return (
    <DepensesPageClient
      depenses={depenses || []}
      categories={categorie || []}
      jours={jours || []}
    />
  )
}
