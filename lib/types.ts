export type UserRole = "admin" | "user"

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  phone?: string
  created_at: string
  updated_at?: string
}

/* =========================
   STATION (Firestore-aligned)
   total_chargers / available_chargers podem ser derivados da coleção chargers
========================= */
export interface Station {
  id: string
  name: string

  // Localização
  address: string
  city: string
  state: string
  latitude: number
  longitude: number

  // Operação
  price_per_kwh: number
  status: "active" | "maintenance" | "inactive"
  owner_id: string
  created_at: string
  updated_at: string

  // Opcionais (plan)
  opening_hours?: { start: string; end: string }
  timezone?: string
  amenities?: string[]
  image_urls?: string[]

  // Derivados no cliente quando necessário (compatibilidade com código que usa)
  total_chargers?: number
  available_chargers?: number
  power_output?: string
  connector_types?: string[]
  min_current_a?: number
  max_current_a?: number
  min_power_kw?: number
  max_power_kw?: number
}

/* =========================
   CHARGER (Firestore-aligned)
   price_per_kwh opcional: se omitido, usa o da estação
========================= */
export interface Charger {
  id: string
  station_id: string
  charger_number: string
  status: "available" | "occupied" | "maintenance" | "reserved"
  connector_type: string
  power_output: string
  /** Potência máxima em kW (numérico) */
  power_kw?: number
  /** Corrente máxima em A (numérico) */
  current_a?: number
  /** Tensão em V usada para conversão P = U×I (ex.: 400 trifásico) */
  voltage_v?: number
  current_session_id?: string
  price_per_kwh?: number
  model?: string
}

/* =========================
   BOOKING
========================= */
export interface Booking {
  id: string
  user_id: string
  station_id: string
  charger_id: string
  start_time: string
  end_time: string
  status: "pending" | "active" | "completed" | "cancelled"

  total_kwh?: number
  total_cost?: number

  payment_status: "pending" | "paid" | "failed"
  created_at: string
  voucher_id?: string
}

/* =========================
   CHARGING SESSION (sessão real de recarga)
========================= */
export interface ChargingSession {
  id: string
  booking_id: string
  user_id: string
  station_id: string
  charger_id: string
  start_time: string
  end_time?: string
  kwh_consumed: number
  cost: number
  status: "active" | "completed"
}

/* =========================
   PAYMENT
========================= */
export interface Payment {
  id: string
  booking_id: string
  user_id: string
  amount: number
  status: "pending" | "completed" | "failed"
  payment_method: string
  created_at: string
  refund_of_id?: string
  voucher_id?: string
}

/* =========================
   ACTIVITY LOG (histórico admin)
========================= */
export type ActivityLogType = "booking_created" | "booking_cancelled" | "payment_completed"

export interface ActivityLogPayloadBooking {
  booking_id: string
  user_id: string
  station_id: string
  charger_id: string
  start_time?: string
  end_time?: string
  reason?: string
}

export interface ActivityLogPayloadPayment {
  payment_id: string
  booking_id: string
  user_id: string
  amount: number
  station_id: string
  charger_id: string
}

export type ActivityLogPayload = ActivityLogPayloadBooking | ActivityLogPayloadPayment

export interface ActivityLog {
  id: string
  type: ActivityLogType
  actor_id: string
  actor_display: string
  created_at: string
  payload: ActivityLogPayload
}

/* =========================
   VOUCHER / COUPON
========================= */
export type VoucherDiscountType = "percent" | "fixed"

export interface Voucher {
  id: string
  code: string
  name: string
  discount_type: VoucherDiscountType
  discount_value: number
  max_uses: number
  used_count: number
  one_per_user: boolean
  /** Quando true, o cupom está em stand-by (pausado) mesmo dentro da janela de validade. */
  paused?: boolean
  active_from?: string
  active_until?: string
  created_at: string
  created_by: string
}

export interface VoucherUsage {
  id: string
  voucher_id: string
  user_id: string
  booking_id: string
  used_at: string
}
