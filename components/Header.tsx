import { ThemeToggle } from "@/components/theme-toggle"

export default function Header() {
  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-2xl font-bold">
        🚗 Boyah Transport
      </h1>

      <ThemeToggle />
    </div>
  )
}