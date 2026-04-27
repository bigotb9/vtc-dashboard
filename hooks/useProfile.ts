"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import type { Profile, Permission } from "@/lib/profile"
import { getRolePermissions } from "@/lib/profile"

type UseProfileResult = {
  profile:    Profile | null
  loading:    boolean
  can:        (action: Permission | string) => boolean
  isDirecteur: boolean
  isAdmin:     boolean
}

export function useProfile(): UseProfileResult {
  const [profile, setProfile]   = useState<Profile | null>(null)
  const [perms, setPerms]       = useState<Record<string, boolean>>({})
  const [isDir, setIsDir]       = useState(false)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      if (p) {
        setProfile(p as Profile)
        setIsDir(p.role === "directeur")
        if (p.role !== "directeur") {
          const rolePerms = await getRolePermissions(p.role)
          setPerms(rolePerms)
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  return {
    profile,
    loading,
    // Le directeur a tout, sinon on consulte la matrice
    can:         (action) => isDir || perms[action] === true,
    isDirecteur: isDir,
    isAdmin:     profile?.role === "admin",
  }
}
