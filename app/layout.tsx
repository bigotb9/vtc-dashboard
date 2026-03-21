import "./globals.css"
import Sidebar from "@/components/Sidebar"
import AuthGuard from "@/components/AuthGuard"
import { ThemeProvider } from "next-themes"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {

  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="dark">

          {/* ⚠️ on ne met PLUS de logique ici */}
          <AuthGuard>
            <Sidebar />
            <main className="ml-64 p-6 bg-gray-100 dark:bg-[#0B0B0F] min-h-screen">
              {children}
            </main>
          </AuthGuard>

        </ThemeProvider>
      </body>
    </html>
  )
}