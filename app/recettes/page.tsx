export const dynamic = 'force-dynamic'

import { supabaseAdmin } from "@/lib/supabaseAdmin"
import RecettesPageClient from "@/components/RecettesPageClient"

export default async function RecettesPage() {
  const { data: recettes } = await supabaseAdmin
    .from("vue_recettes_vehicules")
    .select("*")
    .order("Horodatage", { ascending: false })

  return <RecettesPageClient recettes={recettes || []} />
}
