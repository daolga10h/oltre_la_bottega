"use client"

import { useState, useTransition } from "react"
import { updateOrderStatus } from "@/actions/orders"
import { STATUS_ORDER, STATUS_LABELS } from "@/lib/orderConstants"
import { formatDate, cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import Link from "next/link"
import type { OrderRow } from "@/actions/orders"

const STATUS_BADGE_COLORS: Record<string, string> = {
  preventivo: "bg-linen text-bark",
  bozza_grafica: "bg-wisteria text-[#3d2a6e]",
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
    <div className="grid grid-cols-5 gap-3">
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
                  const clientName = [order.nome, order.cognome]
                    .filter(Boolean)
                    .join(" ")
                  return (
                    <div
                      key={order.id}
                      className="bg-card border border-border rounded-lg p-3 shadow-[0px_2px_4px_0px_rgba(38,27,7,0.05)] space-y-2"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-semibold text-sm text-foreground">{clientName}</p>
                        {(order.status === "preventivo" && (order as any).preventivo === "inviato") && (
                          <span className="text-xs bg-honey text-bark px-1.5 py-0.5 rounded whitespace-nowrap">⏳ attesa</span>
                        )}
                        {(order.status === "bozza_grafica" && (order.bozza_grafica === "inviata" || order.bozza_grafica === "modificata")) && (
                          <span className="text-xs bg-honey text-bark px-1.5 py-0.5 rounded whitespace-nowrap">⏳ attesa</span>
                        )}
                      </div>
                      <p className="text-sm text-bark leading-tight">
                        {order.cosa_ordinato}
                      </p>
                      {order.data_consegna && (
                        <p className="text-xs font-medium text-muted-foreground">
                          {formatDate(order.data_consegna)}
                        </p>
                      )}

                      <select
                        value={order.status}
                        disabled={isPending}
                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                        className="w-full text-sm border border-border rounded-lg px-2 py-1.5 bg-background text-foreground cursor-pointer disabled:opacity-50"
                      >
                        {STATUS_ORDER.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>

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
  )
}
