"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser, isAuthReady } from "@/lib/auth-firebase"
import { getUserBookings, getStation } from "@/lib/firestore"
import type { Booking, Station } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, MapPin, Clock, DollarSign } from "lucide-react"
import Link from "next/link"
import { SiteHeader } from "@/components/site-header"

export default function MyBookings() {
  const router = useRouter()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [stations, setStations] = useState<Map<string, Station>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthReady()) return
    const user = getCurrentUser()
    if (!user) {
      router.push("/login")
      return
    }

    let cancelled = false
    getUserBookings(user.id).then((userBookings) => {
      if (cancelled) return
      setBookings(userBookings)
      const stationMap = new Map<string, Station>()
      Promise.all(
        userBookings.map((b) =>
          getStation(b.station_id).then((station) => {
            if (station) stationMap.set(b.station_id, station)
          })
        )
      ).then(() => {
        if (!cancelled) setStations(stationMap)
      })
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [router])

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
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader variant="back" backHref="/" />
      <main className="flex-1 container mx-auto max-w-4xl px-4 py-6">
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
          <div className="space-y-4">
            {bookings.map((booking) => {
              const station = stations.get(booking.station_id)
              if (!station) return null

              return (
                <Card key={booking.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{station.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {station.address}
                        </CardDescription>
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
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Data:</span>
                          <span className="font-medium">
                            {new Date(booking.start_time).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
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
                      <div className="space-y-3">
                        {booking.total_kwh && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">Consumo:</span>
                            <span className="font-medium">{booking.total_kwh} kWh</span>
                          </div>
                        )}
                        {booking.total_cost && (
                          <div className="flex items-center gap-2 text-sm">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Valor:</span>
                            <span className="font-medium">R$ {booking.total_cost.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm">
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

                    {booking.status === "pending" && booking.payment_status === "pending" && (
                      <div className="mt-4 pt-4 border-t">
                        <Link href={`/bookings/${booking.id}/payment`}>
                          <Button size="sm" className="w-full">
                            Completar Pagamento
                          </Button>
                        </Link>
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
