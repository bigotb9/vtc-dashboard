"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function CreateDepense(){

const router = useRouter()

const [form,setForm] = useState({
  date_depense:"",
  montant:0,
  type_depense:"",
  description:"",
  id_vehicule:""
})

const handleSubmit = async (e:any)=>{
  e.preventDefault()

  const res = await fetch("/api/depenses/create",{
    method:"POST",
    body: JSON.stringify(form)
  })

  const data = await res.json()

  if(data.success){
    router.push("/depenses")
  }else{
    alert(data.error)
  }
}

return(

<div className="p-6 max-w-lg">

<h1 className="text-2xl font-bold mb-4">Ajouter une dépense</h1>

<form onSubmit={handleSubmit} className="space-y-4">

<input type="date"
className="border p-2 w-full"
onChange={(e)=>setForm({...form,date_depense:e.target.value})}
/>

<input placeholder="Montant"
type="number"
className="border p-2 w-full"
onChange={(e)=>setForm({...form,montant:Number(e.target.value)})}
/>

<input placeholder="Type de dépense"
className="border p-2 w-full"
onChange={(e)=>setForm({...form,type_depense:e.target.value})}
/>

<input placeholder="Description"
className="border p-2 w-full"
onChange={(e)=>setForm({...form,description:e.target.value})}
/>

<input placeholder="ID véhicule"
className="border p-2 w-full"
onChange={(e)=>setForm({...form,id_vehicule:e.target.value})}
/>

<button className="bg-red-600 text-white px-4 py-2 rounded">
Créer dépense
</button>

</form>

</div>

)
}