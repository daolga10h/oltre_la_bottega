"use client"

import { useState, useTransition } from "react"
import { updateOrderStatus } from "@/actions/orders"
import { STATUS_ORDER, STATUS_LABELS } from "@/lib/orderConstants"
import { formatDate, cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import Link from "next/link"
import type { OrderRow } from "@/actions/orders"

const STATUS_BADGE_COLORS: Record<string, string> = {
  preventivo: "bg-blue-100 text-blue-700",
  bozza_grafica: "bg-purple-100 text-purple-700",
  da_fare: "bg-orange-100 text-orange-700",
  in_lavorazione: "bg-amber-100 text-amber-700",
  pronto: "bg-green-100 text-green-700",
  consegnato: "bg-slate-100 text-slate-500",
}

export function KanbanBoard({ orders: initialOrders }: { orders: OrderRow[] }) {
  const [orders, setOrders] = useState(initialOrders)
  const [isPending, startTransition] = useTransition()

  function handleStatusChange(orderId: string, newStatus: string) {
    // Optimistic update
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    )
    startTransition(async () => {
      await updateOrderStatus(orderId, newStatus)
    })
  }

  return (
    <div className="grid grid-cols-5 gap-3">
      {STATUS_ORDER.map((status) => {
        const colOrders = orders.filter((o) => o.status === status)
        return (
          <div
            key={status}
            className="bg-slate-100 rounded-xl p-3 min-w-0"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-sm">{STATUS_LABELS[status]}</span>
              <span
                className={cn(
                  "text-xs font-bold px-2 py-0.5 rounded-full",
                  STATUS_BADGE_COLORS[status]
                )}
              >
                {colOrders.length}
              </span>
            </div>

            {colOrders.length === 0 ? (
              <div className="text-center text-slate-400 text-sm py-8 border border-dashed border-slate-300 rounded-lg bg-white">
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
                      className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm space-y-2"
                    >
                      <p className="font-bold text-sm">{clientName}</p>
                      <p className="text-sm text-slate-500 leading-tight">
                        {order.cosa_ordinato}
                      </p>
                      {order.data_consegna && (
                        <p className="text-xs font-medium text-slate-500">
                          {formatDate(order.data_consegna)}
                        </p>
                      )}

                      <select
                        value={order.status}
                        disabled={isPending}
                        onChange={(e) =>
                          handleStatusChange(order.id, e.target.value)
                        }
                        className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 cursor-pointer disabled:opacity-50"
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
