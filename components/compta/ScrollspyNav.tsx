"use client"

/**
 * Scrollspy nav sticky (Écran 7 §2.2).
 *
 * Affiche les 5 sections en tabs, met en surbrillance celle visible via
 * IntersectionObserver, et scroll smooth au click. Sur mobile, le bandeau
 * est défilable horizontalement.
 */

import { useEffect, useRef, useState } from "react"

export type ScrollspyItem = {
  id:    string
  label: string
  /** Optionnel : icône JSX. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon?: any
}

type Props = {
  items: ScrollspyItem[]
}

export function ScrollspyNav({ items }: Props) {
  const [active, setActive] = useState<string>(items[0]?.id ?? "")
  const userClickRef = useRef<{ id: string; ts: number } | null>(null)

  useEffect(() => {
    if (items.length === 0) return

    const observer = new IntersectionObserver(
      entries => {
        // Si l'utilisateur vient de cliquer sur un tab → on respecte son choix
        // pendant 800ms (sinon le scroll smooth déclenche plusieurs intersections).
        if (userClickRef.current && Date.now() - userClickRef.current.ts < 800) return

        // Prendre l'entrée la plus visible
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible.length > 0) setActive(visible[0].target.id)
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.2, 0.5, 1] },
    )

    for (const it of items) {
      const el = document.getElementById(it.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [items])

  function handleClick(id: string) {
    userClickRef.current = { id, ts: Date.now() }
    setActive(id)
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  return (
    <nav
      aria-label="Sections paramètres"
      className="sticky top-0 z-30 -mx-2 sm:mx-0 backdrop-blur bg-white/85 dark:bg-[#0a0a0a]/85 border-b border-gray-200/70 dark:border-white/[0.05]"
    >
      <div className="overflow-x-auto scrollbar-none px-2 sm:px-0">
        <div className="inline-flex gap-1 py-2 min-w-max">
          {items.map(it => {
            const Icon = it.Icon
            const isActive = active === it.id
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => handleClick(it.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  isActive
                    ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 ring-1 ring-violet-500/20"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.04]"
                }`}
              >
                {Icon && <Icon size={12} />}
                {it.label}
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
