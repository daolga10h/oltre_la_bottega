"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logger"
import { AppError, USER_MESSAGES, toUserMessage } from "@/lib/errors"

export type ReminderItem = {
  id: string
  title: string
  due_at: string
  status: string
  order_id: string | null
  completed_at: string | null
}

export async function getActiveReminders(): Promise<ReminderItem[]> {
  try {
    const supabase = await createClient()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("reminders")
      .select("id, title, due_at, status, order_id, completed_at")
      .or(`status.eq.attivo,and(status.eq.completato,completed_at.gte.${todayStart.toISOString()})`)
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

export type AddReminderState = { error: string | null; ts?: number }

export async function addReminderAction(
  _prev: AddReminderState,
  formData: FormData
): Promise<AddReminderState> {
  const title = (formData.get("title") as string | null)?.trim()
  const due_at = formData.get("due_at") as string | null
  if (!title || !due_at) return { error: "Compila titolo e data.", ts: _prev.ts }
  try {
    await createReminder({ title, due_at: new Date(`${due_at}T23:59:00`).toISOString() })
    revalidatePath("/agenda")
    return { error: null, ts: Date.now() }
  } catch (err) {
    return { error: toUserMessage(err), ts: _prev.ts }
  }
}

export async function completeReminder(id: string): Promise<void> {
  try {
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("reminders")
      .update({ status: "completato", completed_at: new Date().toISOString() })
      .eq("id", id)
    if (error) throw new AppError(error.message, USER_MESSAGES.saveFailed)
  } catch (err) {
    logError("completeReminder", err, { id })
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.saveFailed)
  }
}
