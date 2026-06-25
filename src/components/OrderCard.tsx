import Link from "next/link"
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge"
import { dueDateLabel, isOverdue, cn } from "@/lib/utils"
import type { OrderWithCustomer } from "@/actions/orders"

export function OrderCard({ order }: { order: OrderWithCustomer }) {
  const overdue = order.due_date ? isOverdue(order.due_date) : false
  return (
    <Link href={`/orders/${order.id}`}>
      <div
        className={cn(
          "bg-white rounded-lg border p-4 hover:shadow-sm transition-shadow space-y-2",
          overdue && "border-red-200 bg-red-50"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-sm leading-tight">{order.title}</p>
          <PriorityBadge priority={order.priority} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={order.status} />
          {order.customers && (
            <span className="text-xs text-slate-500">{order.customers.name}</span>
          )}
        </div>
        {order.due_date && (
          <p
            className={cn(
              "text-xs",
              overdue ? "text-red-600 font-medium" : "text-slate-500"
            )}
          >
            Consegna: {dueDateLabel(order.due_date)}
          </p>
        )}
      </div>
    </Link>
  )
}
