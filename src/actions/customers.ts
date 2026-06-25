"use server"

import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logger"
import { AppError, USER_MESSAGES } from "@/lib/errors"

export type CustomerSummary = {
  id: string
  name: string
  phone: string | null
  email: string | null
  tags: string[]
  created_at: string
}

export type CustomerDetail = CustomerSummary & {
  notes: string | null
  orders: Array<{
    id: string
    title: string
    status: string
    due_date: string | null
    created_at: string
  }>
}

export async function getCustomers(search?: string): Promise<CustomerSummary[]> {
  try {
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from("customers")
      .select("id, name, phone, email, tags, created_at")
      .order("name")

    if (search) query = query.ilike("name", `%${search}%`)

    const { data, error } = await query
    if (error) throw new AppError(error.message, USER_MESSAGES.generic)
    return (data ?? []) as CustomerSummary[]
  } catch (err) {
    logError("getCustomers", err)
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.generic)
  }
}

export async function getCustomer(id: string): Promise<CustomerDetail | null> {
  try {
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("customers")
      .select(
        "id, name, phone, email, tags, notes, created_at, orders(id, title, status, due_date, created_at)"
      )
      .eq("id", id)
      .order("created_at", { referencedTable: "orders", ascending: false })
      .single()

    if (error) {
      if (error.code === "PGRST116") return null
      throw new AppError(error.message, USER_MESSAGES.notFound)
    }
    return data as unknown as CustomerDetail
  } catch (err) {
    logError("getCustomer", err, { id })
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.generic)
  }
}

export async function createCustomer(input: {
  name: string
  phone?: string | null
  email?: string | null
  notes?: string | null
  tags?: string[]
}): Promise<{ id: string }> {
  try {
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("customers")
      .insert(input)
      .select("id")
      .single()

    if (error) throw new AppError(error.message, USER_MESSAGES.saveFailed)
    return { id: (data as { id: string }).id }
  } catch (err) {
    logError("createCustomer", err, { input })
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.saveFailed)
  }
}
