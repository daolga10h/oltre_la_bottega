"use server"

import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logger"
import { AppError, USER_MESSAGES } from "@/lib/errors"
import { STATUS_LABELS } from "@/lib/orderConstants"

// Re-exported for convenience — consumers can also import directly from @/lib/orderConstants
// NOTE: cannot export non-async values from "use server" files, so pages import from orderConstants directly

export type OrderRow = {
  id: string
  nome: string
  cognome: string | null
  telefono: string | null
  email_cliente: string | null
  canale: string
  data_ordine: string | null
  data_consegna: string | null
  data_consegnato: string | null
  cosa_ordinato: string
  testo_da_scrivere: string | null
  tipo_lavorazione: string | null
  quantita: number
  bozza_grafica: string
  foto_oggetto: string | null
  file_cliente: string | null
  note: string | null
  status: string
  prezzo: number
  acconto: number
  saldo: number
  consenso_marketing: boolean
  chiedere_recensione: boolean
  recensione_richiesta: boolean
  recensione_ricevuta: boolean
  msg_pronto_inviato: boolean
  created_at: string
  updated_at: string
}

export type OrderDetail = OrderRow & {
  events: Array<{ id: string; event_type: string; note: string | null; created_at: string }>
}

export type CreateOrderInput = Omit<OrderRow, "id" | "created_at" | "updated_at">

export async function getOrders(filters?: {
  status?: string
  search?: string
}): Promise<OrderRow[]> {
  try {
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("orders")
      .select("*")
      .order("data_consegna", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })

    if (filters?.status && filters.status !== "tutti") {
      query = query.eq("status", filters.status)
    }
    if (filters?.search) {
      query = query.or(
        `nome.ilike.%${filters.search}%,cognome.ilike.%${filters.search}%,cosa_ordinato.ilike.%${filters.search}%,telefono.ilike.%${filters.search}%`
      )
    }
    const { data, error } = await query
    if (error) throw new AppError(error.message, USER_MESSAGES.generic)
    return (data ?? []) as OrderRow[]
  } catch (err) {
    logError("getOrders", err)
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.generic)
  }
}

export async function getOrder(id: string): Promise<OrderDetail | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_events(id, event_type, note, created_at)")
      .eq("id", id)
      .order("created_at", { referencedTable: "order_events", ascending: false })
      .single()
    if (error) {
      if (error.code === "PGRST116") return null
      throw new AppError(error.message, USER_MESSAGES.notFound)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = data as any
    return { ...row, events: row.order_events ?? [] } as OrderDetail
  } catch (err) {
    logError("getOrder", err, { id })
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.generic)
  }
}

export async function createOrder(input: Partial<CreateOrderInput> & { nome: string; cosa_ordinato: string }): Promise<{ id: string }> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("orders")
    .insert(input)
    .select("id")
    .single()
  if (error) {
    logError("createOrder", error, { input })
    throw new AppError(`[DEBUG] ${error.code}: ${error.message}`, USER_MESSAGES.saveFailed)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("order_events").insert({
    order_id: data.id,
    event_type: "created",
    note: "Ordine creato",
  })
  return { id: data.id }
}

export async function updateOrder(id: string, input: Partial<CreateOrderInput>): Promise<void> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("orders").update(input).eq("id", id)
  if (error) {
    logError("updateOrder", error, { id })
    throw new Error(USER_MESSAGES.saveFailed)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("order_events").insert({
    order_id: id,
    event_type: "updated",
    note: "Ordine aggiornato",
  })
}

export async function updateOrderStatus(id: string, status: string): Promise<void> {
  const supabase = await createClient()
  const updates: Record<string, unknown> = { status }
  if (status === "consegnato") updates.data_consegnato = new Date().toISOString().split("T")[0]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("orders").update(updates).eq("id", id)
  if (error) {
    logError("updateOrderStatus", error, { id, status })
    throw new Error(USER_MESSAGES.saveFailed)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("order_events").insert({
    order_id: id,
    event_type: "status_change",
    note: `Stato: ${STATUS_LABELS[status] ?? status}`,
  })
}

export async function deleteOrder(id: string): Promise<void> {
  try {
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("orders").delete().eq("id", id)
    if (error) throw new AppError(error.message, USER_MESSAGES.saveFailed)
  } catch (err) {
    logError("deleteOrder", err, { id })
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.saveFailed)
  }
}

export async function markReviewRequested(id: string): Promise<void> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("orders")
    .update({ recensione_richiesta: true })
    .eq("id", id)
  if (error) {
    logError("markReviewRequested", error, { id })
    throw new Error(USER_MESSAGES.saveFailed)
  }
}

export async function markReviewReceived(id: string): Promise<void> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("orders")
    .update({ recensione_ricevuta: true })
    .eq("id", id)
  if (error) {
    logError("markReviewReceived", error, { id })
    throw new Error(USER_MESSAGES.saveFailed)
  }
}
