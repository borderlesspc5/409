"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { register } from "@/lib/auth-firebase"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, UserPlus } from "lucide-react"
import Link from "next/link"

export default function RegisterPage() {
  const router = useRouter()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    if (!name || !email || !password || !confirmPassword) {
      setError("Preencha todos os campos")
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError("As senhas não conferem")
      setLoading(false)
      return
    }

    try {
      await register(name, email, password)
      router.push("/")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar conta")
    } finally {
      setLoading(false)
    }
  }

  // ✅ DEMO
  const quickRegister = (type: "user" | "admin") => {
    if (type === "user") {
      setName("João Silva")
      setEmail("joao@email.com")
    } else {
      setName("Admin Charger")
      setEmail("admin@evcharge.com")
    }

    setPassword("password")
    setConfirmPassword("password")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary p-2">
              <UserPlus className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>

          <div className="space-y-2 text-center">
            <CardTitle className="text-2xl">Criar conta</CardTitle>
            <CardDescription>Preencha os dados para se registrar</CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Senha</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Confirmar senha</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <Button className="w-full" disabled={loading}>
              Registrar
            </Button>
          </form>

          <p className="mt-4 text-center text-sm">
            Já tem conta?{" "}
            <Link href="/login" className="underline">
              Entrar
            </Link>
          </p>

          {/* 🔽 DEMO */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Demo – Registro Rápido
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full bg-transparent"
                onClick={() => quickRegister("user")}
              >
                Criar conta como Usuário
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full bg-transparent"
                onClick={() => quickRegister("admin")}
              >
                Criar conta como Admin
              </Button>
            </div>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Senha padrão:{" "}
              <span className="font-mono font-semibold">password</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
