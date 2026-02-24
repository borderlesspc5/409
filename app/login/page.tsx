"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { login } from "@/lib/auth-firebase"

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
import { Zap, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      await login(email, password)
      router.push("/")
    } catch {
      setError("Email ou senha incorretos")
    } finally {
      setLoading(false)
    }
  }

  const quickLogin = (userEmail: string) => {
    setEmail(userEmail)
    setPassword("password")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary p-2">
              <Zap className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>

          <div className="space-y-2 text-center">
            <CardTitle className="text-2xl">Bem-vindo ao Charger</CardTitle>
            <CardDescription>Entre com sua conta para continuar</CardDescription>
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
              <Label>Email</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Senha</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button className="w-full" disabled={loading}>
              Entrar
            </Button>
          </form>

          <p className="text-center text-sm pt-4">
            Novo?{" "}
            <Link href="/register" className="underline">
              Crie sua conta agora
            </Link>
          </p>

          <div className="mt-6 space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => quickLogin("joao@email.com")}
            >
              Demo Usuário
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => quickLogin("admin@email.com")}
            >
              Demo Administrador
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
