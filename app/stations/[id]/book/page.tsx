"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { getStationWithCounts, getStationChargers, createBooking } from "@/lib/firestore"
import { getCurrentUser, isAuthReady } from "@/lib/auth-firebase"
import type { Station } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Calendar, Clock } from "lucide-react"
import Link from "next/link"
import { SiteHeader } from "@/components/site-header"

export default function BookStation() {
  const router = useRouter()
  const params = useParams()
  const stationId = params?.id as string

  const [station, setStation] = useState<Station | null>(null)
  const [selectedDate, setSelectedDate] = useState("")
  const [selectedTime, setSelectedTime] = useState("")
  const [duration, setDuration] = useState("1")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!isAuthReady()) return
    const user = getCurrentUser()
    if (!user) {
      router.push("/login")
      return
    }
    if (!stationId) return
    getStationWithCounts(stationId).then((data) => {
      setStation(data ?? null)
      setLoading(false)
      const today = new Date().toISOString().split("T")[0]
      setSelectedDate(today)
      const now = new Date()
      now.setHours(now.getHours() + 1, 0, 0, 0)
      setSelectedTime(`${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`)
    })
  }, [stationId, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!station) return
    const user = getCurrentUser()
    if (!user) {
      router.push("/login")
      return
    }
    setError("")
    setSubmitting(true)
    try {
      const chargers = await getStationChargers(station.id)
      const available = chargers.find((c) => c.status === "available")
      const chargerId = available?.id ?? chargers[0]?.id
      if (!chargerId) {
        setError("Nenhum carregador disponível nesta estação.")
        setSubmitting(false)
        return
      }
      const startTime = new Date(`${selectedDate}T${selectedTime}:00`)
      const endTime = new Date(startTime.getTime() + Number.parseInt(duration) * 60 * 60 * 1000)
      const booking = await createBooking({
        user_id: user.id,
        station_id: station.id,
        charger_id: chargerId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: "pending",
        payment_status: "pending",
      })
      router.push(`/bookings/${booking.id}/payment`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar reserva.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!station) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Estação não encontrada</h2>
          <Link href="/">
            <Button className="mt-4">Voltar</Button>
          </Link>
        </div>
      </div>
    )
  }

  const estimatedCost = Number.parseInt(duration) * 40 * station.price_per_kwh

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader variant="back" backHref={`/stations/${station.id}`} />
      <main className="flex-1 container mx-auto max-w-2xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Fazer Reserva</h1>
          <p className="text-muted-foreground mt-1">{station.name}</p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Detalhes da Estação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Endereço</span>
                <span className="font-medium text-right">{station.address}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Carregadores Disponíveis</span>
                <span className="font-medium">
                  {station.available_chargers ?? 0}/{station.total_chargers ?? 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Potência</span>
                <span className="font-medium">{station.power_output ?? "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Preço</span>
                <span className="font-medium">R$ {station.price_per_kwh.toFixed(2)}/kWh</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Selecione Data e Horário</CardTitle>
              <CardDescription>Escolha quando deseja utilizar o carregador</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="date" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Data
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    required
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Horário de Início
                  </Label>
                  <Input
                    id="time"
                    type="time"
                    required
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">Duração (horas)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    max="8"
                    required
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Máximo de 8 horas por reserva</p>
                </div>

                <div className="rounded-lg border bg-muted/50 p-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Duração</span>
                    <span className="font-medium">{duration}h</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Consumo Estimado</span>
                    <span className="font-medium">{Number.parseInt(duration) * 40} kWh</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Taxa por kWh</span>
                    <span className="font-medium">R$ {station.price_per_kwh.toFixed(2)}</span>
                  </div>
                  <div className="border-t pt-2 mt-2 flex justify-between">
                    <span className="font-semibold">Valor Estimado</span>
                    <span className="text-lg font-bold text-primary">R$ {estimatedCost.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    * O valor final será calculado com base no consumo real
                  </p>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1" disabled={submitting}>
                    {submitting ? "Reservando..." : "Continuar para Pagamento"}
                  </Button>
                  <Link href={`/stations/${station.id}`} className="flex-1">
                    <Button type="button" variant="outline" className="w-full bg-transparent">
                      Cancelar
                    </Button>
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
