import { supabase } from "@/lib/supabaseClient"

export default async function ChauffeurPage({params}:{params:{id:string}}){

  const { data } = await supabase
    .from("chauffeurs")
    .select("*")
    .eq("id_chauffeur",params.id)
    .single()

  if(!data){

    return(
      <div className="p-10 text-red-500">
        Chauffeur introuvable
      </div>
    )

  }

  return(

    <div className="p-8 space-y-6">

      <h1 className="text-2xl font-bold">
        Profil chauffeur
      </h1>

      <div className="bg-white p-6 rounded-xl shadow flex gap-6">

        <img
          src={data.photo || "/avatar.png"}
          className="w-32 h-32 rounded-full object-cover"
        />

        <div className="space-y-2">

          <p><b>Nom :</b> {data.nom}</p>

          <p><b>Téléphone :</b> {data.telephone}</p>

          <p><b>Permis :</b> {data.numero_permis}</p>

          <p><b>Date arrivée :</b> {data.date_arrivee}</p>

          <p><b>Statut matrimonial :</b> {data.statut_matrimonial}</p>

          <p><b>Nombre d'enfants :</b> {data.nombre_enfants}</p>

          <p><b>Adresse :</b> {data.adresse}</p>

        </div>

      </div>

    </div>

  )

}