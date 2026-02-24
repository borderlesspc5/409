"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { Zap, User, LogOut, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { logout } from "@/lib/auth-firebase"

export type SiteHeaderVariant = "home" | "admin" | "back"

type UserForHeader = {
  role?: "user" | "admin"
}

type SiteHeaderProps = {
  variant: SiteHeaderVariant
  title?: string
  logoHref?: string
  backHref?: string
  user?: UserForHeader | null
}

export function SiteHeader({
  variant,
  title = "EV Charge",
  logoHref = "/",
  backHref,
  user,
}: SiteHeaderProps) {
  const router = useRouter()

  const handleLogout = async () => {
    await logout()
    router.push("/login")
  }

  return (
    <header className="sticky top-0 z-[1100] border-b border-primary-foreground/20 bg-primary text-primary-foreground">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {variant === "back" && backHref !== undefined ? (
            <Button
              variant="header"
              size="sm"
              asChild
            >
              <Link href={backHref}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Link>
            </Button>
          ) : variant === "back" ? (
            <Button
              variant="header"
              size="sm"
              onClick={() => router.back()}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          ) : (
            <Link href={logoHref} className="flex items-center gap-2 font-semibold text-primary-foreground hover:text-primary-foreground/90">
              <Zap className="h-6 w-6" />
              <span className="text-xl">{title}</span>
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2">
          {variant === "home" && user && (
            <>
              {user.role === "admin" && (
                <>
                  <Button variant="header" size="sm" asChild>
                    <Link href="/admin">Admin</Link>
                  </Button>
                  <Button variant="header" size="sm" asChild>
                    <Link href="/admin/expenses">Financeiro</Link>
                  </Button>
                  <Button variant="header" size="sm" asChild>
                    <Link href="/admin/stations-maneger">Estações</Link>
                  </Button>
                </>
              )}
              <Button variant="header" size="sm" asChild>
                <Link href="/bookings">
                  <User className="mr-2 h-4 w-4" />
                  Minhas Reservas
                </Link>
              </Button>
              <Button variant="header" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}

          {variant === "admin" && (
            <>
              <Button variant="header" size="sm" asChild>
                <Link href="/">Ver App</Link>
              </Button>
              <Button variant="header" size="sm" onClick={handleLogout}>
                Sair
              </Button>
            </>
          )}

          <ThemeSwitcher />
        </div>
      </div>
    </header>
  )
}
