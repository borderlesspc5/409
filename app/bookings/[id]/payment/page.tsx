"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { getBooking, getStation, updateBooking, createPayment } from "@/lib/firestore"
import type { Booking, Station } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CreditCard, Lock, CheckCircle } from "lucide-react"
import Link from "next/link"
import { SiteHeader } from "@/components/site-header"

export default function PaymentPage() {
  const router = useRouter()
  const params = useParams()
  const bookingId = params?.id as string

  const [booking, setBooking] = useState<Booking | null>(null)
  const [station, setStation] = useState<Station | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [cardNumber, setCardNumber] = useState("")
  const [cardName, setCardName] = useState("")
  const [cardExpiry, setCardExpiry] = useState("")
  const [cardCvv, setCardCvv] = useState("")

  useEffect(() => {
    if (!bookingId) {
      setLoading(false)
      return
    }
    getBooking(bookingId).then(async (bookingData) => {
      if (bookingData) {
        setBooking(bookingData)
        const stationData = await getStation(bookingData.station_id)
        setStation(stationData ?? null)
      }
      setLoading(false)
    })
  }, [bookingId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!booking) return

    setProcessing(true)

    try {
      const duration = (new Date(booking.end_time).getTime() - new Date(booking.start_time).getTime()) / (1000 * 60 * 60)
      const estimatedKwh = duration * 40
      const cost = estimatedKwh * (station?.price_per_kwh ?? 0.89)

      const updatedBooking: Booking = {
        ...booking,
        status: "active",
        payment_status: "paid",
        total_kwh: estimatedKwh,
        total_cost: cost,
      }

      await updateBooking(updatedBooking)
      await createPayment({
        booking_id: booking.id,
        user_id: booking.user_id,
        amount: cost,
        status: "completed",
        payment_method: "card",
      })

      setPaymentSuccess(true)
      setTimeout(() => router.push("/bookings"), 3000)
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!booking || !station) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Reserva não encontrada</h2>
          <Link href="/bookings">
            <Button className="mt-4">Minhas Reservas</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (paymentSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-16 w-16 text-primary mb-4" />
            <h2 className="text-2xl font-bold mb-2">Pagamento Confirmado!</h2>
            <p className="text-center text-muted-foreground mb-6">
              Sua reserva foi confirmada com sucesso. Você será redirecionado em breve.
            </p>
            <Link href="/bookings">
              <Button>Ver Minhas Reservas</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const duration = (new Date(booking.end_time).getTime() - new Date(booking.start_time).getTime()) / (1000 * 60 * 60)
  const estimatedKwh = duration * 40
  const totalAmount = estimatedKwh * station.price_per_kwh

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader variant="back" backHref="/bookings" />
      <main className="flex-1 container mx-auto max-w-3xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Pagamento</h1>
          <p className="text-muted-foreground mt-1">Complete o pagamento para confirmar sua reserva</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Resumo da Reserva</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Estação</p>
                  <p className="font-medium">{station.name}</p>
                  <p className="text-sm text-muted-foreground">{station.address}</p>
                </div>
                <div className="border-t pt-3">
                  <p className="text-sm text-muted-foreground">Data e Horário</p>
                  <p className="font-medium">
                    {new Date(booking.start_time).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  <p className="text-sm">
                    {new Date(booking.start_time).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    -{" "}
                    {new Date(booking.end_time).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="border-t pt-3">
                  <p className="text-sm text-muted-foreground mb-2">Detalhes do Consumo</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Duração</span>
                      <span className="font-medium">{duration}h</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Consumo Estimado</span>
                      <span className="font-medium">{estimatedKwh} kWh</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Taxa por kWh</span>
                      <span className="font-medium">R$ {station.price_per_kwh.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Total</span>
                    <span className="text-2xl font-bold text-primary">R$ {totalAmount.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    * Valor estimado. O valor final pode variar conforme o consumo real.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Informações de Pagamento
                </CardTitle>
                <CardDescription>Pagamento seguro via cartão de crédito</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cardNumber">Número do Cartão</Label>
                    <Input
                      id="cardNumber"
                      placeholder="1234 5678 9012 3456"
                      required
                      value={cardNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\s/g, "").replace(/\D/g, "")
                        const formatted = value.match(/.{1,4}/g)?.join(" ") || value
                        setCardNumber(formatted)
                      }}
                      maxLength={19}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cardName">Nome no Cartão</Label>
                    <Input
                      id="cardName"
                      placeholder="NOME COMPLETO"
                      required
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value.toUpperCase())}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cardExpiry">Validade</Label>
                      <Input
                        id="cardExpiry"
                        placeholder="MM/AA"
                        required
                        value={cardExpiry}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "")
                          const formatted = value.length >= 2 ? `${value.slice(0, 2)}/${value.slice(2, 4)}` : value
                          setCardExpiry(formatted)
                        }}
                        maxLength={5}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cardCvv">CVV</Label>
                      <Input
                        id="cardCvv"
                        placeholder="123"
                        required
                        type="password"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ""))}
                        maxLength={4}
                      />
                    </div>
                  </div>

                  <div className="bg-muted rounded-lg p-4 flex items-start gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      Este é um pagamento simulado para demonstração. Nenhuma cobrança real será efetuada.
                    </p>
                  </div>

                  <Button type="submit" className="w-full" disabled={processing}>
                    {processing ? (
                      <>
                        <div className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
                        Processando...
                      </>
                    ) : (
                      `Pagar R$ ${totalAmount.toFixed(2)}`
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
