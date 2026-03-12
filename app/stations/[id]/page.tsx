"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { getStationWithCounts } from "@/lib/firestore"
import { getCurrentUserAsync } from "@/lib/auth-firebase"
import type { Station } from "@/lib/types"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MapPin, Zap, DollarSign, Clock, Activity } from "lucide-react"
import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { formatAmperageRange, formatPowerRange } from "@/lib/utils"

export default function StationDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const stationId = params.id as string

  const [station, setStation] = useState<Station | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!stationId) return

    let cancelled = false

    async function fetchStation() {
      const [currentUser, data] = await Promise.all([
        getCurrentUserAsync(),
        getStationWithCounts(stationId),
      ])
      if (cancelled) return
      setIsAdmin(currentUser?.role === "admin")
      setStation(data ?? null)
      setLoading(false)
    }

    // fetch inicial
    fetchStation()

    // polling leve para manter contagens mais frescas
    const intervalId = window.setInterval(fetchStation, 20_000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [stationId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
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
          <Button className="mt-4" onClick={() => router.push("/")}>
            Voltar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader variant="back" />
      <main className="flex-1 container mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">{station.name}</h1>
          <p className="flex items-center gap-2 text-muted-foreground mt-2">
            <MapPin className="h-4 w-4" />
            {station.address}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-6">
          <InfoCard
            icon={<Zap className="h-4 w-4 text-primary" />}
            title="Carregadores"
            value={`${station.available_chargers ?? 0}/${station.total_chargers ?? 0}`}
            subtitle="disponíveis agora"
          />

          <InfoCard
            icon={<DollarSign className="h-4 w-4" />}
            title="Preço"
            value={`R$ ${station.price_per_kwh.toFixed(2)}`}
            subtitle="por kWh"
          />

          {(station.total_chargers ?? 0) >= 1 && (
            <InfoCard
              icon={<Clock className="h-4 w-4" />}
              title="Potência"
              value={formatPowerRange(station)}
              subtitle="de saída"
            />
          )}

          {(station.total_chargers ?? 0) >= 1 &&
            (station.min_current_a != null || station.max_current_a != null) && (
              <InfoCard
                icon={<Activity className="h-4 w-4" />}
                title="Amperagem"
                value={formatAmperageRange(station)}
                subtitle="intervalo na estação"
              />
            )}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Tipos de Conectores</CardTitle>
              <CardDescription className="text-sm md:text-base">Disponíveis nesta estação</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {(station.connector_types ?? []).map((type) => (
                <Badge key={type} variant="secondary">
                  {type}
                </Badge>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Comodidades</CardTitle>
              <CardDescription className="text-sm md:text-base">Serviços disponíveis</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {(station.amenities ?? []).map((amenity) => (
                <Badge key={amenity} variant="outline">
                  {amenity}
                </Badge>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">Reserve seu Horário</CardTitle>
            <CardDescription className="text-sm md:text-base">Garanta seu carregador</CardDescription>
          </CardHeader>
          <CardContent>
            {isAdmin ? (
              <p className="text-sm text-muted-foreground">
                Admins não podem fazer reservas. Use uma conta pessoal para reservar um horário.
              </p>
            ) : (
              <Link href={`/stations/${station.id}/book`}>
                <Button
                  className="w-full"
                  size="lg"
                  disabled={(station.available_chargers ?? 0) === 0}
                >
                  {(station.available_chargers ?? 0) > 0
                    ? "Fazer Reserva"
                    : "Sem Carregadores Disponíveis"}
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

function InfoCard({
  icon,
  title,
  value,
  subtitle,
}: {
  icon: React.ReactNode
  title: string
  value: string
  subtitle: string
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl md:text-3xl font-bold">{value}</div>
        <p className="text-sm md:text-base text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  )
}
