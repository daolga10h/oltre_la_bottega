import Link from "next/link"
import { cn, formatDate, isOverdue } from "@/lib/utils"
import type { OrderRow } from "@/actions/orders"

const STATUS_COLORS: Record<string, string> = {
  preventivo: "bg-blue-100 text-blue-700",
  bozza_grafica: "bg-purple-100 text-purple-700",
  da_fare: "bg-orange-100 text-orange-700",
  in_lavorazione: "bg-amber-100 text-amber-700",
  pronto: "bg-green-100 text-green-700",
  consegnato: "bg-slate-100 text-slate-500",
}

const STATUS_LABELS: Record<string, string> = {
  preventivo: "Preventivo",
  bozza_grafica: "Bozza grafica",
  da_fare: "Da fare",
  in_lavorazione: "In lavorazione",
  pronto: "Pronto",
  consegnato: "Consegnato",
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_COLORS[status] ?? "bg-slate-100 text-slate-600")}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

export function OrderCard({ order }: { order: OrderRow }) {
  const overdue = order.data_consegna ? isOverdue(order.data_consegna) : false
  const clientName = [order.nome, order.cognome].filter(Boolean).join(" ")

  return (
    <Link href={`/orders/${order.id}`}>
      <div className={cn(
        "bg-white rounded-lg border p-4 hover:shadow-sm transition-shadow space-y-1.5",
        overdue && order.status !== "consegnato" && "border-red-200 bg-red-50"
      )}>
        <div className="flex items-start justify-between gap-2">
          <p className="font-bold text-sm">{clientName}</p>
          <StatusBadge status={order.status} />
        </div>
        <p className="text-sm text-slate-600 leading-tight">{order.cosa_ordinato}</p>
        <div className="flex items-center gap-3 text-xs text-slate-500 pt-0.5">
          {order.data_consegna && (
            <span className={overdue && order.status !== "consegnato" ? "text-red-600 font-medium" : ""}>
              {formatDate(order.data_consegna)}
            </span>
          )}
          {order.prezzo > 0 && <span>€{order.prezzo}</span>}
        </div>
      </div>
    </Link>
  )
}
