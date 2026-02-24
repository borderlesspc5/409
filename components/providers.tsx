"use client"

import { useEffect } from "react"
import { initAuthStateListener } from "@/lib/auth-firebase"
import { ThemeProvider } from "@/components/theme-provider"

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const unsubscribe = initAuthStateListener()
    return () => unsubscribe()
  }, [])

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="evcharge-theme"
    >
      {children}
    </ThemeProvider>
  )
}
