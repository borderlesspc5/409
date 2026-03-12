"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  getStationsWithCounts,
  getBookings,
  getStationChargers,
  createCharger,
  deleteStationWithChargers,
  updateCharger,
  deleteCharger,
  getPayments,
  getUsers,
} from "@/lib/firestore"
import { reauthenticateWithPassword } from "@/lib/auth-firebase"
import type { Station, Booking, Charger, Payment, User } from "@/lib/types"

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
  Battery,
  Trash2,
} from "lucide-react"

import { cn, formatAmperageRange } from "@/lib/utils"

const CONNECTOR_TYPES = ["CCS2", "CHAdeMO", "Type 2", "Tesla"]
const CHARGER_STATUSES = ["available", "occupied", "maintenance", "reserved"] as const

export default function AdminStationsPage() {
  const [stations, setStations] = useState<Station[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  const [chargers, setChargers] = useState<Charger[]>([])
  const [chargersLoading, setChargersLoading] = useState(false)
  const [addChargerOpen, setAddChargerOpen] = useState(false)
  const [addChargerSubmitting, setAddChargerSubmitting] = useState(false)
  const DEFAULT_VOLTAGE_V = 400
  const [addChargerForm, setAddChargerForm] = useState({
    connector_type: "CCS2",
    power_kw: "" as string,
    current_a: "" as string,
    voltage_v: "" as string,
    status: "available" as const,
    price_per_kwh: "",
    model: "",
  })

  const nextChargerNumber = (() => {
    if (!chargers.length) return 1
    const numbers = chargers
      .map((c) => Number.parseInt(String(c.charger_number).replace(/^0+/, ""), 10) || 0)
      .filter((n) => Number.isInteger(n) && n >= 0)
    return numbers.length ? Math.max(...numbers) + 1 : 1
  })()
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmChecked, setDeleteConfirmChecked] = useState(false)
  const [deletePassword, setDeletePassword] = useState("")
  const [deleteError, setDeleteError] = useState("")
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  const [resPeriodType, setResPeriodType] = useState<"total" | "year" | "month">("total")
  const [resSelectedYear, setResSelectedYear] = useState<number | undefined>()
  const [resSelectedMonth, setResSelectedMonth] = useState<number | undefined>()

  const [editingChargerId, setEditingChargerId] = useState<string | null>(null)
  const [editChargerSubmitting, setEditChargerSubmitting] = useState(false)
  const [editChargerForm, setEditChargerForm] = useState<{
    power_kw: string
    current_a: string
    voltage_v: string
    status: Charger["status"]
    price_per_kwh: string
    model: string
  }>({
    power_kw: "",
    current_a: "",
    voltage_v: "",
    status: "available",
    price_per_kwh: "",
    model: "",
  })

  useEffect(() => {
    Promise.all([getStationsWithCounts(), getBookings(), getPayments(), getUsers()]).then(([s, b, p, u]) => {
      setStations(s)
      setBookings(b)
      setPayments(p)
      setUsers(u)
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

  async function handleDeleteStation() {
    if (!selectedStation || !deleteConfirmChecked || !deletePassword.trim()) return
    setDeleteError("")
    setDeleteSubmitting(true)
    try {
      await reauthenticateWithPassword(deletePassword)
      await deleteStationWithChargers(selectedStation.id)
      setSelectedStation(null)
      await refreshStations()
      setDeleteDialogOpen(false)
      setDeleteConfirmChecked(false)
      setDeletePassword("")
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Erro ao excluir. Verifique sua senha.")
    } finally {
      setDeleteSubmitting(false)
    }
  }

  async function refreshChargers(stationId: string) {
    setChargersLoading(true)
    const list = await getStationChargers(stationId)
    setChargers(list)
    setChargersLoading(false)
  }

  function openEditCharger(charger: Charger) {
    setEditingChargerId(charger.id)
    setEditChargerForm({
      power_kw: charger.power_kw != null ? String(charger.power_kw) : "",
      current_a: charger.current_a != null ? String(charger.current_a) : "",
      voltage_v: charger.voltage_v != null ? String(charger.voltage_v) : "",
      status: charger.status,
      price_per_kwh: charger.price_per_kwh != null ? String(charger.price_per_kwh) : "",
      model: charger.model ?? "",
    })
  }

  async function handleSaveCharger(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedStation || !editingChargerId) return
    setEditChargerSubmitting(true)
    try {
      const powerKw = editChargerForm.power_kw.trim() ? Number.parseFloat(editChargerForm.power_kw) : undefined
      const currentA = editChargerForm.current_a.trim() ? Number.parseFloat(editChargerForm.current_a) : undefined
      const voltageV = editChargerForm.voltage_v.trim() ? Number.parseFloat(editChargerForm.voltage_v) : undefined
      await updateCharger(editingChargerId, {
        status: editChargerForm.status,
        ...(editChargerForm.model.trim() && { model: editChargerForm.model.trim() }),
        ...(editChargerForm.price_per_kwh.trim() && { price_per_kwh: Number.parseFloat(editChargerForm.price_per_kwh) }),
        ...(typeof powerKw === "number" && !Number.isNaN(powerKw) && { power_kw: powerKw }),
        ...(typeof currentA === "number" && !Number.isNaN(currentA) && { current_a: currentA }),
        ...(typeof voltageV === "number" && !Number.isNaN(voltageV) && { voltage_v: voltageV }),
      })
      await refreshChargers(selectedStation.id)
      await refreshStations()
      setEditingChargerId(null)
    } finally {
      setEditChargerSubmitting(false)
    }
  }

  async function handleDeleteCharger(charger: Charger) {
    if (!selectedStation) return
    const confirmed =
      typeof window === "undefined" ? true : window.confirm(`Excluir o carregador ${charger.charger_number}?`)
    if (!confirmed) return
    await deleteCharger(charger.id)
    await refreshChargers(selectedStation.id)
    await refreshStations()
  }

  const voltageV = addChargerForm.voltage_v.trim() ? Number.parseFloat(addChargerForm.voltage_v) : DEFAULT_VOLTAGE_V
  const powerKwNum = addChargerForm.power_kw.trim() ? Number.parseFloat(addChargerForm.power_kw) : undefined
  const currentANum = addChargerForm.current_a.trim() ? Number.parseFloat(addChargerForm.current_a) : undefined

  async function handleAddCharger(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedStation) return
    let kw = powerKwNum
    let a = currentANum
    if (kw != null && !Number.isNaN(kw) && voltageV > 0) {
      if (a == null || Number.isNaN(a)) a = (kw * 1000) / voltageV
    } else if (a != null && !Number.isNaN(a) && voltageV > 0) {
      kw = (a * voltageV) / 1000
    }
    if (kw == null || Number.isNaN(kw)) kw = 22
    setAddChargerSubmitting(true)
    try {
      await createCharger({
        station_id: selectedStation.id,
        charger_number: String(nextChargerNumber),
        connector_type: addChargerForm.connector_type,
        power_output: `${kw} kW`,
        power_kw: kw,
        ...(typeof a === "number" && !Number.isNaN(a) && { current_a: Math.round(a * 10) / 10 }),
        ...(voltageV > 0 && { voltage_v: voltageV }),
        status: addChargerForm.status,
        price_per_kwh: addChargerForm.price_per_kwh ? Number.parseFloat(addChargerForm.price_per_kwh) : undefined,
        model: addChargerForm.model.trim() || undefined,
      })
      getStationChargers(selectedStation.id).then(setChargers)
      await refreshStations()
      setAddChargerForm({
        connector_type: "CCS2",
        power_kw: "",
        current_a: "",
        voltage_v: "",
        status: "available",
        price_per_kwh: "",
        model: "",
      })
      setAddChargerOpen(false)
    } finally {
      setAddChargerSubmitting(false)
    }
  }

  const stationBookings = useMemo(() => {
    if (!selectedStation) return []
    return bookings
      .filter((b) => b.station_id === selectedStation.id)
      .sort((a, b) => {
        const da = new Date(a.start_time).getTime()
        const db = new Date(b.start_time).getTime()
        if (Number.isNaN(da) && Number.isNaN(db)) return 0
        if (Number.isNaN(da)) return 1
        if (Number.isNaN(db)) return -1
        return db - da
      })
  }, [bookings, selectedStation])

  const resAvailableYears = useMemo(() => {
    const years = new Set<number>()
    for (const b of stationBookings) {
      const d = new Date(b.start_time)
      if (!Number.isNaN(d.getTime())) years.add(d.getFullYear())
    }
    return Array.from(years).sort((a, b) => b - a)
  }, [stationBookings])

  const resAvailableMonthsByYear = useMemo(() => {
    const map: Record<number, number[]> = {}
    for (const b of stationBookings) {
      const d = new Date(b.start_time)
      if (Number.isNaN(d.getTime())) continue
      const y = d.getFullYear()
      if (!map[y]) map[y] = []
      if (!map[y].includes(d.getMonth())) map[y].push(d.getMonth())
    }
    for (const y of Object.keys(map)) {
      map[Number(y)].sort((a, b) => a - b)
    }
    return map
  }, [stationBookings])

  const filteredStationBookings = useMemo(() => {
    return stationBookings.filter((b) => {
      const d = new Date(b.start_time)
      if (Number.isNaN(d.getTime())) return false
      if (resPeriodType === "total") return true
      if (resSelectedYear == null) return false
      if (d.getFullYear() !== resSelectedYear) return false
      if (resPeriodType === "year") return true
      if (resSelectedMonth == null) return false
      return d.getMonth() === resSelectedMonth
    })
  }, [stationBookings, resPeriodType, resSelectedYear, resSelectedMonth])

  const resCounters = useMemo(() => {
    const total = filteredStationBookings.length
    const active = filteredStationBookings.filter((b) => b.status === "active").length
    const completed = filteredStationBookings.filter((b) => b.status === "completed").length
    const cancelled = filteredStationBookings.filter((b) => b.status === "cancelled").length
    const pending = filteredStationBookings.filter((b) => b.status === "pending").length
    return { total, active, completed, cancelled, pending }
  }, [filteredStationBookings])

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

  const stationPayments =
    selectedStation && payments.length
      ? payments
          .map((payment) => ({
            payment,
            booking: bookings.find((b) => b.id === payment.booking_id) || null,
          }))
          .filter(
            (entry) =>
              entry.booking &&
              entry.booking.station_id === selectedStation.id &&
              entry.payment.status === "completed"
          )
          .sort((a, b) => {
            const da = new Date(a.payment.created_at).getTime()
            const db = new Date(b.payment.created_at).getTime()
            if (Number.isNaN(da) && Number.isNaN(db)) return 0
            if (Number.isNaN(da)) return 1
            if (Number.isNaN(db)) return -1
            return db - da
          })
          .slice(0, 10)
      : []

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
        <div className="grid gap-5 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm md:text-base font-medium">Total de Estações</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl md:text-3xl font-bold">{stations.length}</div>
              <p className="text-xs md:text-sm text-muted-foreground">
                {totalChargers} carregadores
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm md:text-base font-medium">Disponíveis</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl md:text-3xl font-bold">{availableChargers}</div>
              <p className="text-xs md:text-sm text-muted-foreground">
                {availability}% disponíveis
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm md:text-base font-medium">Reservas Ativas</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeBookings}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm md:text-base font-medium">Receita</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl md:text-3xl font-bold">
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
                    <TabsTrigger value="reservations">Reservas</TabsTrigger>
                    <TabsTrigger value="transactions">Transações</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge>{(selectedStation.total_chargers ?? 0)} carregadores</Badge>
                      <Badge variant="secondary">
                        {(selectedStation.available_chargers ?? 0)} disponíveis
                      </Badge>
                      {formatAmperageRange(selectedStation) !== "—" && (
                        <Badge variant="outline">
                          Amperagem: {formatAmperageRange(selectedStation)}
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link href={`/admin/stations/${selectedStation.id}/edit`}>
                        <Button variant="outline">Editar Estação</Button>
                      </Link>
                      <Button
                        variant="outline"
                        className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => {
                          setDeleteError("")
                          setDeleteConfirmChecked(false)
                          setDeletePassword("")
                          setDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir estação
                      </Button>
                    </div>
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
                              <Label>Número do carregador</Label>
                              <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 py-2 text-sm">
                                {nextChargerNumber}
                              </div>
                              <p className="text-xs text-muted-foreground">Numeração automática por estação</p>
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
                              <Label htmlFor="power_kw">Potência (kW)</Label>
                              <Input
                                id="power_kw"
                                type="number"
                                step="0.1"
                                min="0"
                                value={addChargerForm.power_kw}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setAddChargerForm((f) => {
                                    const vV = f.voltage_v.trim() ? Number.parseFloat(f.voltage_v) : DEFAULT_VOLTAGE_V
                                    const next = { ...f, power_kw: v }
                                    if (v && vV > 0) {
                                      const kw = Number.parseFloat(v)
                                      if (!Number.isNaN(kw)) next.current_a = String(Math.round((kw * 1000) / vV))
                                    }
                                    return next
                                  })
                                }}
                                placeholder="50"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="current_a">Corrente (A)</Label>
                              <Input
                                id="current_a"
                                type="number"
                                step="0.1"
                                min="0"
                                value={addChargerForm.current_a}
                                onChange={(e) => {
                                  const v = e.target.value
                                  setAddChargerForm((f) => {
                                    const vV = f.voltage_v.trim() ? Number.parseFloat(f.voltage_v) : DEFAULT_VOLTAGE_V
                                    const next = { ...f, current_a: v }
                                    if (v && vV > 0) {
                                      const a = Number.parseFloat(v)
                                      if (!Number.isNaN(a)) next.power_kw = String(Math.round((a * vV) / 1000))
                                    }
                                    return next
                                  })
                                }}
                                placeholder="Calculado ou informe"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="voltage_v">Tensão (V) – usada na conversão kW ↔ A</Label>
                              <Input
                                id="voltage_v"
                                type="number"
                                min="0"
                                value={addChargerForm.voltage_v}
                                onChange={(e) => setAddChargerForm((f) => ({ ...f, voltage_v: e.target.value }))}
                                placeholder={`${DEFAULT_VOLTAGE_V} (padrão)`}
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
                        {chargers.map((c) => {
                          const isEditing = editingChargerId === c.id
                          return (
                            <li
                              key={c.id}
                              className="rounded-lg border p-3 space-y-3"
                            >
                              <button
                                type="button"
                                className="flex w-full items-center justify-between gap-2 text-left"
                                onClick={() => {
                                  if (isEditing) {
                                    setEditingChargerId(null)
                                  } else {
                                    openEditCharger(c)
                                  }
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <Battery className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">Carregador {c.charger_number}</span>
                                  <Badge variant="outline">{c.connector_type}</Badge>
                                  <span className="text-sm text-muted-foreground">
                                    {c.power_output}
                                    {typeof c.current_a === "number" && ` / ${c.current_a} A`}
                                  </span>
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
                              </button>

                              {c.status === "occupied" && c.current_session_id && (
                                (() => {
                                  const booking = bookings.find((b) => b.id === c.current_session_id)
                                  const user = booking ? users.find((u) => u.id === booking.user_id) : null
                                  return booking ? (
                                    <div className="mt-2 text-sm text-muted-foreground bg-muted/50 rounded p-2">
                                      <p><strong>Ocupado por:</strong> {user ? user.name || user.email : "Usuário desconhecido"}</p>
                                      <p><strong>Até:</strong> {new Date(booking.end_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                                    </div>
                                  ) : null
                                })()
                              )}

                              {isEditing && (
                                <form
                                  onSubmit={handleSaveCharger}
                                  className="grid gap-3 sm:grid-cols-2 pt-2 border-t mt-2"
                                >
                                  <div className="sm:col-span-2 flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">
                                      Editando carregador {c.charger_number}
                                    </span>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                      onClick={() => handleDeleteCharger(c)}
                                      disabled={editChargerSubmitting}
                                    >
                                      Excluir carregador
                                    </Button>
                                  </div>
                                  <div className="space-y-1">
                                    <Label>Potência (kW)</Label>
                                    <Input
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      value={editChargerForm.power_kw}
                                      onChange={(e) =>
                                        setEditChargerForm((f) => ({ ...f, power_kw: e.target.value }))
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label>Corrente (A)</Label>
                                    <Input
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      value={editChargerForm.current_a}
                                      onChange={(e) =>
                                        setEditChargerForm((f) => ({ ...f, current_a: e.target.value }))
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label>Tensão (V)</Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      value={editChargerForm.voltage_v}
                                      onChange={(e) =>
                                        setEditChargerForm((f) => ({ ...f, voltage_v: e.target.value }))
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label>Status</Label>
                                    <select
                                      className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                      value={editChargerForm.status}
                                      onChange={(e) =>
                                        setEditChargerForm((f) => ({
                                          ...f,
                                          status: e.target.value as Charger["status"],
                                        }))
                                      }
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
                                  <div className="space-y-1">
                                    <Label>Preço por kWh</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={editChargerForm.price_per_kwh}
                                      onChange={(e) =>
                                        setEditChargerForm((f) => ({ ...f, price_per_kwh: e.target.value }))
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label>Modelo</Label>
                                    <Input
                                      value={editChargerForm.model}
                                      onChange={(e) =>
                                        setEditChargerForm((f) => ({ ...f, model: e.target.value }))
                                      }
                                    />
                                  </div>
                                  <div className="sm:col-span-2 flex gap-2 justify-end pt-1">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setEditingChargerId(null)}
                                      disabled={editChargerSubmitting}
                                    >
                                      Cancelar
                                    </Button>
                                    <Button
                                      type="submit"
                                      size="sm"
                                      disabled={editChargerSubmitting}
                                    >
                                      {editChargerSubmitting ? "Salvando..." : "Salvar alterações"}
                                    </Button>
                                  </div>
                                </form>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </TabsContent>

                  <TabsContent value="reservations" className="space-y-4">
                    {/* Filtros de período */}
                    <div className="flex flex-wrap gap-3 items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Período:</span>
                        <div className="inline-flex rounded-md border bg-muted/50 p-1 text-xs">
                          <button
                            type="button"
                            className={`px-3 py-1 rounded ${resPeriodType === "total" ? "bg-background font-semibold shadow-sm" : "text-muted-foreground"}`}
                            onClick={() => setResPeriodType("total")}
                          >
                            Total
                          </button>
                          <button
                            type="button"
                            className={`px-3 py-1 rounded ${resPeriodType === "year" ? "bg-background font-semibold shadow-sm" : "text-muted-foreground"}`}
                            onClick={() => {
                              setResPeriodType("year")
                              if (resSelectedYear == null && resAvailableYears.length > 0) {
                                setResSelectedYear(resAvailableYears[0])
                              }
                            }}
                          >
                            Ano
                          </button>
                          <button
                            type="button"
                            className={`px-3 py-1 rounded ${resPeriodType === "month" ? "bg-background font-semibold shadow-sm" : "text-muted-foreground"}`}
                            onClick={() => {
                              setResPeriodType("month")
                              const year = resSelectedYear ?? resAvailableYears[0]
                              if (year != null) {
                                setResSelectedYear(year)
                                const months = resAvailableMonthsByYear[year]
                                if (resSelectedMonth == null && months && months.length > 0) {
                                  setResSelectedMonth(months[0])
                                }
                              }
                            }}
                          >
                            Mês
                          </button>
                        </div>
                      </div>

                      {resAvailableYears.length > 0 && resPeriodType !== "total" && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Ano</span>
                          <select
                            className="h-8 rounded-md border bg-background px-2 text-xs"
                            value={resSelectedYear ?? ""}
                            onChange={(e) => {
                              const year = Number(e.target.value)
                              setResSelectedYear(Number.isNaN(year) ? undefined : year)
                              const months = resAvailableMonthsByYear[year]
                              if (months && months.length > 0) {
                                setResSelectedMonth(months[0])
                              } else {
                                setResSelectedMonth(undefined)
                              }
                            }}
                          >
                            {resAvailableYears.map((y) => (
                              <option key={y} value={y}>{y}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {resPeriodType === "month" && resSelectedYear != null && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Mês</span>
                          <select
                            className="h-8 rounded-md border bg-background px-2 text-xs"
                            value={resSelectedMonth ?? ""}
                            onChange={(e) => {
                              const m = Number(e.target.value)
                              setResSelectedMonth(Number.isNaN(m) ? undefined : m)
                            }}
                          >
                            {(resAvailableMonthsByYear[resSelectedYear] ?? []).map((m) => {
                              const d = new Date(resSelectedYear, m, 1)
                              const label = d.toLocaleDateString("pt-BR", { month: "long" })
                              return (
                                <option key={m} value={m}>
                                  {label.charAt(0).toUpperCase() + label.slice(1)}
                                </option>
                              )
                            })}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Contadores */}
                    <div className="flex flex-wrap gap-3">
                      <Badge variant="outline">{resCounters.total} reserva(s)</Badge>
                      <Badge variant="default">{resCounters.active} ativa(s)</Badge>
                      <Badge variant="secondary">{resCounters.completed} concluída(s)</Badge>
                      <Badge variant="secondary">{resCounters.pending} pendente(s)</Badge>
                      <Badge variant="destructive">{resCounters.cancelled} cancelada(s)</Badge>
                    </div>

                    {/* Tabela */}
                    {filteredStationBookings.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma reserva encontrada para o período selecionado.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b">
                            <tr>
                              <th className="py-2 pr-4 text-left font-medium">Início</th>
                              <th className="py-2 pr-4 text-left font-medium">Fim</th>
                              <th className="py-2 pr-4 text-left font-medium">Carregador</th>
                              <th className="py-2 pr-4 text-left font-medium">Status</th>
                              <th className="py-2 pr-4 text-left font-medium">Pagamento</th>
                              <th className="py-2 pl-4 text-right font-medium">Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredStationBookings.map((b) => {
                              const start = new Date(b.start_time)
                              const end = new Date(b.end_time)
                              const validStart = !Number.isNaN(start.getTime())
                              const validEnd = !Number.isNaN(end.getTime())
                              const charger = chargers.find((c) => c.id === b.charger_id)
                              const chargerLabel = charger ? `#${charger.charger_number}` : b.charger_id.slice(0, 6)

                              const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
                                active: { label: "Ativa", variant: "default" },
                                completed: { label: "Concluída", variant: "secondary" },
                                pending: { label: "Pendente", variant: "outline" },
                                cancelled: { label: "Cancelada", variant: "destructive" },
                              }
                              const paymentMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
                                paid: { label: "Pago", variant: "default" },
                                pending: { label: "Pendente", variant: "outline" },
                                failed: { label: "Falhou", variant: "destructive" },
                              }

                              const st = statusMap[b.status] ?? { label: b.status, variant: "outline" as const }
                              const pm = paymentMap[b.payment_status] ?? { label: b.payment_status, variant: "outline" as const }

                              return (
                                <tr
                                  key={b.id}
                                  className="border-b last:border-none hover:bg-muted/30 transition-colors"
                                >
                                  <td className="py-2 pr-4 align-top whitespace-nowrap">
                                    {validStart
                                      ? `${start.toLocaleDateString("pt-BR")} ${start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                                      : "—"}
                                  </td>
                                  <td className="py-2 pr-4 align-top whitespace-nowrap">
                                    {validEnd
                                      ? `${end.toLocaleDateString("pt-BR")} ${end.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                                      : "—"}
                                  </td>
                                  <td className="py-2 pr-4 align-top font-mono text-xs">
                                    {chargerLabel}
                                  </td>
                                  <td className="py-2 pr-4 align-top">
                                    <Badge variant={st.variant}>{st.label}</Badge>
                                  </td>
                                  <td className="py-2 pr-4 align-top">
                                    <Badge variant={pm.variant}>{pm.label}</Badge>
                                  </td>
                                  <td className="py-2 pl-4 align-top text-right font-medium">
                                    {typeof b.total_cost === "number"
                                      ? b.total_cost.toLocaleString("pt-BR", {
                                          style: "currency",
                                          currency: "BRL",
                                          minimumFractionDigits: 2,
                                        })
                                      : "—"}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="transactions">
                    {stationPayments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Ainda não há pagamentos registrados para esta estação.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Últimos {stationPayments.length} pagamentos desta estação.
                        </p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="border-b">
                              <tr>
                                <th className="py-2 pr-4 text-left font-medium">Data</th>
                                <th className="py-2 pr-4 text-left font-medium">Reserva</th>
                                <th className="py-2 pr-4 text-left font-medium">Método</th>
                                <th className="py-2 pl-4 text-right font-medium">Valor</th>
                              </tr>
                            </thead>
                            <tbody>
                              {stationPayments.map(({ payment, booking }) => {
                                const date = new Date(payment.created_at)
                                const hasValidDate = !Number.isNaN(date.getTime())
                                const bookingLabel = booking
                                  ? booking.id.slice(0, 6).toUpperCase()
                                  : payment.booking_id.slice(0, 6).toUpperCase()
                                return (
                                  <tr
                                    key={payment.id}
                                    className="border-b last:border-none hover:bg-muted/30 transition-colors"
                                  >
                                    <td className="py-2 pr-4 align-top">
                                      {hasValidDate
                                        ? `${date.toLocaleDateString("pt-BR")} ${date.toLocaleTimeString(
                                            "pt-BR",
                                            { hour: "2-digit", minute: "2-digit" }
                                          )}`
                                        : "—"}
                                    </td>
                                    <td className="py-2 pr-4 align-top font-mono text-xs">
                                      {bookingLabel}
                                    </td>
                                    <td className="py-2 pr-4 align-top capitalize">
                                      {payment.payment_method || "—"}
                                    </td>
                                    <td className="py-2 pl-4 align-top text-right font-medium">
                                      {payment.amount.toLocaleString("pt-BR", {
                                        style: "currency",
                                        currency: "BRL",
                                        minimumFractionDigits: 2,
                                      })}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
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

        {deleteDialogOpen && selectedStation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Card className="w-full max-w-md">
              <CardHeader className="border-b">
                <CardTitle className="text-destructive">Excluir estação permanentemente?</CardTitle>
                <CardDescription>
                  Esta ação não pode ser desfeita. Leia atentamente o que será removido.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm">
                  <p className="font-medium mb-2">O que será excluído:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>A estação &quot;{selectedStation.name}&quot;</li>
                    <li>Todos os {(selectedStation.total_chargers ?? 0)} carregador(es) vinculado(s) a esta estação</li>
                    <li>Reservas e transações continuarão no sistema, mas referenciando uma estação inexistente (podem ficar inconsistentes)</li>
                  </ul>
                </div>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteConfirmChecked}
                    onChange={(e) => setDeleteConfirmChecked(e.target.checked)}
                    className="mt-1 rounded border-input"
                  />
                  <span className="text-sm">Entendo as consequências e desejo excluir esta estação.</span>
                </label>
                <div className="space-y-2">
                  <Label htmlFor="delete-password">Senha do administrador (confirmação)</Label>
                  <Input
                    id="delete-password"
                    type="password"
                    placeholder="Digite sua senha"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    disabled={deleteSubmitting}
                    autoComplete="current-password"
                  />
                </div>
                {deleteError && (
                  <p className="text-sm text-destructive">{deleteError}</p>
                )}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={deleteSubmitting}
                    onClick={() => {
                      setDeleteDialogOpen(false)
                      setDeleteConfirmChecked(false)
                      setDeletePassword("")
                      setDeleteError("")
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    disabled={!deleteConfirmChecked || !deletePassword.trim() || deleteSubmitting}
                    onClick={handleDeleteStation}
                  >
                    {deleteSubmitting ? "Excluindo..." : "Excluir estação"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
    </div>
  )
}
