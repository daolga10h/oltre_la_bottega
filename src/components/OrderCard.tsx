import Link from "next/link"
import { cn, formatDate, formatEUR, buildClientDisplayName } from "@/lib/utils"
import { preventivoStage, bozzaStage, materialeStage } from "@/lib/orderConstants"
import { deadlineLevel } from "@/lib/deadline"
import { DeadlineDot, DEADLINE_CARD_CLASSES } from "@/components/DeadlineDot"
import type { OrderRow } from "@/actions/orders"

const STATUS_COLORS: Record<string, string> = {
  preventivo: "bg-linen text-bark",
  bozza_grafica: "bg-linen text-bark",
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
  const level = deadlineLevel(order.data_consegna, order.status)
  const clientName = buildClientDisplayName(order.nome, order.cognome, order.azienda)

  return (
    <Link href={`/orders/${order.id}`}>
      <div className={cn(
        "bg-card rounded-lg border border-border px-4 py-3 hover:shadow-[0px_4px_8px_0px_rgba(59,39,22,0.08)] transition-shadow space-y-1.5",
        level && DEADLINE_CARD_CLASSES[level]
      )}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-sm text-foreground">{clientName}</p>
            {order.referente && (
              <p className="text-xs text-muted-foreground">Ref. {order.referente}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {materialeStage(order.materiale) === "red" && <StageBadge label="da ordinare" tone="red" />}
            {materialeStage(order.materiale) === "yellow" && <StageBadge label="ordinato" tone="yellow" />}
            {order.status === "preventivo" && preventivoStage(order.preventivo) === "red" && <StageBadge label="da inviare" tone="red" />}
            {order.status === "preventivo" && preventivoStage(order.preventivo) === "yellow" && <StageBadge label="in attesa" tone="yellow" />}
            {order.status === "bozza_grafica" && bozzaStage(order.bozza_grafica) === "red" && <StageBadge label="da fare" tone="red" />}
            {order.status === "bozza_grafica" && bozzaStage(order.bozza_grafica) === "yellow" && <StageBadge label="in attesa" tone="yellow" />}
            <StatusBadge status={order.status} />
            <DeadlineDot level={level} className="ml-1" />
          </div>
        </div>
        <p className="text-sm text-bark leading-tight">{order.cosa_ordinato}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground pt-0.5">
          {order.data_consegna && (
            <span className={level === "ritardo" ? "text-terracotta font-semibold" : ""}>
              {formatDate(order.data_consegna)}
            </span>
          )}
          {order.prezzo > 0 && <span>€{formatEUR(order.prezzo)}</span>}
        </div>
      </div>
    </Link>
  )
}
