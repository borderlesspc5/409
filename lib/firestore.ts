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
  Timestamp,
  type DocumentData,
} from "firebase/firestore"
import { db } from "./firebase"
import type { Station, Charger, Booking, ChargingSession, Payment, User } from "./types"

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

function serializeCharger(data: DocumentData, id: string): Charger {
  const c = data as Record<string, unknown>
  return {
    id,
    station_id: String(c.station_id ?? ""),
    charger_number: String(c.charger_number ?? ""),
    status: (c.status as Charger["status"]) ?? "available",
    connector_type: String(c.connector_type ?? ""),
    power_output: String(c.power_output ?? ""),
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

// -----------------------------
// Users (Firebase Auth UID = document ID)
// -----------------------------

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

/** Estação com total_chargers e available_chargers derivados dos carregadores */
export async function getStationWithCounts(id: string): Promise<Station | null> {
  const station = await getStation(id)
  if (!station) return null
  const chargers = await getStationChargers(id)
  return {
    ...station,
    total_chargers: chargers.length,
    available_chargers: chargers.filter((c) => c.status === "available").length,
    connector_types: [...new Set(chargers.map((c) => c.connector_type))],
    power_output: chargers[0]?.power_output ?? station.power_output ?? "",
  }
}

/** Lista estações com contagens (para listagens) */
export async function getStationsWithCounts(): Promise<Station[]> {
  const stations = await getStations()
  const result: Station[] = []
  for (const s of stations) {
    const chargers = await getStationChargers(s.id)
    result.push({
      ...s,
      total_chargers: chargers.length,
      available_chargers: chargers.filter((c) => c.status === "available").length,
      connector_types: [...new Set(chargers.map((c) => c.connector_type))],
      power_output: chargers[0]?.power_output ?? s.power_output ?? "",
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
  await updateDoc(ref, payload)
}

export async function updateStation(station: Station): Promise<void> {
  return updateStationById(station.id, station)
}

export async function deleteStation(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), COLLECTIONS.STATIONS, id))
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

export async function createCharger(
  charger: Omit<Charger, "id">
): Promise<Charger> {
  const payload: DocumentData = {
    station_id: charger.station_id,
    charger_number: charger.charger_number,
    status: charger.status,
    connector_type: charger.connector_type,
    power_output: charger.power_output,
  }
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
  return snap.docs.map((d) => serializeBooking(d.data(), d.id))
}

export async function getUserBookings(userId: string): Promise<Booking[]> {
  const q = query(
    collection(getDb(), COLLECTIONS.BOOKINGS),
    where("user_id", "==", userId),
    orderBy("created_at", "desc")
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => serializeBooking(d.data(), d.id))
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

  const ref = await addDoc(collection(getDb(), COLLECTIONS.BOOKINGS), payload)
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
  const ref = await addDoc(collection(getDb(), COLLECTIONS.PAYMENTS), payload)
  const snap = await getDoc(ref)
  return serializePayment(snap.data() ?? {}, snap.id)
}

export { COLLECTIONS }
