"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { getStation } from "@/lib/firestore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function StationDetailsPage() {
  const { id } = useParams()
  const [station, setStation] = useState<Awaited<ReturnType<typeof getStation>>>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    getStation(id as string).then(setStation).finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
      </div>
    )
  }

  if (!station) {
    return <p>Estação não encontrada.</p>
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>{station.name}</CardTitle>
        </CardHeader>

        <CardContent>
          <p><strong>Endereço:</strong> {station.address}</p>
          <p><strong>Cidade:</strong> {station.city} - {station.state}</p>
          <p><strong>Status:</strong> {station.status}</p>
        </CardContent>
      </Card>
    </div>
  )
}
