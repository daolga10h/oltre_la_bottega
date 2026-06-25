import { getActiveReminders, createReminder } from "@/actions/reminders"
import { ReminderList } from "@/components/ReminderList"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ErrorMessage } from "@/components/ErrorMessage"
import { revalidatePath } from "next/cache"
import { toUserMessage } from "@/lib/errors"

export default async function AgendaPage() {
  let reminders: Awaited<ReturnType<typeof getActiveReminders>> = []
  let errorMsg: string | null = null

  try {
    reminders = await getActiveReminders()
  } catch (err) {
    errorMsg = toUserMessage(err)
  }

  async function addReminder(formData: FormData) {
    "use server"
    const title = formData.get("title") as string
    const due_at = formData.get("due_at") as string
    if (!title || !due_at) return
    await createReminder({
      title,
      due_at: new Date(due_at).toISOString(),
    })
    revalidatePath("/agenda")
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Agenda</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nuovo promemoria</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={addReminder} className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-40">
              <Input name="title" required placeholder="Cosa ricordare…" />
            </div>
            <Input
              name="due_at"
              type="datetime-local"
              required
              className="w-52"
            />
            <Button type="submit">Aggiungi</Button>
          </form>
        </CardContent>
      </Card>

      {errorMsg && <ErrorMessage message={errorMsg} />}
      <ReminderList reminders={reminders} />
    </div>
  )
}
