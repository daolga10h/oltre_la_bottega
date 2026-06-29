import { getActiveReminders } from "@/actions/reminders"
import { ReminderList } from "@/components/ReminderList"
import { ReminderForm } from "@/components/ReminderForm"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ErrorMessage } from "@/components/ErrorMessage"
import { toUserMessage } from "@/lib/errors"

export default async function AgendaPage() {
  let reminders: Awaited<ReturnType<typeof getActiveReminders>> = []
  let errorMsg: string | null = null

  try {
    reminders = await getActiveReminders()
  } catch (err) {
    errorMsg = toUserMessage(err)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Agenda</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nuovo promemoria</CardTitle>
        </CardHeader>
        <CardContent>
          <ReminderForm />
        </CardContent>
      </Card>

      {errorMsg && <ErrorMessage message={errorMsg} />}

      <ReminderList reminders={reminders} />
    </div>
  )
}
