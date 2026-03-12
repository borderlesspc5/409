"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, DollarSign, MapPin, ListChecks, History, Ticket, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { getCurrentUser, isAuthReady, logout } from "@/lib/auth-firebase"
import type { User } from "@/lib/types"

export function MainSidebar() {
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    if (!isAuthReady()) {
      const t = setInterval(() => {
        if (isAuthReady()) {
          clearInterval(t)
          setUser(getCurrentUser() ?? null)
        }
      }, 100)
      return () => clearInterval(t)
    }
    setUser(getCurrentUser() ?? null)
  }, [])

  const isActive = (href: string) => {
    if (!pathname) return false
    if (href === "/") return pathname === "/"
    if (href === "/admin") return pathname === "/admin"
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const handleLogout = async () => {
    await logout()
    if (typeof window !== "undefined") {
      window.location.href = "/login"
    }
  }

  return (
    <aside className="flex w-56 md:w-64 flex-col border-r bg-muted/30 px-3 py-4">
      <div className="mb-6 px-2">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <LayoutDashboard className="h-5 w-5" />
          <span className="text-lg">EV Charge</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1">
        {user?.role !== "admin" && (
          <Button
            asChild
            variant={isActive("/") ? "default" : "ghost"}
            size="sm"
            className="w-full justify-start"
          >
            <Link href="/">
              <MapPin className="mr-2 h-4 w-4" />
              Home
            </Link>
          </Button>
        )}

        {user?.role === "admin" && (
          <>
            <Button
              asChild
              variant={isActive("/admin") ? "default" : "ghost"}
              size="sm"
              className="w-full justify-start"
            >
              <Link href="/admin">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Home
              </Link>
            </Button>

            <Button
              asChild
              variant={isActive("/admin/expenses") ? "default" : "ghost"}
              size="sm"
              className="w-full justify-start"
            >
              <Link href="/admin/expenses">
                <DollarSign className="mr-2 h-4 w-4" />
                Financeiro
              </Link>
            </Button>

            <Button
              asChild
              variant={isActive("/admin/stations-maneger") ? "default" : "ghost"}
              size="sm"
              className="w-full justify-start"
            >
              <Link href="/admin/stations-maneger">
                <MapPin className="mr-2 h-4 w-4" />
                Estações
              </Link>
            </Button>

            <Button
              asChild
              variant={isActive("/admin/history") ? "default" : "ghost"}
              size="sm"
              className="w-full justify-start"
            >
              <Link href="/admin/history">
                <History className="mr-2 h-4 w-4" />
                Histórico
              </Link>
            </Button>

            <Button
              asChild
              variant={isActive("/admin/vouchers") ? "default" : "ghost"}
              size="sm"
              className="w-full justify-start"
            >
              <Link href="/admin/vouchers">
                <Ticket className="mr-2 h-4 w-4" />
                Cupons
              </Link>
            </Button>
          </>
        )}

        {user?.role !== "admin" && (
          <Button
            asChild
            variant={isActive("/bookings") ? "default" : "ghost"}
            size="sm"
            className="w-full justify-start"
          >
            <Link href="/bookings">
              <ListChecks className="mr-2 h-4 w-4" />
              Minhas Reservas
            </Link>
          </Button>
        )}
      </nav>

      <div className="mt-4 space-y-3 border-t pt-3">
        <div className="space-y-2 px-1">
          <span className="text-xs font-medium text-foreground">Alterar tema do site</span>
          <div className="flex justify-start">
            <ThemeSwitcher />
          </div>
        </div>

        {user && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-destructive hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        )}
      </div>
    </aside>
  )
}

