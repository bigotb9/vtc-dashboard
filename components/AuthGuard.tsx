"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

export default function AuthGuard({ children }: { children: React.ReactNode }) {

  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {

    const checkSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          console.error("Supabase error:", error)
          router.push("/")
          return
        }

        if (!data.session) {
          router.push("/")
          return
        }

      } catch (err) {
        console.error("AuthGuard crash:", err)
        router.push("/")
        return
      } finally {
        // 🔥 CRUCIAL : toujours désactiver loading
        setLoading(false)
      }
    }

    checkSession()

  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Chargement...
      </div>
    )
  }

  return <>{children}</>
}