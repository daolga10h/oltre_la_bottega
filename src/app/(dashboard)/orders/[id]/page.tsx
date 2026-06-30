import { notFound } from "next/navigation"
import { getOrder, updateOrderStatus, updateBozzaGrafica, updatePreventivo } from "@/actions/orders"
import { STATUS_LABELS, STATUS_ORDER } from "@/lib/orderConstants"
import { StatusBadge } from "@/components/OrderCard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, Edit, Printer } from "lucide-react"
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

  async function changeBozza(formData: FormData) {
    "use server"
    const value = formData.get("bozza") as string
    await updateBozzaGrafica(id, value)
    revalidatePath(`/orders/${id}`)
  }

  async function changePreventivo(formData: FormData) {
    "use server"
    const value = formData.get("preventivo") as string
    await updatePreventivo(id, value)
    revalidatePath(`/orders/${id}`)
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
        <Link href="/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-3 h-3" />Ordini
        </Link>
        <div className="flex gap-2">
          <Link href={`/orders/${id}/print`} target="_blank" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex items-center gap-1")}>
            <Printer className="w-3 h-3" />Etichetta
          </Link>
          <Link href={`/orders/${id}/edit`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex items-center gap-1")}>
            <Edit className="w-3 h-3" />Modifica
          </Link>
        </div>
      </div>

      {/* Status stepper */}
      <div className="flex items-center gap-1 flex-wrap">
        {STATUS_ORDER.map((s, i) => (
          <form key={s} action={changeStatus}>
            <input type="hidden" name="status" value={s} />
            <button
              type="submit"
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                i === currentIdx
                  ? "bg-espresso text-cream border-espresso"
                  : i < currentIdx
                  ? "bg-muted text-muted-foreground border-border"
                  : "bg-card text-foreground border-border hover:border-foreground/30"
              )}
            >
              {STATUS_LABELS[s]}
            </button>
          </form>
        ))}
      </div>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">{order.cosa_ordinato}</h1>
        <p className="text-bark font-medium">{clientName}</p>
        {order.telefono && <p className="text-sm text-muted-foreground">{order.telefono}</p>}
      </div>

      {/* Key info */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        {order.tipo_lavorazione && (
          <div><span className="text-muted-foreground block text-xs">Lavorazione</span>{order.tipo_lavorazione}</div>
        )}
        {order.quantita > 1 && (
          <div><span className="text-muted-foreground block text-xs">Quantità</span>{order.quantita} pz</div>
        )}
        {order.canale && (
          <div><span className="text-muted-foreground block text-xs">Canale</span>{order.canale}</div>
        )}
        {order.data_consegna && (
          <div><span className="text-muted-foreground block text-xs">Consegna prevista</span>{formatDate(order.data_consegna)}</div>
        )}
        {order.data_consegnato && (
          <div><span className="text-muted-foreground block text-xs">Consegnato il</span>{formatDate(order.data_consegnato)}</div>
        )}
        {order.status === "preventivo" && (
          <div className="sm:col-span-3">
            <span className="text-muted-foreground block text-xs mb-1">Preventivo</span>
            <div className="flex gap-2 flex-wrap">
              {([["da_inviare", "Da inviare"], ["inviato", "Inviato"], ["approvato", "Approvato"]] as const).map(([v, label]) => (
                <form key={v} action={changePreventivo}>
                  <input type="hidden" name="preventivo" value={v} />
                  <button type="submit" className={cn(
                    "px-3 py-1 rounded-full text-xs font-semibold border transition-colors",
                    (order as any).preventivo === v
                      ? "bg-espresso text-cream border-espresso"
                      : "bg-card text-foreground border-border hover:border-foreground/30"
                  )}>{label}</button>
                </form>
              ))}
            </div>
          </div>
        )}
        {order.status === "bozza_grafica" && order.bozza_grafica !== "non_serve" && (
          <div className="sm:col-span-3">
            <span className="text-muted-foreground block text-xs mb-1">Bozza grafica</span>
            <div className="flex gap-2 flex-wrap">
              {([["da_fare", "Da fare"], ["inviata", "Inviata"], ["modificata", "Modificata"], ["approvata", "Approvata"]] as const).map(([v, label]) => (
                <form key={v} action={changeBozza}>
                  <input type="hidden" name="bozza" value={v} />
                  <button type="submit" className={cn(
                    "px-3 py-1 rounded-full text-xs font-semibold border transition-colors",
                    order.bozza_grafica === v
                      ? "bg-wisteria text-[#3d2a6e] border-wisteria"
                      : "bg-card text-foreground border-border hover:border-foreground/30"
                  )}>{label}</button>
                </form>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Text to engrave */}
      {order.testo_da_scrivere && (
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Testo da scrivere</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <p className="font-medium">{order.testo_da_scrivere}</p>
          </CardContent>
        </Card>
      )}

      {/* Files */}
      {(order.file_cliente || order.foto_oggetto) && (
        <Card>
          <CardContent className="pt-4 space-y-1 text-sm">
            {order.file_cliente && <p><span className="text-muted-foreground">File cliente: </span>{order.file_cliente}</p>}
            {order.foto_oggetto && <p><span className="text-muted-foreground">Foto oggetto: </span>{order.foto_oggetto}</p>}
          </CardContent>
        </Card>
      )}

      {/* Payment */}
      <Card>
        <CardContent className="pt-4 grid grid-cols-3 gap-4 text-center">
          <div><p className="text-xs text-muted-foreground">Prezzo</p><p className="font-bold text-lg">€{order.prezzo}</p></div>
          <div><p className="text-xs text-muted-foreground">Acconto</p><p className="font-bold text-lg text-green-600">€{order.acconto}</p></div>
          <div><p className="text-xs text-muted-foreground">Saldo</p><p className="font-bold text-lg text-gold">€{order.saldo}</p></div>
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
          <span key={label} className="bg-honey border border-gold/30 text-bark px-2 py-1 rounded">{label}</span>
        ) : null)}
      </div>

      {/* Notes */}
      {order.note && (
        <Card>
          <CardContent className="pt-4 text-sm text-bark">{order.note}</CardContent>
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
                  <span className="text-muted-foreground shrink-0 text-xs">{formatDate(ev.created_at)}</span>
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
