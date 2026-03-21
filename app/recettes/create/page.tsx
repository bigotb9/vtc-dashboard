"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Papa from "papaparse"

export default function CreateRecette(){

const router = useRouter()

const [loading,setLoading] = useState(false)

const [form,setForm] = useState({
  id_recette:"",
  Horodatage:"",
  "Montant net":0,
  "Montant brut":0,
  Frais:0,
  Solde:0,
  Devise:"XOF"
})

/* ---------------- AJOUT MANUEL ---------------- */

const handleSubmit = async (e:any)=>{
  e.preventDefault()

  const res = await fetch("/api/recettes/create",{
    method:"POST",
    body: JSON.stringify(form)
  })

  const data = await res.json()

  if(data.success){
    router.push("/recettes")
  }else{
    alert(data.error)
  }
}

/* ---------------- IMPORT CSV ---------------- */

const handleFileUpload = (e:any)=>{
  const file = e.target.files[0]

  if(!file) return

  setLoading(true)

  Papa.parse(file,{
    header:true,
    skipEmptyLines:true,

    complete: async (results:any)=>{

      const formattedData = results.data.map((row:any)=>({

        id_recette: row["ID"],
        Horodatage: row["Date"],

        "Montant net": Number(row["Montant net"]),
        "Montant brut": Number(row["Montant brut"]),
        Frais: Number(row["Frais"]),
        Solde: Number(row["Solde"]),
        Devise: "XOF"

      }))

      const res = await fetch("/api/recettes/import",{
        method:"POST",
        body: JSON.stringify(formattedData)
      })

      const data = await res.json()

      setLoading(false)

      if(data.success){
        alert("Import réussi ✅")
        router.push("/recettes")
      }else{
        alert(data.error)
      }

    }
  })
}

return(

<div className="p-6 max-w-lg space-y-6">

<h1 className="text-2xl font-bold">Ajouter des recettes</h1>

{/* ---------------- IMPORT CSV ---------------- */}

<div className="bg-gray-100 p-4 rounded">

<p className="font-medium mb-2">Importer un fichier CSV</p>

<input type="file" accept=".csv" onChange={handleFileUpload} />

{loading && <p className="text-sm text-gray-500">Import en cours...</p>}

</div>

{/* ---------------- FORMULAIRE ---------------- */}

<form onSubmit={handleSubmit} className="space-y-4">

<input placeholder="ID recette"
className="border p-2 w-full"
onChange={(e)=>setForm({...form,id_recette:e.target.value})}
/>

<input type="datetime-local"
className="border p-2 w-full"
onChange={(e)=>setForm({...form,Horodatage:e.target.value})}
/>

<input type="number"
placeholder="Montant net"
className="border p-2 w-full"
onChange={(e)=>setForm({...form,["Montant net"]:Number(e.target.value)})}
/>

<input type="number"
placeholder="Montant brut"
className="border p-2 w-full"
onChange={(e)=>setForm({...form,["Montant brut"]:Number(e.target.value)})}
/>

<input type="number"
placeholder="Frais"
className="border p-2 w-full"
onChange={(e)=>setForm({...form,Frais:Number(e.target.value)})}
/>

<input type="number"
placeholder="Solde"
className="border p-2 w-full"
onChange={(e)=>setForm({...form,Solde:Number(e.target.value)})}
/>

<button className="bg-purple-600 text-white px-4 py-2 rounded">
Créer recette
</button>

</form>

</div>

)
}