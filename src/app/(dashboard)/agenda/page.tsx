import { getActiveReminders, createReminder } from "@/actions/reminders"
import { getOrders } from "@/actions/orders"
import { ReminderList } from "@/components/ReminderList"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ErrorMessage } from "@/components/ErrorMessage"
import { revalidatePath } from "next/cache"
import { toUserMessage } from "@/lib/errors"
import { formatDate, isOverdue, cn } from "@/lib/utils"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Package } from "lucide-react"

export default async function AgendaPage() {
  let reminders: Awaited<ReturnType<typeof getActiveReminders>> = []
  let errorMsg: string | null = null
  let orderDeadlines: Awaited<ReturnType<typeof getOrders>> = []

  try {
    reminders = await getActiveReminders()
    // Get open orders with delivery dates (next 30 days + overdue)
    const allOrders = await getOrders()
    orderDeadlines = allOrders
      .filter(
        (o) =>
          o.data_consegna &&
          o.status !== "consegnato" &&
          o.status !== "annullato"
      )
      .sort((a, b) =>
        (a.data_consegna ?? "").localeCompare(b.data_consegna ?? "")
      )
  } catch (err) {
    errorMsg = toUserMessage(err)
  }

  async function addReminder(formData: FormData) {
    "use server"
    const title = formData.get("title") as string
    const due_at = formData.get("due_at") as string
    if (!title || !due_at) return
    // Set time to end of day so the reminder shows all day
    await createReminder({
      title,
      due_at: new Date(`${due_at}T23:59:00`).toISOString(),
    })
    revalidatePath("/agenda")
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Agenda</h1>

      {/* ORDER DEADLINES */}
      {orderDeadlines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4" />
              Scadenze ordini
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {orderDeadlines.map((o) => {
              const overdue = o.data_consegna ? isOverdue(o.data_consegna) : false
              const clientName = [o.nome, o.cognome].filter(Boolean).join(" ")
              return (
                <Link
                  key={o.id}
                  href={`/orders/${o.id}`}
                  className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-slate-50 rounded px-2 -mx-2 group"
                >
                  <div>
                    <p className="text-sm font-medium">{o.cosa_ordinato}</p>
                    <p className="text-xs text-slate-500">{clientName}</p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p
                      className={cn(
                        "text-xs font-medium",
                        overdue ? "text-red-600" : "text-slate-600"
                      )}
                    >
                      {overdue ? "⚠ " : ""}
                      {formatDate(o.data_consegna!)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {o.status.replace("_", " ")}
                    </p>
                  </div>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* ADD REMINDER */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nuovo promemoria</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={addReminder} className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="flex-1 min-w-40">
              <Input name="title" required placeholder="Cosa ricordare…" />
            </div>
            <Input
              name="due_at"
              type="date"
              required
              className="w-full sm:w-40"
            />
            <Button type="submit" className="w-full sm:w-auto">Aggiungi</Button>
          </form>
        </CardContent>
      </Card>

      {errorMsg && <ErrorMessage message={errorMsg} />}

      {/* REMINDERS */}
      {reminders.length > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-3">Promemoria</h2>
          <ReminderList reminders={reminders} />
        </div>
      )}
      {reminders.length === 0 && !errorMsg && (
        <p className="text-slate-500 text-sm">Nessun promemoria attivo.</p>
      )}
    </div>
  )
}
