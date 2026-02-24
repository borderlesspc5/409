"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser, isAuthReady } from "@/lib/auth-firebase"
import { getStationsWithCounts } from "@/lib/firestore"
import type { Station } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { MapPin, Search } from "lucide-react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { SiteHeader } from "@/components/site-header"

const StationMap = dynamic(() => import("@/components/station-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[600px] items-center justify-center rounded-lg border bg-muted">
      <p className="text-muted-foreground">Carregando mapa...</p>
    </div>
  ),
})

export default function HomeContent() {
  const router = useRouter()
  const [user, setUser] = useState<{ name: string; email: string; role?: "user" | "admin" } | null>(null)
  const [stations, setStations] = useState<Station[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  const [viewMode, setViewMode] = useState<"map" | "list">("map")

  useEffect(() => {
    function tryLoad() {
      const currentUser = getCurrentUser()
      if (!currentUser) {
        router.push("/login")
        return
      }
      setUser(currentUser)
      getStationsWithCounts().then(setStations)
    }
    if (!isAuthReady()) {
      const t = setInterval(() => {
        if (isAuthReady()) {
          clearInterval(t)
          tryLoad()
        }
      }, 100)
      return () => clearInterval(t)
    }
    tryLoad()
  }, [router])

  const filteredStations = stations.filter(
    (station) =>
      station.status === "active" &&
      (station.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        station.address.toLowerCase().includes(searchQuery.toLowerCase())),
  )

  if (!user) {
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
      <SiteHeader variant="home" user={user} />
      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="mb-6 space-y-2">
          <h2 className="text-3xl font-bold">Encontre Estações de Recarga</h2>
          <p className="text-muted-foreground">
            Localize a estação mais próxima e reserve seu horário
          </p>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou endereço..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="mb-4 flex gap-2">
          <Button
            variant={viewMode === "map" ? "default" : "outline"}
            onClick={() => setViewMode("map")}
            size="sm"
            className={viewMode === "map" ? "bg-primary text-primary-foreground" : "bg-transparent"}
          >
            <MapPin className="mr-2 h-4 w-4" />
            Mapa
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            onClick={() => setViewMode("list")}
            size="sm"
            className={viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-transparent"}
          >
            Lista
          </Button>
        </div>

        {viewMode === "map" ? (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <StationMap stations={filteredStations} onStationSelect={setSelectedStation} />
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">
                {filteredStations.length} estações encontradas
              </h3>

              <div className="space-y-3">
                {filteredStations.slice(0, 5).map((station) => (
                  <Card
                    key={station.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedStation?.id === station.id
                        ? "border-primary ring-2 ring-primary"
                        : ""
                    }`}
                    onClick={() => setSelectedStation(station)}
                  >
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{station.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {station.address}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Disponível</span>
                        <span className="font-medium text-primary">
                          {(station.available_chargers ?? 0)}/{(station.total_chargers ?? 0)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Preço</span>
                        <span className="font-medium">
                          R$ {station.price_per_kwh.toFixed(2)}/kWh
                        </span>
                      </div>

                      <Link href={`/stations/${station.id}`}>
                        <Button size="sm" className="mt-2 w-full">
                          Reservar
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredStations.map((station) => (
              <Card key={station.id} className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <CardTitle className="text-lg">{station.name}</CardTitle>
                  <CardDescription>{station.address}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Carregadores</span>
                    <span className="font-medium">
                      {(station.available_chargers ?? 0)}/{(station.total_chargers ?? 0)} disponíveis
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Potência</span>
                    <span className="font-medium">{station.power_output ?? "—"}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Preço</span>
                    <span className="font-medium">
                      R$ {station.price_per_kwh.toFixed(2)}/kWh
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {(station.connector_types ?? []).map((type) => (
                      <Badge key={type} variant="outline" className="text-xs">
                        {type}
                      </Badge>
                    ))}
                  </div>

                  {(station.amenities?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {(station.amenities ?? []).slice(0, 3).map((amenity) => (
                        <Badge key={amenity} variant="secondary" className="text-xs">
                          {amenity}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <Link href={`/stations/${station.id}`}>
                    <Button size="sm" className="mt-2 w-full">
                      Ver Detalhes
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
