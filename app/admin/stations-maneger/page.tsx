"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getStationsWithCounts, getBookings, getStationChargers, createCharger } from "@/lib/firestore"
import type { Station, Booking, Charger } from "@/lib/types"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import {
  Zap,
  MapPin,
  Clock,
  DollarSign,
  Plus,
  Battery
} from "lucide-react"

import { cn } from "@/lib/utils"

const CONNECTOR_TYPES = ["CCS2", "CHAdeMO", "Type 2", "Tesla"]
const CHARGER_STATUSES = ["available", "occupied", "maintenance", "reserved"] as const

export default function AdminStationsPage() {
  const [stations, setStations] = useState<Station[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  const [chargers, setChargers] = useState<Charger[]>([])
  const [chargersLoading, setChargersLoading] = useState(false)
  const [addChargerOpen, setAddChargerOpen] = useState(false)
  const [addChargerSubmitting, setAddChargerSubmitting] = useState(false)
  const [addChargerForm, setAddChargerForm] = useState({
    charger_number: "",
    connector_type: "CCS2",
    power_output: "",
    status: "available" as const,
    price_per_kwh: "",
    model: "",
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getStationsWithCounts(), getBookings()]).then(([s, b]) => {
      setStations(s)
      setBookings(b)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!selectedStation) {
      setChargers([])
      return
    }
    setChargersLoading(true)
    getStationChargers(selectedStation.id).then((list) => {
      setChargers(list)
      setChargersLoading(false)
    })
  }, [selectedStation?.id])

  async function refreshStations() {
    const [s] = await Promise.all([getStationsWithCounts(), getBookings()])
    setStations(s)
    if (selectedStation) {
      const updated = s.find((x) => x.id === selectedStation.id)
      if (updated) setSelectedStation(updated)
    }
  }

  async function handleAddCharger(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedStation) return
    setAddChargerSubmitting(true)
    try {
      await createCharger({
        station_id: selectedStation.id,
        charger_number: addChargerForm.charger_number.trim() || "01",
        connector_type: addChargerForm.connector_type,
        power_output: addChargerForm.power_output.trim() || "22 kW",
        status: addChargerForm.status,
        price_per_kwh: addChargerForm.price_per_kwh ? Number.parseFloat(addChargerForm.price_per_kwh) : undefined,
        model: addChargerForm.model.trim() || undefined,
      })
      getStationChargers(selectedStation.id).then(setChargers)
      await refreshStations()
      setAddChargerForm({
        charger_number: "",
        connector_type: "CCS2",
        power_output: "",
        status: "available",
        price_per_kwh: "",
        model: "",
      })
      setAddChargerOpen(false)
    } finally {
      setAddChargerSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  const totalChargers = stations.reduce((sum, s) => sum + (s.total_chargers ?? 0), 0)
  const availableChargers = stations.reduce((sum, s) => sum + (s.available_chargers ?? 0), 0)
  const availability =
    totalChargers > 0 ? ((availableChargers / totalChargers) * 100).toFixed(0) : "0"

  const activeBookings = bookings.filter((b) => b.status === "active").length
  const totalRevenue = bookings
    .filter((b) => b.payment_status === "paid")
    .reduce((sum, b) => sum + (b.total_cost || 0), 0)

  return (
    <div className="space-y-8">
        {/* TÍTULO */}
        <div>
          <h2 className="text-3xl font-bold">Estações</h2>
          <p className="text-muted-foreground">
            Gerencie e monitore suas estações de recarga
          </p>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Estações</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stations.length}</div>
              <p className="text-xs text-muted-foreground">
                {totalChargers} carregadores
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Disponíveis</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{availableChargers}</div>
              <p className="text-xs text-muted-foreground">
                {availability}% disponíveis
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Reservas Ativas</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeBookings}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Receita</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {totalRevenue.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CONTEÚDO PRINCIPAL */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LISTA DE ESTAÇÕES */}
          <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Estações</CardTitle>
                <CardDescription>Clique para ver detalhes</CardDescription>
              </div>
              <Link href="/admin/stations/new">
                <Button
                  size="icon"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4 text-primary-foreground" />
                </Button>
              </Link>

            </CardHeader>

            <CardContent className="space-y-2">
              {stations.map((station) => (
                <button
                  key={station.id}
                  onClick={() => setSelectedStation(station)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition",
                    selectedStation?.id === station.id
                      ? "border-primary bg-muted"
                      : "hover:bg-muted/50"
                  )}
                >
                  <div className="font-medium">{station.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {station.city} • {station.state}
                  </div>

                  <div className="mt-2 flex gap-2">
                    <Badge variant="outline">
                      {(station.available_chargers ?? 0)}/{(station.total_chargers ?? 0)} livres
                    </Badge>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* DETALHES */}
          {selectedStation ? (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{selectedStation.name}</CardTitle>
                <CardDescription>
                  {selectedStation.city} - {selectedStation.state}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <Tabs defaultValue="overview">
                  <TabsList>
                    <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                    <TabsTrigger value="chargers">Carregadores</TabsTrigger>
                    <TabsTrigger value="events">Eventos</TabsTrigger>
                    <TabsTrigger value="transactions">Transações</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <div className="flex gap-2">
                      <Badge>{(selectedStation.total_chargers ?? 0)} carregadores</Badge>
                      <Badge variant="secondary">
                        {(selectedStation.available_chargers ?? 0)} disponíveis
                      </Badge>
                    </div>

                    <Link href={`/admin/stations/${selectedStation.id}/edit`}>
                    <Button variant="outline">Editar Estação</Button>
                    </Link>
                  </TabsContent>

                  <TabsContent value="chargers" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {chargers.length} carregador(es) nesta estação
                      </p>
                      <Button
                        size="sm"
                        onClick={() => setAddChargerOpen((v) => !v)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar carregador
                      </Button>
                    </div>

                    {addChargerOpen && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Novo carregador</CardTitle>
                          <CardDescription>Preencha os dados do carregador</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <form onSubmit={handleAddCharger} className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="charger_number">Número (ex.: 01)</Label>
                              <Input
                                id="charger_number"
                                value={addChargerForm.charger_number}
                                onChange={(e) => setAddChargerForm((f) => ({ ...f, charger_number: e.target.value }))}
                                placeholder="01"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="connector_type">Tipo de conector</Label>
                              <select
                                id="connector_type"
                                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={addChargerForm.connector_type}
                                onChange={(e) => setAddChargerForm((f) => ({ ...f, connector_type: e.target.value }))}
                              >
                                {CONNECTOR_TYPES.map((t) => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="power_output">Potência (ex.: 50 kW)</Label>
                              <Input
                                id="power_output"
                                value={addChargerForm.power_output}
                                onChange={(e) => setAddChargerForm((f) => ({ ...f, power_output: e.target.value }))}
                                placeholder="50 kW"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="status">Status</Label>
                              <select
                                id="status"
                                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={addChargerForm.status}
                                onChange={(e) => setAddChargerForm((f) => ({ ...f, status: e.target.value as typeof addChargerForm.status }))}
                              >
                                {CHARGER_STATUSES.map((s) => (
                                  <option key={s} value={s}>
                                    {s === "available" && "Disponível"}
                                    {s === "occupied" && "Ocupado"}
                                    {s === "maintenance" && "Manutenção"}
                                    {s === "reserved" && "Reservado"}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="price_per_kwh">Preço por kWh (opcional)</Label>
                              <Input
                                id="price_per_kwh"
                                type="number"
                                step="0.01"
                                value={addChargerForm.price_per_kwh}
                                onChange={(e) => setAddChargerForm((f) => ({ ...f, price_per_kwh: e.target.value }))}
                                placeholder={selectedStation.price_per_kwh ? `Padrão: ${selectedStation.price_per_kwh}` : ""}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="model">Modelo (opcional)</Label>
                              <Input
                                id="model"
                                value={addChargerForm.model}
                                onChange={(e) => setAddChargerForm((f) => ({ ...f, model: e.target.value }))}
                                placeholder="Ex.: ABB Terra AC"
                              />
                            </div>
                            <div className="sm:col-span-2 flex gap-2">
                              <Button type="submit" disabled={addChargerSubmitting}>
                                {addChargerSubmitting ? "Salvando..." : "Salvar carregador"}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setAddChargerOpen(false)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </form>
                        </CardContent>
                      </Card>
                    )}

                    {chargersLoading ? (
                      <p className="text-sm text-muted-foreground">Carregando carregadores...</p>
                    ) : chargers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhum carregador. Clique em &quot;Adicionar carregador&quot; para cadastrar.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {chargers.map((c) => (
                          <li
                            key={c.id}
                            className="flex items-center justify-between rounded-lg border p-3"
                          >
                            <div className="flex items-center gap-2">
                              <Battery className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">Carregador {c.charger_number}</span>
                              <Badge variant="outline">{c.connector_type}</Badge>
                              <span className="text-sm text-muted-foreground">{c.power_output}</span>
                              {c.model && (
                                <span className="text-xs text-muted-foreground">{c.model}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {typeof c.price_per_kwh === "number" && (
                                <span className="text-sm">R$ {c.price_per_kwh.toFixed(2)}/kWh</span>
                              )}
                              <Badge
                                variant={c.status === "available" ? "default" : "secondary"}
                              >
                                {c.status === "available" && "Disponível"}
                                {c.status === "occupied" && "Ocupado"}
                                {c.status === "maintenance" && "Manutenção"}
                                {c.status === "reserved" && "Reservado"}
                              </Badge>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </TabsContent>

                  <TabsContent value="events">
                    <p className="text-sm text-muted-foreground">
                      Eventos da estação (em breve)
                    </p>
                  </TabsContent>

                  <TabsContent value="transactions">
                    <p className="text-sm text-muted-foreground">
                      Transações da estação (em breve)
                    </p>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card className="lg:col-span-2 flex items-center justify-center">
              <p className="text-muted-foreground">
                Selecione uma estação para ver os detalhes
              </p>
            </Card>
          )}
        </div>
    </div>
  )
}
