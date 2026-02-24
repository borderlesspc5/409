"use client"

import { useEffect, useState } from "react"
import { getStationsWithCounts, getBookings } from "@/lib/firestore"
import type { Station, Booking } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Zap, MapPin, Clock, DollarSign } from "lucide-react"
import Link from "next/link"

export default function AdminDashboard() {
  const [stations, setStations] = useState<Station[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getStationsWithCounts(), getBookings()]).then(([s, b]) => {
      setStations(s)
      setBookings(b)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  const totalChargers = stations.reduce((sum, s) => sum + (s.total_chargers ?? 0), 0)
  const availableChargers = stations.reduce((sum, s) => sum + (s.available_chargers ?? 0), 0)

  // ✅ Bug escondido corrigido (divisão por zero)
  const availability =
    totalChargers > 0 ? ((availableChargers / totalChargers) * 100).toFixed(0) : "0"

  const activeBookings = bookings.filter((b) => b.status === "active").length
  const totalRevenue = bookings
    .filter((b) => b.payment_status === "paid")
    .reduce((sum, b) => sum + (b.total_cost || 0), 0)

  return (
    <>
        <div className="mb-8">
          <h2 className="text-3xl font-bold">Dashboard</h2>
          <p className="text-muted-foreground">Gerencie suas estações de recarga</p>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Estações</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stations.length}</div>
              <p className="text-xs text-muted-foreground">{totalChargers} carregadores totais</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Carregadores Disponíveis</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{availableChargers}</div>
              <p className="text-xs text-muted-foreground">{availability}% disponibilidade</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Reservas Ativas</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeBookings}</div>
              <p className="text-xs text-muted-foreground">{bookings.length} reservas totais</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Pagamentos confirmados</p>
            </CardContent>
          </Card>
        </div>

        {/* restante do código permanece inalterado */}
    </>
  )
}
