"use client"

import { useState, useTransition } from "react"
import { completeReminder } from "@/actions/reminders"
import { Button } from "@/components/ui/button"
import { ErrorMessage } from "@/components/ErrorMessage"
import { toUserMessage } from "@/lib/errors"
import type { ReminderItem } from "@/actions/reminders"
import { Check, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { format, isPast } from "date-fns"
import { it } from "date-fns/locale"

export function ReminderList({ reminders }: { reminders: ReminderItem[] }) {
  const [items, setItems] = useState(reminders)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleComplete(id: string) {
    startTransition(async () => {
      try {
        await completeReminder(id)
        setItems((prev) => prev.filter((r) => r.id !== id))
      } catch (err) {
        setError(toUserMessage(err))
      }
    })
  }

  if (items.length === 0) {
    return (
      <p className="text-slate-500 text-sm">Nessun promemoria attivo.</p>
    )
  }

  return (
    <div className="space-y-2">
      {error && <ErrorMessage message={error} className="mb-3" />}
      {items.map((r) => {
        const overdue = isPast(new Date(r.due_at))
        return (
          <div
            key={r.id}
            className={cn(
              "flex items-center gap-3 bg-white rounded-lg border p-3",
              overdue && "border-red-200 bg-red-50"
            )}
          >
            <Clock
              className={cn(
                "w-4 h-4 shrink-0",
                overdue ? "text-red-500" : "text-slate-400"
              )}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{r.title}</p>
              <p
                className={cn(
                  "text-xs",
                  overdue ? "text-red-500" : "text-slate-500"
                )}
              >
                {format(new Date(r.due_at), "d MMM, HH:mm", { locale: it })}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleComplete(r.id)}
              disabled={isPending}
              aria-label="Segna come fatto"
            >
              <Check className="w-4 h-4" />
            </Button>
          </div>
        )
      })}
    </div>
  )
}
