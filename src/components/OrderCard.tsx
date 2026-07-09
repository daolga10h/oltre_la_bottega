import Link from "next/link"
import { Package } from "lucide-react"
import { cn, formatDate, formatEUR, isOverdue } from "@/lib/utils"
import type { OrderRow } from "@/actions/orders"

const STATUS_COLORS: Record<string, string> = {
  preventivo: "bg-linen text-bark",
  bozza_grafica: "bg-sage text-[#3a5a2e]",
  da_fare: "bg-honey text-bark",
  in_lavorazione: "bg-honey text-bark",
  pronto: "bg-honey text-bark",
  consegnato: "bg-linen text-muted-foreground",
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
    <span className={cn(
      "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold",
      STATUS_COLORS[status] ?? "bg-linen text-bark"
    )}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

const BADGE_STAGE_CLASSES: Record<"red" | "yellow", string> = {
  red: "bg-terracotta/15 text-terracotta",
  yellow: "bg-honey text-bark",
}

export function StageBadge({ label, tone }: { label: string; tone: "red" | "yellow" }) {
  return (
    <span className={cn(
      "inline-flex items-center text-xs px-1.5 py-0.5 rounded whitespace-nowrap",
      BADGE_STAGE_CLASSES[tone]
    )}>
      {label}
    </span>
  )
}

export function OrderCard({ order }: { order: OrderRow }) {
  const overdue = order.data_consegna ? isOverdue(order.data_consegna) : false
  const clientName = [order.nome, order.cognome].filter(Boolean).join(" ")

  return (
    <Link href={`/orders/${order.id}`}>
      <div className={cn(
        "bg-card rounded-lg border border-border px-4 py-3 hover:shadow-[0px_4px_8px_0px_rgba(59,39,22,0.08)] transition-shadow space-y-1.5",
        overdue && order.status !== "consegnato" && "border-terracotta/40 bg-[#fdf0ef]"
      )}>
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-sm text-foreground">{clientName}</p>
          <div className="flex items-center gap-1 shrink-0">
            {(order.materiale === "da_ordinare" || order.materiale === "ordinato") && (
              <span className="inline-flex items-center gap-1 text-xs bg-honey text-bark px-1.5 py-0.5 rounded whitespace-nowrap">
                <Package className="w-3 h-3" />materiale
              </span>
            )}
            <StatusBadge status={order.status} />
          </div>
        </div>
        <p className="text-sm text-bark leading-tight">{order.cosa_ordinato}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground pt-0.5">
          {order.data_consegna && (
            <span className={overdue && order.status !== "consegnato" ? "text-terracotta font-semibold" : ""}>
              {formatDate(order.data_consegna)}
            </span>
          )}
          {order.prezzo > 0 && <span>€{formatEUR(order.prezzo)}</span>}
        </div>
      </div>
    </Link>
  )
}
