"use client"

import { useState, useTransition } from "react"
import { updateOrderStatus } from "@/actions/orders"
import { STATUS_ORDER, STATUS_LABELS, preventivoStage, bozzaStage, materialeStage } from "@/lib/orderConstants"
import { formatDate, cn, buildClientDisplayName } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { StageBadge } from "@/components/OrderCard"
import { DeadlineDot, DEADLINE_CARD_CLASSES } from "@/components/DeadlineDot"
import { deadlineLevel } from "@/lib/deadline"
import type { OrderRow } from "@/actions/orders"

const STATUS_BADGE_COLORS: Record<string, string> = {
  preventivo: "bg-linen text-bark",
  bozza_grafica: "bg-linen text-bark",
  da_fare: "bg-honey text-bark",
  in_lavorazione: "bg-honey text-bark",
  pronto: "bg-honey text-bark",
  consegnato: "bg-linen text-muted-foreground",
}

export function KanbanBoard({ orders: initialOrders }: { orders: OrderRow[] }) {
  const [orders, setOrders] = useState(initialOrders)
  const [isPending, startTransition] = useTransition()

  function handleStatusChange(orderId: string, newStatus: string) {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    )
    startTransition(async () => {
      await updateOrderStatus(orderId, newStatus)
    })
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid grid-cols-[repeat(5,minmax(170px,1fr))] gap-3">
      {STATUS_ORDER.filter((s) => s !== "consegnato").map((status) => {
        const colOrders = orders.filter((o) => o.status === status)
        return (
          <div
            key={status}
            className="bg-background border border-border rounded-lg p-3 min-w-0"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-sm text-foreground">{STATUS_LABELS[status]}</span>
              <span className={cn("text-xs font-semibold px-2 py-0.5 rounded", STATUS_BADGE_COLORS[status])}>
                {colOrders.length}
              </span>
            </div>

            {colOrders.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8 border border-dashed border-border rounded-lg bg-card">
                Vuoto
              </div>
            ) : (
              <div className="space-y-3">
                {colOrders.map((order) => {
                  const clientName = buildClientDisplayName(order.nome, order.cognome, order.azienda)
                  const level = deadlineLevel(order.data_consegna, order.status)
                  return (
                    <div
                      key={order.id}
                      className={cn(
                        "bg-card border border-border rounded-lg p-3 shadow-[0px_2px_4px_0px_rgba(59,39,22,0.05)] hover:shadow-[0px_4px_10px_0px_rgba(59,39,22,0.1)] transition-shadow space-y-2",
                        level && DEADLINE_CARD_CLASSES[level]
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-x-1 gap-y-1.5">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-foreground">{clientName}</p>
                          {order.referente && (
                            <p className="text-xs text-muted-foreground">Ref. {order.referente}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          {materialeStage(order.materiale) === "red" && <StageBadge label="da ordinare" tone="red" />}
                          {materialeStage(order.materiale) === "yellow" && <StageBadge label="ordinato" tone="yellow" />}
                          {order.status === "preventivo" && preventivoStage((order as any).preventivo) === "red" && <StageBadge label="da inviare" tone="red" />}
                          {order.status === "preventivo" && preventivoStage((order as any).preventivo) === "yellow" && <StageBadge label="in attesa" tone="yellow" />}
                          {order.status === "bozza_grafica" && bozzaStage(order.bozza_grafica) === "red" && <StageBadge label="da fare" tone="red" />}
                          {order.status === "bozza_grafica" && bozzaStage(order.bozza_grafica) === "yellow" && <StageBadge label="in attesa" tone="yellow" />}
                          <DeadlineDot level={level} className="ml-1" />
                        </div>
                      </div>
                      <p className="text-sm text-bark leading-tight">
                        {order.cosa_ordinato}
                      </p>
                      {order.data_consegna && (
                        <p className={cn("text-xs font-medium text-muted-foreground", level === "ritardo" && "text-terracotta font-semibold")}>
                          {formatDate(order.data_consegna)}
                        </p>
                      )}

                      <Select
                        items={STATUS_LABELS}
                        value={order.status}
                        disabled={isPending}
                        onValueChange={(status) => status && handleStatusChange(order.id, status)}
                      >
                        <SelectTrigger className="w-full transition-opacity disabled:opacity-50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_ORDER.map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_LABELS[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Link
                        href={`/orders/${order.id}`}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "w-full text-center text-xs"
                        )}
                      >
                        Scheda
                      </Link>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
      </div>
    </div>
  )
}
