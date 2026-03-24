import { supabase } from "@/lib/supabaseClient"
import CreateDepenseForm from "@/components/CreateDepenseForm"

export default async function CreateDepensePage() {

  /* récupère la liste des véhicules pour le select */
  const { data: vehicules } = await supabase
    .from("vehicules")
    .select("id_vehicule, immatriculation, proprietaire")
    .order("immatriculation")

  return <CreateDepenseForm vehicules={vehicules || []} />
}
