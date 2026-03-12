"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getUserBookings, getStation, getCharger, updateBooking, updateCharger, logActivity, releaseVoucherUsage } from "@/lib/firestore"
import { auth } from "@/lib/firebase"
import { getCurrentUserAsync } from "@/lib/auth-firebase"
import { onAuthStateChanged } from "firebase/auth"
import type { Booking, Station, Charger } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, MapPin, Clock, DollarSign } from "lucide-react"
import Link from "next/link"
import { MainSidebar } from "@/components/main-sidebar"

function RemainingTime({ endTime }: { endTime: string }) {
  const [timeLeft, setTimeLeft] = useState<string>("Calculando...")

  useEffect(() => {
    const update = () => {
      const now = new Date().getTime()
      const end = new Date(endTime).getTime()
      const diff = end - now

      if (diff <= 0) {
        setTimeLeft("Tempo esgotado")
        return
      }

      const minutes = Math.floor(diff / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      setTimeLeft(`Tempo restante: ${minutes}m ${seconds}s`)
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [endTime])

  return (
    <div className="w-full inline-flex h-9 items-center justify-center rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground shadow-sm">
      {timeLeft}
    </div>
  )
}

export default function MyBookings() {
  const router = useRouter()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [stations, setStations] = useState<Map<string, Station>>(new Map())
  const [chargersMap, setChargersMap] = useState<Map<string, Charger>>(new Map())
  const [loading, setLoading] = useState(true)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [arrivingId, setArrivingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!auth) {
      router.push("/login")
      return
    }

    ;(async () => {
      const currentUser = await getCurrentUserAsync()
      if (currentUser?.role === "admin") {
        if (!cancelled) {
          if (typeof window !== "undefined") {
            window.alert("Admins não podem gerenciar reservas pessoais. Use uma conta de cliente.")
          }
          router.replace("/admin")
        }
        return
      }
    })()

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (cancelled) return
      if (!fbUser) {
        router.push("/login")
        return
      }

      try {
        const userBookings = await getUserBookings(fbUser.uid)
        if (cancelled) return
        setBookings(userBookings)
        const stationMap = new Map<string, Station>()
        const chargerMap = new Map<string, Charger>()
        await Promise.all([
          ...userBookings.map((b) =>
            getStation(b.station_id).then((station) => {
              if (station) stationMap.set(b.station_id, station)
            })
          ),
          ...userBookings.map((b) =>
            getCharger(b.charger_id).then((charger) => {
              if (charger) chargerMap.set(b.charger_id, charger)
            })
          ),
        ])
        if (!cancelled) {
          setStations(stationMap)
          setChargersMap(chargerMap)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [router])

  async function handleCancelReservation(booking: Booking) {
    if (cancellingId || !booking) return
    if (typeof window !== "undefined" && !window.confirm("Deseja mesmo cancelar esta reserva?")) return
    setCancellingId(booking.id)
    try {
      if (booking.payment_status === "paid" && booking.voucher_id) {
        await releaseVoucherUsage(booking.id)
      }
      const updated: Booking = { ...booking, status: "cancelled" }
      await updateBooking(updated)
      await updateCharger(booking.charger_id, {
        status: "available",
        current_session_id: null as unknown as string,
      })
      const actor = await getCurrentUserAsync()
      if (actor) {
        await logActivity("booking_cancelled", actor.id, actor.name || actor.email || actor.id, {
          booking_id: booking.id,
          user_id: booking.user_id,
          station_id: booking.station_id,
          charger_id: booking.charger_id,
        })
      }
      setBookings((prev) => prev.map((b) => (b.id === booking.id ? updated : b)))
    } finally {
      setCancellingId(null)
    }
  }

  async function handleArriveAtCharger(booking: Booking) {
    if (arrivingId || !booking) return
    const charger = chargersMap.get(booking.charger_id)
    if (!charger || charger.status === "occupied") return
    setArrivingId(booking.id)
    try {
      await updateCharger(charger.id, {
        status: "occupied",
        current_session_id: booking.id,
      })
      const updated: Booking = { ...booking, status: "active" }
      await updateBooking(updated)
      setBookings((prev) => prev.map((b) => (b.id === booking.id ? updated : b)))
      setChargersMap((prev) => {
        const clone = new Map(prev)
        clone.set(charger.id, { ...charger, status: "occupied", current_session_id: booking.id })
        return clone
      })
    } finally {
      setArrivingId(null)
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

  return (
    <div className="flex min-h-screen bg-background">
      <MainSidebar />
      <main className="flex-1 container mx-auto max-w-5xl px-4 py-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Minhas Reservas</h1>
          <p className="text-muted-foreground mt-1">Acompanhe todas as suas reservas</p>
        </div>

        {bookings.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma reserva encontrada</h3>
              <p className="text-sm text-muted-foreground mb-6">Você ainda não fez nenhuma reserva</p>
              <Link href="/">
                <Button>Encontrar Estações</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {bookings.map((booking) => {
              const station = stations.get(booking.station_id)
              const charger = chargersMap.get(booking.charger_id)
              if (!station) return null

              return (
                <Card key={booking.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg md:text-xl">{station.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1 text-sm md:text-base">
                          <MapPin className="h-3 w-3" />
                          {station.address}
                        </CardDescription>
                        <p className="text-sm text-muted-foreground mt-1">
                          Carregador {charger?.charger_number ?? "—"}
                          {charger?.connector_type && ` • ${charger.connector_type}`}
                          {charger?.power_output && ` • ${charger.power_output}`}
                        </p>
                      </div>
                      <Badge
                        variant={
                          booking.status === "active"
                            ? "default"
                            : booking.status === "completed"
                              ? "secondary"
                              : "outline"
                        }
                        className={booking.status === "active" ? "bg-primary text-primary-foreground" : ""}
                      >
                        {booking.status === "active" && "Ativa"}
                        {booking.status === "completed" && "Concluída"}
                        {booking.status === "pending" && "Pendente"}
                        {booking.status === "cancelled" && "Cancelada"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm md:text-base">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Data:</span>
                          <span className="font-medium">
                            {new Date(booking.start_time).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm md:text-base">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Horário:</span>
                          <span className="font-medium">
                            {new Date(booking.start_time).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            -{" "}
                            {new Date(booking.end_time).toLocaleTimeString("pt-BR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-4">
                        {booking.total_kwh && (
                          <div className="flex items-center gap-2 text-sm md:text-base">
                            <span className="text-muted-foreground">Consumo:</span>
                            <span className="font-medium">{booking.total_kwh} kWh</span>
                          </div>
                        )}
                        {booking.total_cost && (
                          <div className="flex items-center gap-2 text-sm md:text-base">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Valor:</span>
                            <span className="font-medium">R$ {booking.total_cost.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm md:text-base">
                          <span className="text-muted-foreground">Pagamento:</span>
                          <Badge
                            variant={booking.payment_status === "paid" ? "default" : "outline"}
                            className={booking.payment_status === "paid" ? "bg-primary text-primary-foreground" : ""}
                          >
                            {booking.payment_status === "paid" && "Pago"}
                            {booking.payment_status === "pending" && "Pendente"}
                            {booking.payment_status === "failed" && "Falhou"}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {(booking.status === "pending" || booking.status === "active") && (
                      <div className="mt-4 pt-4 border-t space-y-2">
                        {booking.status === "pending" && booking.payment_status === "pending" && (
                          <Link href={`/bookings/${booking.id}/payment`}>
                            <Button size="sm" className="w-full">
                              Completar Pagamento
                            </Button>
                          </Link>
                        )}
                        {booking.status === "active" && (
                          charger?.status === "occupied" && charger?.current_session_id === booking.id ? (
                            <RemainingTime endTime={booking.end_time} />
                          ) : (
                            <Button
                              size="sm"
                              className="w-full"
                              variant="default"
                              disabled={arrivingId === booking.id}
                              onClick={() => handleArriveAtCharger(booking)}
                            >
                              {arrivingId === booking.id ? "Confirmando..." : "Cheguei ao carregador"}
                            </Button>
                          )
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          disabled={cancellingId === booking.id}
                          onClick={() => handleCancelReservation(booking)}
                        >
                          {cancellingId === booking.id ? "Cancelando..." : "Cancelar reserva"}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
