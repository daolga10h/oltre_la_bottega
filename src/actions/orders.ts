"use server"

import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logger"
import { AppError, USER_MESSAGES } from "@/lib/errors"
import type { Database } from "@/types/supabase"

type OrderStatus = Database["public"]["Enums"]["order_status"]
type OrderPriority = Database["public"]["Enums"]["order_priority"]
type PaymentStatus = Database["public"]["Enums"]["payment_status"]

export type OrderWithCustomer = {
  id: string
  title: string
  status: OrderStatus
  priority: OrderPriority
  due_date: string | null
  payment_status: PaymentStatus
  created_at: string
  customers: { id: string; name: string } | null
}

export async function getOrders(filters?: {
  status?: string
  priority?: string
  search?: string
}): Promise<OrderWithCustomer[]> {
  try {
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("orders")
      .select("id, title, status, priority, due_date, payment_status, created_at, customers(id, name)")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })

    if (filters?.status && filters.status !== "tutti") {
      query = query.eq("status", filters.status)
    }
    if (filters?.priority && filters.priority !== "tutti") {
      query = query.eq("priority", filters.priority)
    }
    if (filters?.search) {
      query = query.ilike("title", `%${filters.search}%`)
    }

    const { data, error } = await query
    if (error) throw new AppError(String(error.message), USER_MESSAGES.generic, { query: "getOrders" })
    return (data ?? []) as OrderWithCustomer[]
  } catch (err) {
    logError("getOrders", err)
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.generic)
  }
}

export type CreateOrderInput = {
  title: string
  customer_id?: string | null
  description?: string | null
  status?: OrderStatus
  priority?: OrderPriority
  due_date?: string | null
  amount_estimated?: number | null
  payment_status?: PaymentStatus
}

export async function createOrder(input: CreateOrderInput): Promise<{ id: string }> {
  try {
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("orders")
      .insert({
        title: input.title,
        customer_id: input.customer_id ?? null,
        description: input.description ?? null,
        status: input.status,
        priority: input.priority,
        due_date: input.due_date ?? null,
        amount_estimated: input.amount_estimated ?? null,
        payment_status: input.payment_status,
      })
      .select("id")
      .single()

    if (error) throw new AppError(String(error.message), USER_MESSAGES.saveFailed, { action: "createOrder" })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("order_events").insert({
      order_id: (data as { id: string }).id,
      event_type: "created",
      note: "Ordine creato",
    })

    return { id: (data as { id: string }).id }
  } catch (err) {
    logError("createOrder", err, { input })
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.saveFailed)
  }
}

export type OrderDetail = OrderWithCustomer & {
  description: string | null
  amount_estimated: number | null
  updated_at: string
  events: Array<{ id: string; event_type: string; note: string | null; created_at: string }>
}

export async function getOrder(id: string): Promise<OrderDetail | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("orders")
      .select(`
        id, title, description, status, priority, due_date,
        amount_estimated, payment_status, created_at, updated_at,
        customers(id, name),
        order_events(id, event_type, note, created_at)
      `)
      .eq("id", id)
      .order("created_at", { referencedTable: "order_events", ascending: false })
      .single()

    if (error) {
      if (error.code === "PGRST116") return null
      throw new AppError(error.message, USER_MESSAGES.notFound)
    }
    return data as unknown as OrderDetail
  } catch (err) {
    logError("getOrder", err, { id })
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.generic)
  }
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  note?: string
): Promise<void> {
  try {
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("orders")
      .update({ status })
      .eq("id", orderId)
    if (error) throw new AppError(String(error.message), USER_MESSAGES.saveFailed)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("order_events").insert({
      order_id: orderId,
      event_type: "status_change",
      note: note ?? `Stato: ${status.replace("_", " ")}`,
    })
  } catch (err) {
    logError("updateOrderStatus", err, { orderId, status })
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.saveFailed)
  }
}

export async function updatePaymentStatus(
  orderId: string,
  paymentStatus: PaymentStatus
): Promise<void> {
  try {
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("orders")
      .update({ payment_status: paymentStatus })
      .eq("id", orderId)
    if (error) throw new AppError(String(error.message), USER_MESSAGES.saveFailed)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("order_events").insert({
      order_id: orderId,
      event_type: "payment_update",
      note: `Pagamento: ${paymentStatus.replace("_", " ")}`,
    })
  } catch (err) {
    logError("updatePaymentStatus", err, { orderId, paymentStatus })
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.saveFailed)
  }
}
