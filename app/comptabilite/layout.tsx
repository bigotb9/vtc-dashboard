"use client"

/**
 * Layout client du module /comptabilite (Écran 9 Phase 3).
 *
 * Vérifie le flag `premier_login_effectue` au mount et redirige selon les
 * règles de la doc §4.3 :
 *   - flag=false & path=/comptabilite/onboarding → laisse passer
 *   - flag=false & path autre                    → redirect vers /onboarding
 *   - flag=true  & path=/comptabilite/onboarding → redirect vers /comptabilite
 *   - fetch fail                                 → laisse passer (dégradation gracieuse)
 *
 * Anti-boucle assurée par la condition stricte sur `pathname` avant tout
 * fetch ou redirect.
 *
 * Le check est côté client (au mount du layout) pour éviter la complexité
 * du middleware Edge runtime (cf. doc §4.1).
 */

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { authFetch } from "@/lib/authFetch"
import { FullscreenLoader } from "@/components/compta/FullscreenLoader"

const ONBOARDING_PATH = "/comptabilite/onboarding"

export default function ComptabiliteLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false
    setChecking(true)

    authFetch("/api/compta/parametres")
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (cancelled) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = json?.data ?? null
        const flag = data?.premier_login_effectue
        const onOnboarding = pathname === ONBOARDING_PATH

        if (flag === false && !onOnboarding) {
          // Forcer le wizard
          router.replace(ONBOARDING_PATH)
          return // ne pas setChecking(false) — la redirection va remount le layout
        }
        if (flag === true && onOnboarding) {
          // L'onboarding est déjà fait → renvoyer vers le dashboard
          router.replace("/comptabilite")
          return
        }
        setChecking(false)
      })
      .catch(() => {
        // Dégradation gracieuse : si fetch fail (réseau, auth, etc.), on
        // laisse l'utilisateur passer plutôt que de le bloquer.
        if (!cancelled) setChecking(false)
      })

    return () => { cancelled = true }
  }, [pathname, router])

  if (checking) {
    return <FullscreenLoader text="Chargement du module comptable…" />
  }
  return <>{children}</>
}
