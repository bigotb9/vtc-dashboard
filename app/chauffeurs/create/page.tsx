"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function CreateChauffeur(){

const router = useRouter()

const [form,setForm] = useState({
  nom:"",
  numero_wave:"",
  actif:true,
  commentaire:""
})

const handleSubmit = async (e:any)=>{
  e.preventDefault()

  const res = await fetch("/api/chauffeurs/create",{
    method:"POST",
    body: JSON.stringify(form)
  })

  const data = await res.json()

  if(data.success){
    router.push("/chauffeurs")
  }else{
    alert(data.error)
  }
}

return(

<div className="p-6 max-w-lg">

<h1 className="text-2xl font-bold mb-4">Ajouter un chauffeur</h1>

<form onSubmit={handleSubmit} className="space-y-4">

<input
placeholder="Nom"
className="border p-2 w-full"
onChange={(e)=>setForm({...form,nom:e.target.value})}
/>

<input
placeholder="Numéro Wave"
className="border p-2 w-full"
onChange={(e)=>setForm({...form,numero_wave:e.target.value})}
/>

<select
className="border p-2 w-full"
onChange={(e)=>setForm({...form,actif:e.target.value === "true"})}
>
<option value="true">Actif</option>
<option value="false">Inactif</option>
</select>

<textarea
placeholder="Commentaire"
className="border p-2 w-full"
onChange={(e)=>setForm({...form,commentaire:e.target.value})}
/>

<button className="bg-green-600 text-white px-4 py-2 rounded">
Créer chauffeur
</button>

</form>

</div>

)
}