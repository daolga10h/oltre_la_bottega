"use server"

import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logger"
import { AppError, USER_MESSAGES } from "@/lib/errors"

export type ReminderItem = {
  id: string
  title: string
  due_at: string
  status: string
  order_id: string | null
}

export async function getActiveReminders(): Promise<ReminderItem[]> {
  try {
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("reminders")
      .select("id, title, due_at, status, order_id")
      .eq("status", "attivo")
      .order("due_at")

    if (error) throw new AppError(error.message, USER_MESSAGES.generic)
    return (data ?? []) as ReminderItem[]
  } catch (err) {
    logError("getActiveReminders", err)
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.generic)
  }
}

export async function createReminder(input: {
  title: string
  due_at: string
  order_id?: string | null
}): Promise<void> {
  try {
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("reminders").insert(input)
    if (error) throw new AppError(error.message, USER_MESSAGES.saveFailed)
  } catch (err) {
    logError("createReminder", err, { input })
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.saveFailed)
  }
}

export async function completeReminder(id: string): Promise<void> {
  try {
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("reminders")
      .update({ status: "completato" })
      .eq("id", id)
    if (error) throw new AppError(error.message, USER_MESSAGES.saveFailed)
  } catch (err) {
    logError("completeReminder", err, { id })
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.saveFailed)
  }
}
