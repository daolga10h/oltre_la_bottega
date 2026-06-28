import { notFound } from "next/navigation"
import { getOrder, updateOrderStatus } from "@/actions/orders"
import { STATUS_LABELS, STATUS_ORDER } from "@/lib/orderConstants"
import { StatusBadge } from "@/components/OrderCard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, Edit } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { revalidatePath } from "next/cache"

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const order = await getOrder(id)
  if (!order) notFound()

  async function changeStatus(formData: FormData) {
    "use server"
    const status = formData.get("status") as string
    await updateOrderStatus(id, status)
    revalidatePath(`/orders/${id}`)
    revalidatePath("/orders")
    revalidatePath("/dashboard")
  }

  const currentIdx = STATUS_ORDER.indexOf(order.status)
  const clientName = [order.nome, order.cognome].filter(Boolean).join(" ")

  const EVENT_LABELS: Record<string, string> = {
    created: "Ordine creato",
    status_change: "Stato aggiornato",
    updated: "Dati modificati",
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/orders" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="w-3 h-3" />Ordini
        </Link>
        <Link href={`/orders/${id}/edit`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex items-center gap-1")}>
          <Edit className="w-3 h-3" />Modifica
        </Link>
      </div>

      {/* Status stepper */}
      <div className="flex items-center gap-1 flex-wrap">
        {STATUS_ORDER.map((s, i) => (
          <form key={s} action={changeStatus}>
            <input type="hidden" name="status" value={s} />
            <button
              type="submit"
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                i === currentIdx
                  ? "bg-slate-900 text-white border-slate-900"
                  : i < currentIdx
                  ? "bg-slate-100 text-slate-400 border-slate-200"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
              )}
            >
              {STATUS_LABELS[s]}
            </button>
          </form>
        ))}
      </div>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">{order.cosa_ordinato}</h1>
        <p className="text-slate-600 font-medium">{clientName}</p>
        {order.telefono && <p className="text-sm text-slate-400">{order.telefono}</p>}
      </div>

      {/* Key info */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        {order.tipo_lavorazione && (
          <div><span className="text-slate-400 block text-xs">Lavorazione</span>{order.tipo_lavorazione}</div>
        )}
        {order.quantita > 1 && (
          <div><span className="text-slate-400 block text-xs">Quantità</span>{order.quantita} pz</div>
        )}
        {order.canale && (
          <div><span className="text-slate-400 block text-xs">Canale</span>{order.canale}</div>
        )}
        {order.data_consegna && (
          <div><span className="text-slate-400 block text-xs">Consegna prevista</span>{formatDate(order.data_consegna)}</div>
        )}
        {order.data_consegnato && (
          <div><span className="text-slate-400 block text-xs">Consegnato il</span>{formatDate(order.data_consegnato)}</div>
        )}
        {order.bozza_grafica !== "non_serve" && (
          <div><span className="text-slate-400 block text-xs">Bozza grafica</span>{order.bozza_grafica.replace("_", " ")}</div>
        )}
      </div>

      {/* Text to engrave */}
      {order.testo_da_scrivere && (
        <Card>
          <CardHeader><CardTitle className="text-sm text-slate-500">Testo da scrivere</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <p className="font-medium">{order.testo_da_scrivere}</p>
          </CardContent>
        </Card>
      )}

      {/* Files */}
      {(order.file_cliente || order.foto_oggetto) && (
        <Card>
          <CardContent className="pt-4 space-y-1 text-sm">
            {order.file_cliente && <p><span className="text-slate-400">File cliente: </span>{order.file_cliente}</p>}
            {order.foto_oggetto && <p><span className="text-slate-400">Foto oggetto: </span>{order.foto_oggetto}</p>}
          </CardContent>
        </Card>
      )}

      {/* Payment */}
      <Card>
        <CardContent className="pt-4 grid grid-cols-3 gap-4 text-center">
          <div><p className="text-xs text-slate-400">Prezzo</p><p className="font-bold text-lg">€{order.prezzo}</p></div>
          <div><p className="text-xs text-slate-400">Acconto</p><p className="font-bold text-lg text-green-600">€{order.acconto}</p></div>
          <div><p className="text-xs text-slate-400">Saldo</p><p className="font-bold text-lg text-amber-600">€{order.saldo}</p></div>
        </CardContent>
      </Card>

      {/* Flags */}
      <div className="flex flex-wrap gap-2 text-xs">
        {[
          { label: "Msg PRONTO", active: order.msg_pronto_inviato },
          { label: "Recensione da chiedere", active: order.chiedere_recensione },
          { label: "Recensione richiesta", active: order.recensione_richiesta },
          { label: "Recensione ricevuta", active: order.recensione_ricevuta },
        ].map(({ label, active }) => active ? (
          <span key={label} className="bg-green-50 border border-green-200 text-green-700 px-2 py-1 rounded-full">{label}</span>
        ) : null)}
      </div>

      {/* Notes */}
      {order.note && (
        <Card>
          <CardContent className="pt-4 text-sm text-slate-600">{order.note}</CardContent>
        </Card>
      )}

      {/* Status badge for reference */}
      <div className="flex items-center gap-2">
        <StatusBadge status={order.status} />
      </div>

      {/* Timeline */}
      {order.events.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Attività</CardTitle></CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {order.events.map((ev) => (
                <li key={ev.id} className="flex gap-3 text-sm">
                  <span className="text-slate-400 shrink-0 text-xs">{formatDate(ev.created_at)}</span>
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
