/** @type {import('tailwindcss').Config} */
module.exports = {
  // Dark mode contrôlé par la classe "dark" sur <html>, posée par next-themes.
  // Sans ça, Tailwind utiliserait prefers-color-scheme (l'OS) et le toggle
  // n'aurait aucun effet visuel.
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      colors: {
        vtc: {
          bg:       { DEFAULT: "#080C14", card: "#0D1424", border: "#1E2D45", muted: "#1A2235" },
          profit:   { DEFAULT: "#10b981", light: "#ecfdf5", dark: "#065f46" },
          expense:  { DEFAULT: "#ef4444", light: "#fef2f2", dark: "#7f1d1d" },
          revenue:  { DEFAULT: "#6366f1", light: "#eef2ff", dark: "#3730a3" },
          vehicle:  { DEFAULT: "#0ea5e9", light: "#f0f9ff", dark: "#0c4a6e" },
          alert:    { DEFAULT: "#f59e0b", light: "#fffbeb", dark: "#78350f" },
        },
      },
      boxShadow: {
        "card":    "0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)",
        "card-lg": "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)",
      },
    },
  },
  plugins: [],
}