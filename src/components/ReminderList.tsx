"use client"

import { useState, useTransition, useEffect } from "react"
import { completeReminder } from "@/actions/reminders"
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

  useEffect(() => {
    setItems(reminders)
  }, [reminders])

  function handleComplete(id: string) {
    setItems((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "completato", completed_at: new Date().toISOString() } : r))
    )
    startTransition(async () => {
      try {
        await completeReminder(id)
      } catch (err) {
        setError(toUserMessage(err))
        setItems((prev) => prev.map((r) => (r.id === id ? { ...r, status: "attivo", completed_at: null } : r)))
      }
    })
  }

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">Nessun promemoria attivo.</p>
    )
  }

  return (
    <div className="space-y-2">
      {error && <ErrorMessage message={error} className="mb-3" />}
      {items.map((r) => {
        const done = r.status === "completato"
        const overdue = !done && isPast(new Date(r.due_at))
        return (
          <div
            key={r.id}
            className={cn(
              "flex items-center gap-3 bg-card rounded-lg border border-border p-3",
              overdue && "border-terracotta/30 bg-[#fdf0ef]",
              done && "opacity-60"
            )}
          >
            <button
              type="button"
              onClick={() => !done && handleComplete(r.id)}
              disabled={isPending || done}
              aria-label="Segna come fatto"
              className={cn(
                "w-5 h-5 shrink-0 rounded border flex items-center justify-center transition-colors",
                done ? "bg-sage border-[#3a5a2e]" : "border-border hover:border-gold"
              )}
            >
              {done && <Check className="w-3.5 h-3.5 text-[#3a5a2e]" />}
            </button>
            <Clock
              className={cn(
                "w-4 h-4 shrink-0",
                overdue ? "text-terracotta" : "text-muted-foreground"
              )}
            />
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm font-medium truncate", done && "line-through")}>{r.title}</p>
              <p
                className={cn(
                  "text-xs",
                  overdue ? "text-terracotta" : "text-muted-foreground"
                )}
              >
                {format(new Date(r.due_at), "d MMM, HH:mm", { locale: it })}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
