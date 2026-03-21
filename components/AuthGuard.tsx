"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

export default function AuthGuard({ children }: { children: React.ReactNode }){

const router = useRouter()
const [loading,setLoading] = useState(true)

useEffect(()=>{

const checkSession = async ()=>{

const { data } = await supabase.auth.getSession()

if(!data.session){
router.push("/")
return
}

setLoading(false)

}

checkSession()

},[])

if(loading){
return(
<div className="flex items-center justify-center min-h-screen">
Chargement...
</div>
)
}

return <>{children}</>

}