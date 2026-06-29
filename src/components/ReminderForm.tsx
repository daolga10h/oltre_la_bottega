"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { addReminderAction } from "@/actions/reminders"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ErrorMessage } from "@/components/ErrorMessage"

export function ReminderForm() {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(addReminderAction, { error: null })

  useEffect(() => {
    if (state.ts && !state.error) {
      router.refresh()
    }
  }, [state.ts, state.error, router])

  return (
    <form key={state.ts ?? 0} action={formAction} className="flex flex-col sm:flex-row gap-3 flex-wrap">
      {state.error && <ErrorMessage message={state.error} className="w-full" />}
      <div className="flex-1 min-w-40">
        <Input
          name="title"
          required
          placeholder="Cosa ricordare…"
          autoComplete="off"
        />
      </div>
      <Input
        name="due_at"
        type="date"
        required
        className="w-full sm:w-40"
      />
      <Button type="submit" className="w-full sm:w-auto" disabled={isPending}>
        {isPending ? "Aggiungo…" : "Aggiungi"}
      </Button>
    </form>
  )
}
