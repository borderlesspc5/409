"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Sun, Moon, Monitor } from "lucide-react"

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="flex gap-1 rounded-md border border-primary-foreground/30 bg-primary-foreground/10 p-1">
        <div className="h-7 w-7 rounded" />
      </div>
    )
  }

  return (
    <div
      className="flex gap-0.5 rounded-md border border-primary-foreground/30 bg-primary-foreground/10 p-0.5"
      role="group"
      aria-label="Selecionar tema"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={`h-7 w-7 rounded text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground ${
          (theme ?? "system") === "light" ? "bg-primary-foreground/25" : ""
        }`}
        onClick={() => setTheme("light")}
        title="Tema claro"
        aria-pressed={(theme ?? "system") === "light"}
      >
        <Sun className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={`h-7 w-7 rounded text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground ${
          (theme ?? "system") === "dark" ? "bg-primary-foreground/25" : ""
        }`}
        onClick={() => setTheme("dark")}
        title="Tema escuro"
        aria-pressed={(theme ?? "system") === "dark"}
      >
        <Moon className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={`h-7 w-7 rounded text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground ${
          (theme ?? "system") === "system" ? "bg-primary-foreground/25" : ""
        }`}
        onClick={() => setTheme("system")}
        title="Seguir dispositivo"
        aria-pressed={(theme ?? "system") === "system"}
      >
        <Monitor className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
