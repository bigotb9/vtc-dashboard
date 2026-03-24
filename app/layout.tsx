"use client"

import "./globals.css"
import Sidebar from "@/components/Sidebar"
import AuthGuard from "@/components/AuthGuard"
import { ThemeProvider } from "next-themes"
import { useState } from "react"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {

  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="dark">

          <AuthGuard>

            <div className="flex">

              {/* ✅ SIDEBAR DESKTOP */}
              <div className="hidden md:block w-64">
                <Sidebar />
              </div>

              {/* ✅ SIDEBAR MOBILE */}
              {sidebarOpen && (
                <div className="fixed inset-0 z-50 flex">

                  {/* overlay */}
                  <div
                    className="fixed inset-0 bg-black/50"
                    onClick={() => setSidebarOpen(false)}
                  />

                  {/* menu */}
                  <div className="relative w-64 bg-white dark:bg-[#0B0B0F] z-50 shadow-xl">
                    <Sidebar />
                  </div>

                </div>
              )}

              {/* ✅ CONTENU */}
              <div className="flex-1 min-h-screen">

                {/* HEADER MOBILE */}
                <div className="md:hidden p-4 flex items-center bg-white dark:bg-[#0B0B0F] shadow">

                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="text-xl text-gray-800 dark:text-white"
                  >
                    ☰
                  </button>

                  <h1 className="ml-4 font-semibold text-gray-900 dark:text-white">
                    VTC Dashboard
                  </h1>

                </div>

                {/* MAIN */}
                <main className="p-4 bg-gray-100 dark:bg-[#0B0B0F] min-h-screen">
                  {children}
                </main>

              </div>

            </div>

          </AuthGuard>

        </ThemeProvider>
      </body>
    </html>
  )
}