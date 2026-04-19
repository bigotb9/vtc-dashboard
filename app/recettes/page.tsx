export const dynamic = 'force-dynamic'

import { supabase } from "@/lib/supabaseClient"
import RecettesPageClient from "@/components/RecettesPageClient"

export default async function RecettesPage() {
  const { data: recettes } = await supabase
    .from("vue_recettes_vehicules")
    .select("*")
    .order("Horodatage", { ascending: false })

  return <RecettesPageClient recettes={recettes || []} />
}
