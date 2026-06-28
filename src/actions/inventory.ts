"use server"

import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logger"
import { AppError, USER_MESSAGES } from "@/lib/errors"

export type InventoryItem = {
  id: string
  name: string
  unit: string
  quantity_available: number
  reorder_threshold: number
  updated_at: string
}

export async function getInventory(): Promise<InventoryItem[]> {
  try {
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("inventory_items")
      .select("*")
      .order("name")
    if (error) throw new AppError(error.message, USER_MESSAGES.generic)
    return (data ?? []) as InventoryItem[]
  } catch (err) {
    logError("getInventory", err)
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.generic)
  }
}

export async function upsertInventoryItem(input: {
  id?: string
  name: string
  unit: string
  quantity_available: number
  reorder_threshold: number
}): Promise<void> {
  try {
    const supabase = await createClient()
    const { id, ...rest } = input
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = id
      ? await (supabase as any).from("inventory_items").update(rest).eq("id", id)
      : await (supabase as any).from("inventory_items").insert(rest)
    if (error) throw new AppError(error.message, USER_MESSAGES.saveFailed)
  } catch (err) {
    logError("upsertInventoryItem", err, { input })
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.saveFailed)
  }
}
