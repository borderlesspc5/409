"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { getStationById } from "@/lib/firestore"
import type { Station } from "@/lib/types"
import StationForm from "@/components/station-form"

export default function EditStationPage() {
  const router = useRouter()
  const params = useParams()
  const stationId = params.id as string

  const [station, setStation] = useState<Station | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStationById(stationId).then((data) => {
      if (!data) {
        router.push("/admin/stations-maneger")
        return
      }
      setStation(data)
      setLoading(false)
    })
  }, [router, stationId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
          <p className="mt-4 text-muted-foreground">
            Carregando estação...
          </p>
        </div>
      </div>
    )
  }

  if (!station) return null

  return (
    <div className="mx-auto max-w-3xl">
      <StationForm station={station} />
    </div>
  )
}
