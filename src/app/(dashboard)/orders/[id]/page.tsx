import { notFound } from "next/navigation"
import { getOrder, updateOrderStatus, updatePaymentStatus } from "@/actions/orders"
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatDate } from "@/lib/utils"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { revalidatePath } from "next/cache"

const STATUS_OPTIONS = [
  { value: "nuovo", label: "Nuovo" },
  { value: "in_lavorazione", label: "In lavorazione" },
  { value: "pronto", label: "Pronto" },
  { value: "consegnato", label: "Consegnato" },
  { value: "annullato", label: "Annullato" },
] as const

const PAYMENT_OPTIONS = [
  { value: "non_pagato", label: "Non pagato" },
  { value: "acconto", label: "Acconto ricevuto" },
  { value: "saldato", label: "Saldato" },
] as const

const EVENT_LABELS: Record<string, string> = {
  created: "Ordine creato",
  status_change: "Stato aggiornato",
  payment_update: "Pagamento aggiornato",
  updated: "Dati modificati",
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const order = await getOrder(id)
  if (!order) notFound()

  async function changeStatus(formData: FormData) {
    "use server"
    const status = formData.get("status") as
      | "nuovo"
      | "in_lavorazione"
      | "pronto"
      | "consegnato"
      | "annullato"
    await updateOrderStatus(id, status)
    revalidatePath(`/orders/${id}`)
  }

  async function changePayment(formData: FormData) {
    "use server"
    const ps = formData.get("payment_status") as
      | "non_pagato"
      | "acconto"
      | "saldato"
    await updatePaymentStatus(id, ps)
    revalidatePath(`/orders/${id}`)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/orders"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-3 h-3" />
          Ordini
        </Link>
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <StatusBadge status={order.status} />
          <PriorityBadge priority={order.priority} />
        </div>
        <h1 className="text-2xl font-bold">{order.title}</h1>
        {order.customers && (
          <p className="text-slate-500">{order.customers.name}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        {order.due_date && (
          <div>
            <span className="text-slate-500">Consegna: </span>
            {formatDate(order.due_date)}
          </div>
        )}
        {order.amount_estimated != null && (
          <div>
            <span className="text-slate-500">Prezzo: </span>€
            {order.amount_estimated}
          </div>
        )}
      </div>

      {order.description && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm">{order.description}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stato ordine</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={changeStatus} className="flex gap-3">
            <Select name="status" defaultValue={order.status}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit">Salva</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pagamento</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={changePayment} className="flex gap-3">
            <Select name="payment_status" defaultValue={order.payment_status}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit">Salva</Button>
          </form>
        </CardContent>
      </Card>

      {order.events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attività</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {order.events.map((ev) => (
                <li key={ev.id} className="flex gap-3 text-sm">
                  <span className="text-slate-400 shrink-0 w-24">
                    {formatDate(ev.created_at)}
                  </span>
                  <span>{ev.note ?? EVENT_LABELS[ev.event_type] ?? ev.event_type}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
