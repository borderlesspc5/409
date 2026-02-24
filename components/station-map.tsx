import { useEffect, useRef } from "react"
import type { Station } from "@/lib/types"
import L from "leaflet"

interface StationMapProps {
  stations: Station[]
  onStationSelect?: (station: Station) => void
}

export default function StationMap({
  stations,
  onStationSelect,
}: StationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])

  // Inicializa o mapa
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    const map = L.map(mapRef.current).setView(
      [-23.5505, -46.6333], // São Paulo
      12
    )

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map)

    mapInstanceRef.current = map
  }, [])

  // Atualiza marcadores quando stations muda
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    // Remove marcadores antigos
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    const bounds = L.latLngBounds([])

    stations.forEach((station) => {
      if (
        typeof station.latitude !== "number" ||
        typeof station.longitude !== "number" ||
        isNaN(station.latitude) ||
        isNaN(station.longitude)
      ) {
        return
      }

    const color =
        (station.available_chargers ?? 0) > 0 ? "#22c55e" : "#ef4444"

      // ✅ ÍCONE SVG CONTROLADO POR CSS
      const icon = L.divIcon({
        className: "station-marker",
        html: `
          <div class="marker-inner">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="${color}"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
              <circle cx="12" cy="9" r="2.5" fill="white"/>
            </svg>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36],
      })

      const marker = L.marker(
        [station.latitude, station.longitude],
        { icon }
      ).addTo(map)

      marker.on("click", () => {
        onStationSelect?.(station)

        marker
          .bindPopup(`
            <strong>${station.name}</strong><br/>
            ${station.address}<br/>
            <b>${station.available_chargers ?? 0}/${station.total_chargers ?? 0}</b> disponíveis<br/>
            R$ ${station.price_per_kwh.toFixed(2)}/kWh
          `)
          .openPopup()
      })

      markersRef.current.push(marker)
      bounds.extend(marker.getLatLng())
    })

    if (stations.length) {
      map.fitBounds(bounds, { padding: [40, 40] })
    }
  }, [stations, onStationSelect])

  return (
    <div
      ref={mapRef}
      className="h-[600px] w-full rounded-lg border"
    />
  )
}
