"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser, isAuthReady } from "@/lib/auth-firebase"
import { SiteHeader } from "@/components/site-header"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    if (!isAuthReady()) {
      const t = setInterval(() => {
        if (isAuthReady()) {
          clearInterval(t)
          const user = getCurrentUser()
          if (!user || user.role !== "admin") {
            router.push("/login")
            setAllowed(false)
          } else {
            setAllowed(true)
          }
        }
      }, 100)
      return () => clearInterval(t)
    }
    const user = getCurrentUser()
    if (!user || user.role !== "admin") {
      router.push("/login")
      setAllowed(false)
    } else {
      setAllowed(true)
    }
  }, [router])

  if (allowed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!allowed) return null

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader variant="admin" title="EV Charge Admin" logoHref="/admin" />
      <main className="flex-1 container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
