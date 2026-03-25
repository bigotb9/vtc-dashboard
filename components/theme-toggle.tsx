"use client"

import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
        bg-gray-100 dark:bg-white/[0.06]
        border border-gray-200 dark:border-[#1E2D45]
        text-gray-500 dark:text-gray-400
        hover:text-gray-900 dark:hover:text-white
        hover:bg-gray-200 dark:hover:bg-white/10
        transition-all duration-150 text-xs font-medium"
    >
      {theme === "dark"
        ? <><Sun size={14} /><span>Clair</span></>
        : <><Moon size={14} /><span>Sombre</span></>
      }
    </button>
  )
}