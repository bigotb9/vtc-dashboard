import "./globals.css"
import Sidebar from "@/components/Sidebar"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className="bg-gray-100 text-gray-900">

        <div className="flex">

          <Sidebar />

          <main className="flex-1 p-10">

            {children}

          </main>

        </div>

      </body>
    </html>
  )
}