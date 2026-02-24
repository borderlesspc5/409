import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import "leaflet/dist/leaflet.css"
import { Providers } from "@/components/providers"

const geist = Geist({ subsets: ["latin"] })
const geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "EV Charge - Gerenciamento de Estações de Recarga",
  description: "Sistema completo de gerenciamento de estações de recarga",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${geist.className} ${geistMono.className}`}>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  )
}
