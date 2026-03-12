"use client"

import { useEffect, useState } from "react"
import { getVouchers, createVoucher, updateVoucherById, deleteVoucherById } from "@/lib/firestore"
import { getCurrentUserAsync } from "@/lib/auth-firebase"
import type { Voucher } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Ticket, Plus, Loader2 } from "lucide-react"

function voucherStatus(v: Voucher): "active" | "scheduled" | "exhausted" | "expired" | "standby" {
  const now = Date.now()
  if (v.paused) return "standby"
  if (v.used_count >= v.max_uses) return "exhausted"
  if (v.active_from) {
    const from = new Date(v.active_from).getTime()
    if (!Number.isNaN(from) && now < from) return "scheduled"
  }
  if (v.active_until) {
    const until = new Date(v.active_until).getTime()
    if (!Number.isNaN(until) && now > until) return "expired"
  }
  return "active"
}

function statusLabel(s: ReturnType<typeof voucherStatus>): string {
  switch (s) {
    case "active":
      return "Ativo"
    case "scheduled":
      return "Agendado"
    case "standby":
      return "Stand-by"
    case "exhausted":
      return "Esgotado"
    case "expired":
      return "Expirado"
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function toDateTimeLocal(iso?: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function hasLaunched(v: Voucher): boolean {
  const now = Date.now()
  if (v.active_from) {
    const from = new Date(v.active_from).getTime()
    if (!Number.isNaN(from) && now >= from) return true
    return false
  }
  const created = new Date(v.created_at).getTime()
  return !Number.isNaN(created) && now >= created
}

export default function AdminVouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState("")
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null)
  const [rowActionId, setRowActionId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: "",
    code: "",
    discount_type: "percent" as "percent" | "fixed",
    discount_value: "",
    max_uses: "",
    one_per_user: false,
    active_from: "",
    active_until: "",
  })

  const loadVouchers = () => {
    getVouchers().then(setVouchers)
  }

  useEffect(() => {
    getVouchers().then((v) => {
      setVouchers(v)
      setLoading(false)
    })
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")
    const name = form.name.trim()
    const code = form.code.trim().toUpperCase()
    const discountValue = Number(form.discount_value.replace(",", "."))
    const maxUses = Number.parseInt(form.max_uses, 10)
    if (!name || !code) {
      setFormError("Preencha nome e código.")
      return
    }
    if (Number.isNaN(discountValue) || discountValue <= 0) {
      setFormError("Valor do desconto deve ser maior que zero.")
      return
    }
    if (form.discount_type === "percent" && discountValue > 100) {
      setFormError("Desconto percentual não pode ser maior que 100%.")
      return
    }
    if (Number.isNaN(maxUses) || maxUses < 1) {
      setFormError("Máximo de usos deve ser pelo menos 1.")
      return
    }
    const user = await getCurrentUserAsync()
    if (!user) {
      setFormError("Faça login como admin.")
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        code,
        name,
        discount_type: form.discount_type as Voucher["discount_type"],
        discount_value: discountValue,
        max_uses: maxUses,
        one_per_user: form.one_per_user,
        ...(form.active_from && { active_from: new Date(form.active_from).toISOString() }),
        ...(form.active_until && { active_until: new Date(form.active_until).toISOString() }),
      }

      if (editingVoucher) {
        await updateVoucherById(editingVoucher.id, payload)
      } else {
        await createVoucher({
          ...payload,
          created_by: user.id,
        })
      }
      loadVouchers()
      setShowForm(false)
      setEditingVoucher(null)
      setForm({ name: "", code: "", discount_type: "percent", discount_value: "", max_uses: "", one_per_user: false, active_from: "", active_until: "" })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : editingVoucher ? "Erro ao salvar cupom." : "Erro ao criar cupom.")
    } finally {
      setSubmitting(false)
    }
  }

  const openCreateForm = () => {
    setEditingVoucher(null)
    setForm({
      name: "",
      code: "",
      discount_type: "percent",
      discount_value: "",
      max_uses: "",
      one_per_user: false,
      active_from: "",
      active_until: "",
    })
    setShowForm(true)
  }

  const openEditForm = (voucher: Voucher) => {
    setEditingVoucher(voucher)
    setForm({
      name: voucher.name,
      code: voucher.code,
      discount_type: voucher.discount_type,
      discount_value: String(voucher.discount_value).replace(".", ","),
      max_uses: String(voucher.max_uses),
      one_per_user: voucher.one_per_user,
      active_from: toDateTimeLocal(voucher.active_from),
      active_until: toDateTimeLocal(voucher.active_until),
    })
    setShowForm(true)
  }

  const handleDelete = async (voucher: Voucher) => {
    if (typeof window !== "undefined" && !window.confirm(`Deseja realmente excluir o cupom "${voucher.name}"?`)) return
    setRowActionId(voucher.id)
    try {
      await deleteVoucherById(voucher.id)
      loadVouchers()
    } finally {
      setRowActionId(null)
    }
  }

  const handleToggleOnePerUser = async (voucher: Voucher) => {
    setRowActionId(voucher.id)
    try {
      await updateVoucherById(voucher.id, { one_per_user: !voucher.one_per_user })
      loadVouchers()
    } finally {
      setRowActionId(null)
    }
  }

  const handleToggleStandby = async (voucher: Voucher) => {
    setRowActionId(voucher.id)
    try {
      await updateVoucherById(voucher.id, { paused: !voucher.paused })
      loadVouchers()
    } finally {
      setRowActionId(null)
    }
  }

  const handleForceActivate = async (voucher: Voucher) => {
    setRowActionId(voucher.id)
    try {
      await updateVoucherById(voucher.id, {
        active_from: new Date().toISOString(),
        paused: false,
      })
      loadVouchers()
    } finally {
      setRowActionId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent" />
          <p className="mt-4 text-muted-foreground">Carregando cupons...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Cupons</h1>
          <p className="text-muted-foreground">Crie e acompanhe cupons de desconto. Usos são descontados automaticamente e restaurados em cancelamentos.</p>
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="mr-2 h-4 w-4" />
          Novo cupom
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingVoucher ? "Editar cupom" : "Criar cupom"}</CardTitle>
            <CardDescription>
              Preencha os dados. Data de lançamento opcional: se informada, o cupom só ficará ativo a partir dessa data.
              Após o lançamento, apenas algumas ações são permitidas (pausar, permitir vários usos por pessoa e excluir).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="vname">Nome (dashboard)</Label>
                  <Input
                    id="vname"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Ex.: Black Friday 20%"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vcode">Código</Label>
                  <Input
                    id="vcode"
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="Ex.: PROMO20"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo de desconto</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={form.discount_type === "percent"}
                        onChange={() => setForm((f) => ({ ...f, discount_type: "percent" }))}
                      />
                      Porcentagem
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={form.discount_type === "fixed"}
                        onChange={() => setForm((f) => ({ ...f, discount_type: "fixed" }))}
                      />
                      Valor fixo
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vvalue">
                    {form.discount_type === "percent" ? "Porcentagem (%)" : "Valor (R$)"}
                  </Label>
                  <Input
                    id="vvalue"
                    type="text"
                    inputMode="decimal"
                    value={form.discount_value}
                    onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))}
                    placeholder={form.discount_type === "percent" ? "20" : "15,00"}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="vmax">Máximo de usos</Label>
                  <Input
                    id="vmax"
                    type="number"
                    min={1}
                    value={form.max_uses}
                    onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value }))}
                    placeholder="100"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.one_per_user}
                      onChange={(e) => setForm((f) => ({ ...f, one_per_user: e.target.checked }))}
                    />
                    Um por pessoa
                  </label>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="vfrom">Ativo a partir de (opcional)</Label>
                  <Input
                    id="vfrom"
                    type="datetime-local"
                    value={form.active_from}
                    onChange={(e) => setForm((f) => ({ ...f, active_from: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vuntil">Ativo até (opcional)</Label>
                  <Input
                    id="vuntil"
                    type="datetime-local"
                    value={form.active_until}
                    onChange={(e) => setForm((f) => ({ ...f, active_until: e.target.value }))}
                  />
                </div>
              </div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editingVoucher ? "Salvar alterações" : "Criar cupom"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            Lista de cupons
          </CardTitle>
          <CardDescription>Usos são descontados ao pagar e restaurados ao cancelar reserva.</CardDescription>
        </CardHeader>
        <CardContent>
          {vouchers.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Nenhum cupom criado ainda.</p>
          ) : (
            <div className="space-y-3">
              {vouchers.map((v) => {
                const status = voucherStatus(v)
                const launched = hasLaunched(v)
                const rowBusy = rowActionId === v.id
                return (
                  <div
                    key={v.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4"
                  >
                    <div>
                      <p className="font-medium">{v.name}</p>
                      <p className="text-sm text-muted-foreground">Código: {v.code}</p>
                      <p className="text-sm">
                        Desconto:{" "}
                        {v.discount_type === "percent"
                          ? `${v.discount_value}%`
                          : `R$ ${v.discount_value.toFixed(2)}`}
                        {" · "}
                        Usos: {v.used_count} / {v.max_uses}
                        {v.one_per_user && " · 1 por pessoa"}
                      </p>
                      {v.active_from && (
                        <p className="text-xs text-muted-foreground">Ativo a partir de: {formatDate(v.active_from)}</p>
                      )}
                      {v.active_until && (
                        <p className="text-xs text-muted-foreground">Válido até: {formatDate(v.active_until)}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={status === "active" ? "default" : "secondary"}>
                        {statusLabel(status)}
                      </Badge>
                      <div className="flex flex-wrap gap-2 justify-end">
                        {status === "scheduled" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={rowBusy}
                            onClick={() => openEditForm(v)}
                          >
                            Editar
                          </Button>
                        )}
                        {status === "scheduled" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={rowBusy}
                            onClick={() => handleForceActivate(v)}
                          >
                            Ativar agora
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={rowBusy}
                          onClick={() => handleToggleOnePerUser(v)}
                        >
                          {v.one_per_user ? "Permitir vários usos" : "Um por pessoa"}
                        </Button>
                        {launched && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={rowBusy}
                            onClick={() => handleToggleStandby(v)}
                          >
                            {v.paused ? "Retomar" : "Stand-by"}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={rowBusy}
                          onClick={() => handleDelete(v)}
                        >
                          Excluir
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
