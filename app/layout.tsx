"use client"

import "./globals.css"
import Sidebar from "@/components/Sidebar"
import AuthGuard from "@/components/AuthGuard"
import { ThemeProvider } from "next-themes"
import { useState } from "react"
import { Menu, X } from "lucide-react"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="bg-gray-50 dark:bg-[#080C14] text-gray-900 dark:text-white">
        <ThemeProvider attribute="class" defaultTheme="dark">
          <AuthGuard>
            <div className="flex">

              {/* SIDEBAR DESKTOP */}
              <div className="hidden md:block w-64 flex-shrink-0">
                <Sidebar />
              </div>

              {/* SIDEBAR MOBILE OVERLAY */}
              {sidebarOpen && (
                <div className="fixed inset-0 z-50 flex md:hidden">
                  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
                  <div className="relative w-64 z-50">
                    <Sidebar />
                  </div>
                </div>
              )}

              {/* CONTENT */}
              <div className="flex-1 min-h-screen flex flex-col min-w-0">

                {/* MOBILE HEADER */}
                <header className="md:hidden sticky top-0 z-40 flex items-center gap-3 px-4 py-3
                  bg-white/90 dark:bg-[#060B14]/90 backdrop-blur-md
                  border-b border-gray-200 dark:border-[#1A2235] shadow-sm">
                  <button onClick={() => setSidebarOpen(true)}
                    className="p-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition">
                    {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                      <span className="text-white text-[10px] font-bold">VTC</span>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white text-sm">VTC Dashboard</span>
                  </div>
                </header>

                {/* MAIN */}
                <main className="flex-1 p-4 md:p-6 bg-gray-50 dark:bg-[#080C14]">
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
