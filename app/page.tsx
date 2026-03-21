"use client"

export const dynamic = "force-dynamic"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"
import { useRouter } from "next/navigation"

export default function LoginPage(){

const router = useRouter()

const [email,setEmail] = useState("")
const [password,setPassword] = useState("")
const [loading,setLoading] = useState(false)
const [error,setError] = useState("")

useEffect(()=>{

const checkSession = async()=>{

const { data } = await supabase.auth.getSession()

if(data.session){
router.push("/dashboard")
}

}

checkSession()

},[])

const login = async ()=>{

setLoading(true)
setError("")

const { error } = await supabase.auth.signInWithPassword({
email,
password
})

if(error){
setError(error.message)
setLoading(false)
return
}

router.push("/dashboard")

}

return(

<div
className="min-h-screen flex items-center justify-center bg-cover bg-center relative"
style={{
backgroundImage:"url('/login-bg.jpg')"
}}
>

<div className="absolute inset-0 bg-black/60"></div>

<div className="relative bg-white/95 backdrop-blur-xl p-10 rounded-2xl shadow-2xl w-96">

<h1 className="text-3xl font-bold text-center mb-2 text-gray-900">
VTC Dashboard
</h1>

<p className="text-gray-500 text-center mb-6">
Gestion intelligente de votre flotte
</p>

{/* EMAIL */}

<div className="relative mb-4">

<span className="absolute left-3 top-3 text-gray-400">
📧
</span>

<input
type="email"
placeholder="Email"
value={email}
onChange={(e)=>setEmail(e.target.value)}
className="w-full pl-10 border border-gray-300 bg-white text-gray-900 placeholder-gray-500 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
/>

</div>

{/* PASSWORD */}

<div className="relative mb-6">

<span className="absolute left-3 top-3 text-gray-400">
🔒
</span>

<input
type="password"
placeholder="Mot de passe"
value={password}
onChange={(e)=>setPassword(e.target.value)}
className="w-full pl-10 border border-gray-300 bg-white text-gray-900 placeholder-gray-500 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
/>

</div>

<button
onClick={login}
disabled={loading}
className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold p-3 rounded-lg transition shadow-md hover:shadow-lg"
>
{loading ? "Connexion..." : "Se connecter"}
</button>

{error &&(
<p className="text-red-500 text-sm mt-4 text-center">
{error}
</p>
)}

<p className="text-xs text-gray-400 text-center mt-6">
© 2026 BOYAH GROUP • Plateforme VTC
</p>

</div>

</div>

)

}