"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getCurrentUser } from "@/lib/auth-firebase"
import { createStation } from "@/lib/firestore"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, X } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"

export default function NewStation() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    latitude: "",
    longitude: "",
    total_chargers: "",
    price_per_kwh: "",
    power_output: "",
  })
  const [connectorTypes, setConnectorTypes] = useState<string[]>([])
  const [amenities, setAmenities] = useState<string[]>([])
  const [newConnector, setNewConnector] = useState("")
  const [newAmenity, setNewAmenity] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const user = getCurrentUser()
    if (!user || user.role !== "admin") {
      router.push("/login")
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const user = getCurrentUser()
    if (!user) return
    setSubmitting(true)
    try {
      await createStation({
        name: formData.name,
        address: formData.address,
        city: formData.city || "—",
        state: formData.state || "—",
        latitude: Number.parseFloat(formData.latitude) || 0,
        longitude: Number.parseFloat(formData.longitude) || 0,
        price_per_kwh: Number.parseFloat(formData.price_per_kwh) || 0,
        power_output: formData.power_output,
        connector_types: connectorTypes,
        amenities: amenities,
        status: "active",
        owner_id: user.id,
      })
      router.push("/admin/stations-maneger")
    } finally {
      setSubmitting(false)
    }
  }

  const addConnectorType = () => {
    if (newConnector && !connectorTypes.includes(newConnector)) {
      setConnectorTypes([...connectorTypes, newConnector])
      setNewConnector("")
    }
  }

  const addAmenity = () => {
    if (newAmenity && !amenities.includes(newAmenity)) {
      setAmenities([...amenities, newAmenity])
      setNewAmenity("")
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Nova Estação de Recarga</CardTitle>
            <CardDescription>Adicione uma nova estação ao sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Estação</Label>
                <Input
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Shopping Center Norte"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Endereço</Label>
                <Textarea
                  id="address"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Ex: Av. Example, 1234 - São Paulo, SP"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="São Paulo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">Estado</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="SP"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="total_chargers">Número de Carregadores</Label>
                  <Input
                    id="total_chargers"
                    type="number"
                    required
                    value={formData.total_chargers}
                    onChange={(e) => setFormData({ ...formData, total_chargers: e.target.value })}
                    placeholder="8"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="power_output">Potência</Label>
                  <Input
                    id="power_output"
                    required
                    value={formData.power_output}
                    onChange={(e) => setFormData({ ...formData, power_output: e.target.value })}
                    placeholder="50 kW"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="price_per_kwh">Preço por kWh (R$)</Label>
                <Input
                  id="price_per_kwh"
                  type="number"
                  step="0.01"
                  required
                  value={formData.price_per_kwh}
                  onChange={(e) => setFormData({ ...formData, price_per_kwh: e.target.value })}
                  placeholder="0.89"
                />
              </div>

              <div className="space-y-2">
                <Label>Tipos de Conectores</Label>
                <div className="flex gap-2">
                  <Input
                    value={newConnector}
                    onChange={(e) => setNewConnector(e.target.value)}
                    placeholder="Ex: CCS2, CHAdeMO, Type 2"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addConnectorType()
                      }
                    }}
                  />
                  <Button type="button" onClick={addConnectorType} size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {connectorTypes.map((type) => (
                    <Badge key={type} variant="secondary" className="gap-1">
                      {type}
                      <button
                        type="button"
                        onClick={() => setConnectorTypes(connectorTypes.filter((t) => t !== type))}
                        className="ml-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Comodidades</Label>
                <div className="flex gap-2">
                  <Input
                    value={newAmenity}
                    onChange={(e) => setNewAmenity(e.target.value)}
                    placeholder="Ex: Wi-Fi, Café, Banheiro"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addAmenity()
                      }
                    }}
                  />
                  <Button type="button" onClick={addAmenity} size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  {amenities.map((amenity) => (
                    <Badge key={amenity} variant="secondary" className="gap-1">
                      {amenity}
                      <button
                        type="button"
                        onClick={() => setAmenities(amenities.filter((a) => a !== amenity))}
                        className="ml-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1" disabled={submitting}>
                  {submitting ? "Criando..." : "Criar Estação"}
                </Button>
                <Link href="/admin/stations-maneger" className="flex-1">
                  <Button type="button" variant="outline" className="w-full bg-transparent">
                    Cancelar
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
    </div>
  )
}
