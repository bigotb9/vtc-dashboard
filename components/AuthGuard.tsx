"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import Image from "next/image"

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
        setLoading(false)
      }
    }

    checkSession()

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-[#080E1A]">
        <div className="flex flex-col items-center gap-5">
          {/* Logo avec pulse */}
          <div className="relative">
            <div className="w-20 h-20 rounded-full overflow-hidden animate-pulse">
              <Image src="/logo.png" alt="Boyah Group" width={80} height={80} className="object-cover" priority />
            </div>
            {/* Ring tournant */}
            <div className="absolute inset-[-6px] rounded-full border-2 border-transparent border-t-indigo-500 border-r-indigo-500/30 animate-spin" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Boyah Group</p>
            <p className="text-xs text-gray-400 dark:text-gray-600">Chargement en cours...</p>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
