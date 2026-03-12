"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { getStationWithCounts, getStationChargers, getBookingsByCharger, createBooking, logActivity } from "@/lib/firestore"
import { getCurrentUserAsync } from "@/lib/auth-firebase"
import type { Station, Charger } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Calendar, Clock, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { formatAmperageRange, formatPowerRange } from "@/lib/utils"

export default function BookStation() {
  const router = useRouter()
  const params = useParams()
  const stationId = params?.id as string

  const [station, setStation] = useState<Station | null>(null)
  const [chargers, setChargers] = useState<Charger[]>([])
  const [selectedChargerId, setSelectedChargerId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState("")
  const [selectedTime, setSelectedTime] = useState("")
  const [duration, setDuration] = useState("1")
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [conflictPeriods, setConflictPeriods] = useState<Array<{ start_time: string; end_time: string }>>([])

  useEffect(() => {
    let cancelled = false
    if (!stationId) {
      setLoading(false)
      return
    }
    ;(async () => {
      const user = await getCurrentUserAsync()
      if (!user) {
        if (!cancelled) router.push("/login")
        return
      }
      if (user.role === "admin") {
        if (!cancelled) {
          if (typeof window !== "undefined") {
            window.alert("Admins não podem fazer reservas. Use uma conta pessoal.")
          }
          router.replace("/admin")
        }
        return
      }
      const [data, stationChargers] = await Promise.all([
        getStationWithCounts(stationId),
        getStationChargers(stationId),
      ])
      if (cancelled) return
      setStation(data ?? null)
      setChargers(stationChargers)
      const available = stationChargers.find((c) => c.status === "available")
      setSelectedChargerId(available?.id ?? stationChargers[0]?.id ?? null)
      const today = new Date().toISOString().split("T")[0]
      setSelectedDate(today)
      const now = new Date()
      now.setHours(now.getHours() + 1, 0, 0, 0)
      setSelectedTime(`${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [stationId, router])

  useEffect(() => {
    if (!selectedChargerId || !selectedDate || !selectedTime || !duration) {
      setConflictPeriods([])
      return
    }
    const startTime = new Date(`${selectedDate}T${selectedTime}:00`)
    if (Number.isNaN(startTime.getTime())) {
      setConflictPeriods([])
      return
    }
    const durationHours = Number.parseInt(duration, 10) || 1
    const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000)
    let cancelled = false
    getBookingsByCharger(selectedChargerId).then((bookings) => {
      if (cancelled) return
      const start = startTime.getTime()
      const end = endTime.getTime()
      const overlapping = bookings
        .filter((b) => b.status !== "cancelled")
        .filter((b) => {
          const bStart = new Date(b.start_time).getTime()
          const bEnd = new Date(b.end_time).getTime()
          return start < bEnd && end > bStart
        })
        .map((b) => ({ start_time: b.start_time, end_time: b.end_time }))
      setConflictPeriods(overlapping)
    })
    return () => { cancelled = true }
  }, [selectedChargerId, selectedDate, selectedTime, duration])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!station) return
    const user = await getCurrentUserAsync()
    if (!user) {
      router.push("/login")
      return
    }
    if (!selectedChargerId) {
      setError("Selecione um carregador para continuar.")
      return
    }
    const selectedCharger = chargers.find((c) => c.id === selectedChargerId)
    if (selectedCharger?.status !== "available") {
      setError("O carregador selecionado não está disponível. Escolha outro.")
      return
    }
    if (conflictPeriods.length > 0) {
      setError("Este horário conflita com outra reserva neste carregador. Escolha outra data ou horário.")
      return
    }
    setError("")
    setSubmitting(true)
    try {
      const startTime = new Date(`${selectedDate}T${selectedTime}:00`)
      const endTime = new Date(startTime.getTime() + Number.parseInt(duration) * 60 * 60 * 1000)
      const booking = await createBooking({
        user_id: user.id,
        station_id: station.id,
        charger_id: selectedChargerId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: "pending",
        payment_status: "pending",
      })
      await logActivity("booking_created", user.id, user.name || user.email || user.id, {
        booking_id: booking.id,
        user_id: user.id,
        station_id: station.id,
        charger_id: selectedChargerId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
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

  const totalChargers = chargers.length
  const availableChargers = chargers.filter((c) => c.status === "available").length

  const estimatedCost = Number.parseInt(duration) * 40 * station.price_per_kwh

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader variant="back" backHref={`/stations/${station.id}`} backReplace />
      <main className="flex-1 container mx-auto max-w-4xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Fazer Reserva</h1>
          <p className="text-muted-foreground mt-1">{station.name}</p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Detalhes da Estação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm md:text-base">
                <span className="text-muted-foreground">Endereço</span>
                <span className="font-medium text-right">{station.address}</span>
              </div>
              <div className="flex justify-between text-sm md:text-base">
                <span className="text-muted-foreground">Carregadores Disponíveis</span>
                <span className="font-medium">
                  {availableChargers}/{totalChargers}
                </span>
              </div>
              {(station.total_chargers ?? 0) >= 1 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Potência</span>
                  <span className="font-medium">{formatPowerRange(station)}</span>
                </div>
              )}
              {(station.total_chargers ?? 0) >= 1 &&
                formatAmperageRange(station) !== "—" && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amperagem</span>
                    <span className="font-medium">{formatAmperageRange(station)}</span>
                  </div>
                )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Preço</span>
                <span className="font-medium">R$ {station.price_per_kwh.toFixed(2)}/kWh</span>
              </div>
            </CardContent>
          </Card>

          {chargers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Escolha o carregador</CardTitle>
                <CardDescription>Selecione qual carregador deseja utilizar</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2">
                  {chargers.map((c) => {
                    const available = c.status === "available"
                    const selected = selectedChargerId === c.id
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={!available}
                        onClick={() => available && setSelectedChargerId(c.id)}
                        className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                          selected
                            ? "border-primary bg-primary/10"
                            : available
                              ? "hover:bg-muted/50"
                              : "cursor-not-allowed opacity-60"
                        }`}
                      >
                        <div>
                          <span className="font-medium">Carregador {c.charger_number}</span>
                          <span className="ml-2 text-sm text-muted-foreground">{c.connector_type}</span>
                          <span className="ml-2 text-sm text-muted-foreground">{c.power_output}</span>
                        </div>
                        <span className={`text-xs font-medium ${available ? "text-green-600" : "text-muted-foreground"}`}>
                          {available ? "Disponível" : c.status === "occupied" ? "Ocupado" : c.status === "reserved" ? "Reservado" : "Manutenção"}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

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

                {conflictPeriods.length > 0 && (
                  <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 flex gap-2">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-200">Este carregador já está reservado nos seguintes horários:</p>
                      <ul className="mt-2 list-disc list-inside text-sm text-amber-800/90 dark:text-amber-200/90 space-y-1">
                        {conflictPeriods.map((p, i) => (
                          <li key={i}>
                            {new Date(p.start_time).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}{" "}
                            das {new Date(p.start_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}{" "}
                            às {new Date(p.end_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </li>
                        ))}
                      </ul>
                      <p className="text-sm mt-2 text-amber-800/80 dark:text-amber-200/80">Escolha outra data ou horário para evitar conflito.</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1" disabled={submitting || !selectedChargerId || conflictPeriods.length > 0}>
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
