import { supabase } from "@/lib/supabaseClient"

export default async function VehiculePage({ params }: { params: { id: string } }) {

  const vehiculeId = parseInt(params.id)

  const { data, error } = await supabase
    .from("vehicules")
    .select("*")
    .eq("id_vehicule", vehiculeId)
    .maybeSingle()

  if (error) {
    console.error(error)
  }

  if (!data) {
    return (
      <div className="p-10 text-red-500 text-lg">
        Véhicule introuvable
      </div>
    )
  }

  return (

    <div className="p-8">

      <h1 className="text-2xl font-bold mb-6">
        Véhicule {data.immatriculation}
      </h1>

      <div className="bg-white p-6 rounded-xl shadow space-y-3">

        <p>
          <span className="font-semibold">Type :</span> {data.type_vehicule}
        </p>

        <p>
          <span className="font-semibold">Propriétaire :</span> {data.proprietaire}
        </p>

        <p>
          <span className="font-semibold">Statut :</span> {data.statut}
        </p>

      </div>

    </div>

  )
}