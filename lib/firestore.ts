"use client"

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  type DocumentData,
} from "firebase/firestore"
import { db } from "./firebase"
import type { Station, Charger, Booking, ChargingSession, Payment, User, ActivityLog, ActivityLogType, ActivityLogPayload, Voucher, VoucherUsage } from "./types"

function getDb() {
  if (!db) throw new Error("Firebase não configurado. Defina NEXT_PUBLIC_FIREBASE_* em .env.local")
  return db
}

const COLLECTIONS = {
  STATIONS: "stations",
  CHARGERS: "chargers",
  BOOKINGS: "bookings",
  CHARGING_SESSIONS: "chargingSessions",
  PAYMENTS: "payments",
  USERS: "users",
  ACTIVITY_LOG: "activityLog",
  VOUCHERS: "vouchers",
  VOUCHER_USAGES: "voucherUsages",
} as const

// -----------------------------
// Helpers: Timestamp <-> ISO string
// -----------------------------

function toFirestoreTime(value: string | undefined): Timestamp | undefined {
  if (!value) return undefined
  const d = new Date(value)
  return Timestamp.fromDate(d)
}

function fromFirestoreTime(value: Timestamp | undefined): string {
  if (!value) return new Date().toISOString()
  return value.toDate().toISOString()
}

function serializeStation(data: DocumentData, id: string): Station {
  const s = data as Record<string, unknown>
  return {
    id,
    name: String(s.name ?? ""),
    address: String(s.address ?? ""),
    city: String(s.city ?? ""),
    state: String(s.state ?? ""),
    latitude: Number(s.latitude ?? 0),
    longitude: Number(s.longitude ?? 0),
    price_per_kwh: Number(s.price_per_kwh ?? 0),
    status: (s.status as Station["status"]) ?? "active",
    owner_id: String(s.owner_id ?? ""),
    created_at: s.created_at instanceof Timestamp ? fromFirestoreTime(s.created_at) : String(s.created_at ?? ""),
    updated_at: s.updated_at instanceof Timestamp ? fromFirestoreTime(s.updated_at) : String(s.updated_at ?? ""),
    ...(s.opening_hours && { opening_hours: s.opening_hours as { start: string; end: string } }),
    ...(s.timezone && { timezone: String(s.timezone) }),
    ...(Array.isArray(s.amenities) && { amenities: s.amenities as string[] }),
    ...(Array.isArray(s.image_urls) && { image_urls: s.image_urls as string[] }),
  }
}

function parsePowerOutputToKw(powerOutput: string): number | undefined {
  const match = String(powerOutput).match(/^(\d+(?:[.,]\d+)?)\s*kw/i)
  if (!match) return undefined
  return Number.parseFloat(match[1].replace(",", "."))
}

function serializeCharger(data: DocumentData, id: string): Charger {
  const c = data as Record<string, unknown>
  const powerKw = typeof c.power_kw === "number" ? c.power_kw : undefined
  const currentA = typeof c.current_a === "number" ? c.current_a : undefined
  const voltageV = typeof c.voltage_v === "number" ? c.voltage_v : undefined
  const powerOutputRaw = String(c.power_output ?? "")
  const powerOutput =
    powerOutputRaw ||
    (typeof powerKw === "number" && !Number.isNaN(powerKw) ? `${powerKw} kW` : "")
  const derivedPowerKw =
    powerKw ??
    (powerOutputRaw ? parsePowerOutputToKw(powerOutputRaw) : undefined)
  return {
    id,
    station_id: String(c.station_id ?? ""),
    charger_number: String(c.charger_number ?? ""),
    status: (c.status as Charger["status"]) ?? "available",
    connector_type: String(c.connector_type ?? ""),
    power_output: powerOutput,
    ...(typeof derivedPowerKw === "number" && { power_kw: derivedPowerKw }),
    ...(typeof currentA === "number" && { current_a: currentA }),
    ...(typeof voltageV === "number" && { voltage_v: voltageV }),
    ...(c.current_session_id && { current_session_id: String(c.current_session_id) }),
    ...(typeof c.price_per_kwh === "number" && { price_per_kwh: c.price_per_kwh }),
    ...(c.model && { model: String(c.model) }),
  }
}

function serializeBooking(data: DocumentData, id: string): Booking {
  const b = data as Record<string, unknown>
  return {
    id,
    user_id: String(b.user_id ?? ""),
    station_id: String(b.station_id ?? ""),
    charger_id: String(b.charger_id ?? ""),
    start_time: b.start_time instanceof Timestamp ? fromFirestoreTime(b.start_time) : String(b.start_time ?? ""),
    end_time: b.end_time instanceof Timestamp ? fromFirestoreTime(b.end_time) : String(b.end_time ?? ""),
    status: (b.status as Booking["status"]) ?? "pending",
    payment_status: (b.payment_status as Booking["payment_status"]) ?? "pending",
    created_at: b.created_at instanceof Timestamp ? fromFirestoreTime(b.created_at) : String(b.created_at ?? ""),
    ...(typeof b.total_kwh === "number" && { total_kwh: b.total_kwh }),
    ...(typeof b.total_cost === "number" && { total_cost: b.total_cost }),
    ...(b.voucher_id && { voucher_id: String(b.voucher_id) }),
  }
}

function serializeChargingSession(data: DocumentData, id: string): ChargingSession {
  const s = data as Record<string, unknown>
  return {
    id,
    booking_id: String(s.booking_id ?? ""),
    user_id: String(s.user_id ?? ""),
    station_id: String(s.station_id ?? ""),
    charger_id: String(s.charger_id ?? ""),
    start_time: s.start_time instanceof Timestamp ? fromFirestoreTime(s.start_time) : String(s.start_time ?? ""),
    kwh_consumed: Number(s.kwh_consumed ?? 0),
    cost: Number(s.cost ?? 0),
    status: (s.status as ChargingSession["status"]) ?? "active",
    ...(s.end_time && { end_time: s.end_time instanceof Timestamp ? fromFirestoreTime(s.end_time) : String(s.end_time) }),
  }
}

function serializePayment(data: DocumentData, id: string): Payment {
  const p = data as Record<string, unknown>
  return {
    id,
    booking_id: String(p.booking_id ?? ""),
    user_id: String(p.user_id ?? ""),
    amount: Number(p.amount ?? 0),
    status: (p.status as Payment["status"]) ?? "pending",
    payment_method: String(p.payment_method ?? ""),
    created_at: p.created_at instanceof Timestamp ? fromFirestoreTime(p.created_at) : String(p.created_at ?? ""),
    ...(p.refund_of_id && { refund_of_id: String(p.refund_of_id) }),
    ...(p.voucher_id && { voucher_id: String(p.voucher_id) }),
  }
}

function serializeUser(data: DocumentData, id: string): User {
  const u = data as Record<string, unknown>
  return {
    id,
    email: String(u.email ?? ""),
    name: String(u.name ?? ""),
    role: (u.role as User["role"]) ?? "user",
    created_at: u.created_at instanceof Timestamp ? fromFirestoreTime(u.created_at) : String(u.created_at ?? ""),
    ...(u.phone && { phone: String(u.phone) }),
    ...(u.updated_at && { updated_at: u.updated_at instanceof Timestamp ? fromFirestoreTime(u.updated_at) : String(u.updated_at) }),
  }
}

function serializeActivityLog(data: DocumentData, id: string): ActivityLog {
  const a = data as Record<string, unknown>
  return {
    id,
    type: (a.type as ActivityLogType) ?? "booking_created",
    actor_id: String(a.actor_id ?? ""),
    actor_display: String(a.actor_display ?? ""),
    created_at: a.created_at instanceof Timestamp ? fromFirestoreTime(a.created_at) : String(a.created_at ?? ""),
    payload: a.payload as ActivityLogPayload,
  }
}

function serializeVoucher(data: DocumentData, id: string): Voucher {
  const v = data as Record<string, unknown>
  return {
    id,
    code: String(v.code ?? ""),
    name: String(v.name ?? ""),
    discount_type: (v.discount_type as Voucher["discount_type"]) ?? "percent",
    discount_value: Number(v.discount_value ?? 0),
    max_uses: Number(v.max_uses ?? 0),
    used_count: Number(v.used_count ?? 0),
    one_per_user: Boolean(v.one_per_user),
    ...(typeof v.paused === "boolean" && { paused: v.paused }),
    created_at: v.created_at instanceof Timestamp ? fromFirestoreTime(v.created_at) : String(v.created_at ?? ""),
    created_by: String(v.created_by ?? ""),
    ...(v.active_from && { active_from: v.active_from instanceof Timestamp ? fromFirestoreTime(v.active_from) : String(v.active_from) }),
    ...(v.active_until && { active_until: v.active_until instanceof Timestamp ? fromFirestoreTime(v.active_until) : String(v.active_until) }),
  }
}

function serializeVoucherUsage(data: DocumentData, id: string): VoucherUsage {
  const u = data as Record<string, unknown>
  return {
    id,
    voucher_id: String(u.voucher_id ?? ""),
    user_id: String(u.user_id ?? ""),
    booking_id: String(u.booking_id ?? ""),
    used_at: u.used_at instanceof Timestamp ? fromFirestoreTime(u.used_at) : String(u.used_at ?? ""),
  }
}

// -----------------------------
// Users (Firebase Auth UID = document ID)
// -----------------------------

export async function getUsers(): Promise<User[]> {
  const snap = await getDocs(collection(getDb(), COLLECTIONS.USERS))
  return snap.docs.map((d) => serializeUser(d.data(), d.id))
}

export async function getUser(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(getDb(), COLLECTIONS.USERS, uid))
  if (!snap.exists()) return null
  return serializeUser(snap.data(), snap.id)
}

export async function setUser(uid: string, data: Partial<Omit<User, "id">> & { email: string; name: string; role: User["role"] }): Promise<void> {
  const ref = doc(getDb(), COLLECTIONS.USERS, uid)
  const snap = await getDoc(ref)
  const now = Timestamp.now()
  const payload: DocumentData = {
    email: data.email,
    name: data.name,
    role: data.role,
    updated_at: now,
  }
  if (data.phone !== undefined) payload.phone = data.phone
  if (!snap.exists()) {
    payload.created_at = now
    await setDoc(ref, payload)
  } else {
    await updateDoc(ref, payload)
  }
}

export async function getStations(): Promise<Station[]> {
  const snap = await getDocs(collection(getDb(), COLLECTIONS.STATIONS))
  return snap.docs.map((d) => serializeStation(d.data(), d.id))
}

export async function getStation(id: string): Promise<Station | null> {
  const ref = doc(getDb(), COLLECTIONS.STATIONS, id)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return serializeStation(snap.data(), snap.id)
}

export function getStationById(id: string): Promise<Station | null> {
  return getStation(id)
}

function stationCurrentRange(chargers: Charger[]): { min_current_a?: number; max_current_a?: number } {
  const currents = chargers
    .map((c) => c.current_a)
    .filter((a): a is number => typeof a === "number" && !Number.isNaN(a))
  if (!currents.length) return {}
  return {
    min_current_a: Math.min(...currents),
    max_current_a: Math.max(...currents),
  }
}

function stationPowerRange(chargers: Charger[]): { min_power_kw?: number; max_power_kw?: number } {
  const kws = chargers
    .map((c) => c.power_kw)
    .filter((k): k is number => typeof k === "number" && !Number.isNaN(k))
  if (!kws.length) return {}
  return {
    min_power_kw: Math.min(...kws),
    max_power_kw: Math.max(...kws),
  }
}

/** Estação com total_chargers e available_chargers derivados dos carregadores */
export async function getStationWithCounts(id: string): Promise<Station | null> {
  const station = await getStation(id)
  if (!station) return null
  const chargers = await getStationChargers(id)
  const range = stationCurrentRange(chargers)
  const powerRange = stationPowerRange(chargers)
  return {
    ...station,
    total_chargers: chargers.length,
    available_chargers: chargers.filter((c) => c.status === "available").length,
    connector_types: [...new Set(chargers.map((c) => c.connector_type))],
    power_output: chargers[0]?.power_output ?? station.power_output ?? "",
    ...range,
    ...powerRange,
  }
}

/** Lista estações com contagens (para listagens) */
export async function getStationsWithCounts(): Promise<Station[]> {
  const stations = await getStations()
  const result: Station[] = []
  for (const s of stations) {
    const chargers = await getStationChargers(s.id)
    const range = stationCurrentRange(chargers)
    const powerRange = stationPowerRange(chargers)
    result.push({
      ...s,
      total_chargers: chargers.length,
      available_chargers: chargers.filter((c) => c.status === "available").length,
      connector_types: [...new Set(chargers.map((c) => c.connector_type))],
      power_output: chargers[0]?.power_output ?? s.power_output ?? "",
      ...range,
      ...powerRange,
    })
  }
  return result
}

export async function createStation(
  station: Omit<Station, "id" | "created_at" | "updated_at">
): Promise<Station> {
  const now = Timestamp.now()
  const payload: DocumentData = {
    name: station.name,
    address: station.address,
    city: station.city,
    state: station.state,
    latitude: station.latitude,
    longitude: station.longitude,
    price_per_kwh: station.price_per_kwh,
    status: station.status,
    owner_id: station.owner_id,
    created_at: now,
    updated_at: now,
  }
  if (station.opening_hours) payload.opening_hours = station.opening_hours
  if (station.timezone) payload.timezone = station.timezone
  if (station.amenities?.length) payload.amenities = station.amenities
  if (station.image_urls?.length) payload.image_urls = station.image_urls

  const ref = await addDoc(collection(getDb(), COLLECTIONS.STATIONS), payload)
  const created = await getStation(ref.id)
  if (!created) throw new Error("Failed to read created station")
  return created
}

export async function updateStationById(id: string, data: Partial<Station>): Promise<void> {
  const ref = doc(getDb(), COLLECTIONS.STATIONS, id)
  const payload: DocumentData = { ...data, updated_at: Timestamp.now() }
  delete payload.id
  delete payload.created_at
  delete payload.updated_at
  delete payload.total_chargers
  delete payload.available_chargers
  delete payload.connector_types
  delete payload.power_output
  delete payload.min_current_a
  delete payload.max_current_a
  delete payload.min_power_kw
  delete payload.max_power_kw
  await updateDoc(ref, payload)
}

export async function updateStation(station: Station): Promise<void> {
  return updateStationById(station.id, station)
}

export async function deleteCharger(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), COLLECTIONS.CHARGERS, id))
}

export async function deleteStation(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), COLLECTIONS.STATIONS, id))
}

/** Remove a estação e todos os carregadores vinculados. */
export async function deleteStationWithChargers(stationId: string): Promise<void> {
  const chargers = await getStationChargers(stationId)
  for (const c of chargers) {
    await deleteCharger(c.id)
  }
  await deleteStation(stationId)
}

// -----------------------------
// Chargers
// -----------------------------

export async function getChargers(): Promise<Charger[]> {
  const snap = await getDocs(collection(getDb(), COLLECTIONS.CHARGERS))
  return snap.docs.map((d) => serializeCharger(d.data(), d.id))
}

export async function getCharger(id: string): Promise<Charger | null> {
  const snap = await getDoc(doc(getDb(), COLLECTIONS.CHARGERS, id))
  if (!snap.exists()) return null
  return serializeCharger(snap.data(), snap.id)
}

export async function getStationChargers(stationId: string): Promise<Charger[]> {
  const q = query(
    collection(getDb(), COLLECTIONS.CHARGERS),
    where("station_id", "==", stationId)
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => serializeCharger(d.data(), d.id))
}

function nextChargerNumberForStation(existingChargers: Charger[]): string {
  if (!existingChargers.length) return "1"
  const numbers = existingChargers
    .map((c) => Number.parseInt(String(c.charger_number).replace(/^0+/, ""), 10) || 0)
    .filter((n) => Number.isInteger(n) && n >= 0)
  return numbers.length ? String(Math.max(...numbers) + 1) : "1"
}

export async function createCharger(
  charger: Omit<Charger, "id">
): Promise<Charger> {
  let chargerNumber = charger.charger_number?.trim()
  if (!chargerNumber) {
    const existing = await getStationChargers(charger.station_id)
    chargerNumber = nextChargerNumberForStation(existing)
  }
  const powerKw = typeof charger.power_kw === "number" ? charger.power_kw : undefined
  const currentA = typeof charger.current_a === "number" ? charger.current_a : undefined
  const voltageV = typeof charger.voltage_v === "number" ? charger.voltage_v : undefined
  const powerOutput =
    charger.power_output?.trim() ||
    (typeof powerKw === "number" ? `${powerKw} kW` : "")
  const payload: DocumentData = {
    station_id: charger.station_id,
    charger_number: chargerNumber,
    status: charger.status,
    connector_type: charger.connector_type,
    power_output: powerOutput || "—",
  }
  if (typeof powerKw === "number") payload.power_kw = powerKw
  if (typeof currentA === "number") payload.current_a = currentA
  if (typeof voltageV === "number") payload.voltage_v = voltageV
  if (charger.current_session_id) payload.current_session_id = charger.current_session_id
  if (typeof charger.price_per_kwh === "number") payload.price_per_kwh = charger.price_per_kwh
  if (charger.model) payload.model = charger.model

  const ref = await addDoc(collection(getDb(), COLLECTIONS.CHARGERS), payload)
  const created = await getCharger(ref.id)
  if (!created) throw new Error("Failed to read created charger")
  return created
}

export async function updateCharger(id: string, data: Partial<Charger>): Promise<void> {
  const ref = doc(getDb(), COLLECTIONS.CHARGERS, id)
  const payload = { ...data }
  delete (payload as Record<string, unknown>).id
  await updateDoc(ref, payload)
}

// -----------------------------
// Bookings
// -----------------------------

export async function getBookings(): Promise<Booking[]> {
  const snap = await getDocs(
    query(collection(getDb(), COLLECTIONS.BOOKINGS), orderBy("created_at", "desc"))
  )
  const now = Date.now()
  const bookings = snap.docs.map((d) => serializeBooking(d.data(), d.id))

  const updates: Promise<void>[] = []
  for (const booking of bookings) {
    const end = new Date(booking.end_time).getTime()
    if (!Number.isNaN(end) && end <= now) {
      const bookingRef = doc(getDb(), COLLECTIONS.BOOKINGS, booking.id)
      if (booking.status === "active") {
        booking.status = "completed"
        updates.push(updateDoc(bookingRef, { status: "completed" }))
        updates.push(
          updateCharger(booking.charger_id, {
            status: "available",
            current_session_id: null as unknown as string,
          })
        )
      } else if (booking.status === "pending") {
        booking.status = "cancelled"
        updates.push(updateDoc(bookingRef, { status: "cancelled" }))
        updates.push(
          updateCharger(booking.charger_id, {
            status: "available",
            current_session_id: null as unknown as string,
          })
        )
      }
    }
  }
  if (updates.length > 0) {
    await Promise.all(updates)
  }
  return bookings
}

export async function getUserBookings(userId: string): Promise<Booking[]> {
  const q = query(
    collection(getDb(), COLLECTIONS.BOOKINGS),
    where("user_id", "==", userId),
    orderBy("created_at", "desc")
  )
  const snap = await getDocs(q)
  const now = Date.now()
  const bookings = snap.docs.map((d) => serializeBooking(d.data(), d.id))

  const updates: Promise<void>[] = []
  for (const booking of bookings) {
    const end = new Date(booking.end_time).getTime()
    if (!Number.isNaN(end) && end <= now) {
      const bookingRef = doc(getDb(), COLLECTIONS.BOOKINGS, booking.id)
      if (booking.status === "active") {
        booking.status = "completed"
        updates.push(updateDoc(bookingRef, { status: "completed" }))
        updates.push(
          updateCharger(booking.charger_id, {
            status: "available",
            current_session_id: null as unknown as string,
          })
        )
      } else if (booking.status === "pending") {
        booking.status = "cancelled"
        updates.push(updateDoc(bookingRef, { status: "cancelled" }))
        updates.push(
          updateCharger(booking.charger_id, {
            status: "available",
            current_session_id: null as unknown as string,
          })
        )
      }
    }
  }
  if (updates.length > 0) {
    await Promise.all(updates)
  }
  return bookings
}

export async function getBookingsByCharger(chargerId: string): Promise<Booking[]> {
  const q = query(
    collection(getDb(), COLLECTIONS.BOOKINGS),
    where("charger_id", "==", chargerId),
    orderBy("start_time", "asc")
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => serializeBooking(d.data(), d.id))
}

/**
 * Verifica se existe reserva ativa no mesmo carregador que sobrepõe o intervalo [start, end].
 * Retorna true se há conflito (não pode reservar).
 */
export async function hasBookingConflict(
  chargerId: string,
  startTime: string,
  endTime: string,
  excludeBookingId?: string
): Promise<boolean> {
  const start = new Date(startTime).getTime()
  const end = new Date(endTime).getTime()
  const bookings = await getBookingsByCharger(chargerId)
  for (const b of bookings) {
    if (b.status === "cancelled") continue
    if (excludeBookingId && b.id === excludeBookingId) continue
    const bStart = new Date(b.start_time).getTime()
    const bEnd = new Date(b.end_time).getTime()
    if (start < bEnd && end > bStart) return true
  }
  return false
}

export async function createBooking(
  booking: Omit<Booking, "id" | "created_at">
): Promise<Booking> {
  const conflict = await hasBookingConflict(
    booking.charger_id,
    booking.start_time,
    booking.end_time
  )
  if (conflict) {
    throw new Error("CONFLICT: Este carregador já possui reserva neste horário.")
  }
  const now = Timestamp.now()
  const payload: DocumentData = {
    user_id: booking.user_id,
    station_id: booking.station_id,
    charger_id: booking.charger_id,
    start_time: toFirestoreTime(booking.start_time) ?? now,
    end_time: toFirestoreTime(booking.end_time) ?? now,
    status: booking.status,
    payment_status: booking.payment_status,
    created_at: now,
  }
  if (typeof booking.total_kwh === "number") payload.total_kwh = booking.total_kwh
  if (typeof booking.total_cost === "number") payload.total_cost = booking.total_cost
  if (booking.voucher_id) payload.voucher_id = booking.voucher_id

  const ref = await addDoc(collection(getDb(), COLLECTIONS.BOOKINGS), payload)

  // Ao criar a reserva, marcar o carregador como "reserved"
  await updateCharger(booking.charger_id, {
    status: "reserved",
    current_session_id: ref.id,
  })

  return getDoc(ref).then((snap) => serializeBooking(snap.data() ?? {}, snap.id))
}

export async function updateBooking(booking: Booking): Promise<void> {
  const ref = doc(getDb(), COLLECTIONS.BOOKINGS, booking.id)
  const payload: DocumentData = {
    user_id: booking.user_id,
    station_id: booking.station_id,
    charger_id: booking.charger_id,
    start_time: toFirestoreTime(booking.start_time),
    end_time: toFirestoreTime(booking.end_time),
    status: booking.status,
    payment_status: booking.payment_status,
  }
  if (typeof booking.total_kwh === "number") payload.total_kwh = booking.total_kwh
  if (typeof booking.total_cost === "number") payload.total_cost = booking.total_cost
  if (booking.voucher_id) payload.voucher_id = booking.voucher_id
  await updateDoc(ref, payload)
}

export async function getBooking(id: string): Promise<Booking | null> {
  const snap = await getDoc(doc(getDb(), COLLECTIONS.BOOKINGS, id))
  if (!snap.exists()) return null
  return serializeBooking(snap.data(), snap.id)
}

// -----------------------------
// Charging sessions
// -----------------------------

export async function getChargingSessions(): Promise<ChargingSession[]> {
  const snap = await getDocs(collection(getDb(), COLLECTIONS.CHARGING_SESSIONS))
  return snap.docs.map((d) => serializeChargingSession(d.data(), d.id))
}

export async function createChargingSession(
  session: Omit<ChargingSession, "id">
): Promise<ChargingSession> {
  const payload: DocumentData = {
    booking_id: session.booking_id,
    user_id: session.user_id,
    station_id: session.station_id,
    charger_id: session.charger_id,
    start_time: toFirestoreTime(session.start_time) ?? Timestamp.now(),
    kwh_consumed: session.kwh_consumed,
    cost: session.cost,
    status: session.status,
  }
  if (session.end_time) payload.end_time = toFirestoreTime(session.end_time)
  const ref = await addDoc(collection(getDb(), COLLECTIONS.CHARGING_SESSIONS), payload)
  const snap = await getDoc(ref)
  return serializeChargingSession(snap.data() ?? {}, snap.id)
}

export async function updateChargingSession(
  id: string,
  data: Partial<ChargingSession>
): Promise<void> {
  const ref = doc(getDb(), COLLECTIONS.CHARGING_SESSIONS, id)
  const payload = { ...data }
  delete (payload as Record<string, unknown>).id
  if (payload.start_time) (payload as DocumentData).start_time = toFirestoreTime(payload.start_time as string)
  if (payload.end_time) (payload as DocumentData).end_time = toFirestoreTime(payload.end_time as string)
  await updateDoc(ref, payload)
}

// -----------------------------
// Payments
// -----------------------------

export async function getPayments(): Promise<Payment[]> {
  const snap = await getDocs(
    query(collection(getDb(), COLLECTIONS.PAYMENTS), orderBy("created_at", "desc"))
  )
  return snap.docs.map((d) => serializePayment(d.data(), d.id))
}

export async function createPayment(
  payment: Omit<Payment, "id" | "created_at">
): Promise<Payment> {
  const now = Timestamp.now()
  const payload: DocumentData = {
    booking_id: payment.booking_id,
    user_id: payment.user_id,
    amount: payment.amount,
    status: payment.status,
    payment_method: payment.payment_method,
    created_at: now,
  }
  if (payment.refund_of_id) payload.refund_of_id = payment.refund_of_id
  if (payment.voucher_id) payload.voucher_id = payment.voucher_id
  const ref = await addDoc(collection(getDb(), COLLECTIONS.PAYMENTS), payload)
  const snap = await getDoc(ref)
  return serializePayment(snap.data() ?? {}, snap.id)
}

// -----------------------------
// Vouchers
// -----------------------------

export async function createVoucher(
  voucher: Omit<Voucher, "id" | "used_count" | "created_at">
): Promise<Voucher> {
  const now = Timestamp.now()
  const payload: DocumentData = {
    code: voucher.code.trim().toUpperCase(),
    name: voucher.name.trim(),
    discount_type: voucher.discount_type,
    discount_value: voucher.discount_value,
    max_uses: voucher.max_uses,
    used_count: 0,
    one_per_user: voucher.one_per_user,
    created_at: now,
    created_by: voucher.created_by,
  }
  if (voucher.active_from) payload.active_from = toFirestoreTime(voucher.active_from) ?? voucher.active_from
  if (voucher.active_until) payload.active_until = toFirestoreTime(voucher.active_until) ?? voucher.active_until
  const ref = await addDoc(collection(getDb(), COLLECTIONS.VOUCHERS), payload)
  const snap = await getDoc(ref)
  return serializeVoucher(snap.data() ?? {}, snap.id)
}

export async function getVouchers(): Promise<Voucher[]> {
  const snap = await getDocs(
    query(collection(getDb(), COLLECTIONS.VOUCHERS), orderBy("created_at", "desc"))
  )
  return snap.docs.map((d) => serializeVoucher(d.data(), d.id))
}

export async function getVoucher(id: string): Promise<Voucher | null> {
  const snap = await getDoc(doc(getDb(), COLLECTIONS.VOUCHERS, id))
  if (!snap.exists()) return null
  return serializeVoucher(snap.data(), snap.id)
}

export async function getVoucherByCode(code: string): Promise<Voucher | null> {
  const normalized = code.trim().toUpperCase()
  const q = query(
    collection(getDb(), COLLECTIONS.VOUCHERS),
    where("code", "==", normalized)
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  return serializeVoucher(snap.docs[0].data(), snap.docs[0].id)
}

function isVoucherActive(v: Voucher): boolean {
  if (v.paused) return false
  const now = Date.now()
  if (v.active_from) {
    const from = new Date(v.active_from).getTime()
    if (Number.isNaN(from) || now < from) return false
  }
  if (v.active_until) {
    const until = new Date(v.active_until).getTime()
    if (Number.isNaN(until) || now > until) return false
  }
  return true
}

export async function validateVoucher(code: string, userId?: string): Promise<{ valid: true; voucher: Voucher } | { valid: false; error: string }> {
  const voucher = await getVoucherByCode(code)
  if (!voucher) return { valid: false, error: "Cupom não encontrado." }
  if (!isVoucherActive(voucher)) return { valid: false, error: "Cupom não está ativo ou já expirou." }
  if (voucher.used_count >= voucher.max_uses) return { valid: false, error: "Cupom esgotado." }
  if (voucher.one_per_user && userId) {
    const q = query(
      collection(getDb(), COLLECTIONS.VOUCHER_USAGES),
      where("voucher_id", "==", voucher.id),
      where("user_id", "==", userId)
    )
    const snap = await getDocs(q)
    if (!snap.empty) return { valid: false, error: "Você já utilizou este cupom." }
  }
  return { valid: true, voucher }
}

export async function useVoucher(voucherId: string, userId: string, bookingId: string): Promise<void> {
  const v = await getVoucher(voucherId)
  if (!v) throw new Error("Cupom não encontrado.")
  if (v.used_count >= v.max_uses) throw new Error("Cupom esgotado.")
  const ref = doc(getDb(), COLLECTIONS.VOUCHERS, voucherId)
  await updateDoc(ref, { used_count: v.used_count + 1 })
  if (v.one_per_user) {
    const now = Timestamp.now()
    await addDoc(collection(getDb(), COLLECTIONS.VOUCHER_USAGES), {
      voucher_id: voucherId,
      user_id: userId,
      booking_id: bookingId,
      used_at: now,
    })
  }
}

export async function releaseVoucherUsage(bookingId: string): Promise<void> {
  const booking = await getBooking(bookingId)
  if (!booking?.voucher_id) return
  const voucherId = booking.voucher_id
  const v = await getVoucher(voucherId)
  if (!v) return
  const usageQ = query(
    collection(getDb(), COLLECTIONS.VOUCHER_USAGES),
    where("booking_id", "==", bookingId)
  )
  const snap = await getDocs(usageQ)
  if (!snap.empty) {
    for (const d of snap.docs) {
      await deleteDoc(doc(getDb(), COLLECTIONS.VOUCHER_USAGES, d.id))
    }
  }
  const ref = doc(getDb(), COLLECTIONS.VOUCHERS, voucherId)
  const newCount = Math.max(0, v.used_count - 1)
  await updateDoc(ref, { used_count: newCount })
}

export async function updateVoucherById(id: string, data: Partial<Voucher>): Promise<void> {
  const ref = doc(getDb(), COLLECTIONS.VOUCHERS, id)
  const payload: DocumentData = {}

  if (data.code !== undefined) payload.code = data.code.trim().toUpperCase()
  if (data.name !== undefined) payload.name = data.name.trim()
  if (data.discount_type !== undefined) payload.discount_type = data.discount_type
  if (data.discount_value !== undefined) payload.discount_value = data.discount_value
  if (data.max_uses !== undefined) payload.max_uses = data.max_uses
  if (data.one_per_user !== undefined) payload.one_per_user = data.one_per_user
  if (data.paused !== undefined) payload.paused = data.paused

  if (data.active_from !== undefined) {
    if (data.active_from) {
      payload.active_from = toFirestoreTime(data.active_from) ?? data.active_from
    } else {
      payload.active_from = null
    }
  }
  if (data.active_until !== undefined) {
    if (data.active_until) {
      payload.active_until = toFirestoreTime(data.active_until) ?? data.active_until
    } else {
      payload.active_until = null
    }
  }

  await updateDoc(ref, payload)
}

export async function deleteVoucherById(id: string): Promise<void> {
  const ref = doc(getDb(), COLLECTIONS.VOUCHERS, id)
  await deleteDoc(ref)
}

// -----------------------------
// Activity Log (histórico admin)
// -----------------------------

export async function logActivity(
  type: ActivityLogType,
  actorId: string,
  actorDisplay: string,
  payload: ActivityLogPayload
): Promise<void> {
  const now = Timestamp.now()
  const data: DocumentData = {
    type,
    actor_id: actorId,
    actor_display: actorDisplay,
    created_at: now,
    payload,
  }
  await addDoc(collection(getDb(), COLLECTIONS.ACTIVITY_LOG), data)
}

export async function getActivityLog(limitCount?: number): Promise<ActivityLog[]> {
  const coll = collection(getDb(), COLLECTIONS.ACTIVITY_LOG)
  const q = limitCount
    ? query(coll, orderBy("created_at", "desc"), limit(limitCount))
    : query(coll, orderBy("created_at", "desc"))
  const snap = await getDocs(q)
  return snap.docs.map((d) => serializeActivityLog(d.data(), d.id))
}

export { COLLECTIONS }
