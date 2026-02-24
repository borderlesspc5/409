"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { getStationWithCounts } from "@/lib/firestore"
import type { Station } from "@/lib/types"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MapPin, Zap, DollarSign, Clock } from "lucide-react"
import Link from "next/link"
import { SiteHeader } from "@/components/site-header"

export default function StationDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const stationId = params.id as string

  const [station, setStation] = useState<Station | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!stationId) return
    getStationWithCounts(stationId).then((data) => {
      setStation(data ?? null)
      setLoading(false)
    })
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
      <main className="flex-1 container mx-auto max-w-4xl px-4 py-6">
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

          <InfoCard
            icon={<Clock className="h-4 w-4" />}
            title="Potência"
            value={station.power_output ?? "—"}
            subtitle="de saída"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Tipos de Conectores</CardTitle>
              <CardDescription>Disponíveis nesta estação</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {(station.connector_types ?? []).map((type) => (
                <Badge key={type} variant="secondary">
                  {type}
                </Badge>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Comodidades</CardTitle>
              <CardDescription>Serviços disponíveis</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
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
            <CardTitle>Reserve seu Horário</CardTitle>
            <CardDescription>Garanta seu carregador</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/stations/${station.id}/book`}>
              <Button className="w-full" size="lg" disabled={(station.available_chargers ?? 0) === 0}>
                {(station.available_chargers ?? 0) > 0
                  ? "Fazer Reserva"
                  : "Sem Carregadores Disponíveis"}
              </Button>
            </Link>
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
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  )
}
