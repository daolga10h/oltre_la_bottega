import { cn } from "@/lib/utils"

type OrderStatus = "nuovo" | "in_lavorazione" | "pronto" | "consegnato" | "annullato"
type OrderPriority = "normale" | "alta" | "urgente"

const STATUS_LABELS: Record<OrderStatus, string> = {
  nuovo: "Nuovo",
  in_lavorazione: "In lavorazione",
  pronto: "Pronto",
  consegnato: "Consegnato",
  annullato: "Annullato",
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  nuovo: "bg-slate-100 text-slate-700",
  in_lavorazione: "bg-blue-100 text-blue-700",
  pronto: "bg-green-100 text-green-700",
  consegnato: "bg-gray-100 text-gray-500",
  annullato: "bg-red-100 text-red-500",
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_COLORS[status]
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: OrderPriority }) {
  if (priority === "normale") return null
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        priority === "urgente"
          ? "bg-red-100 text-red-700"
          : "bg-amber-100 text-amber-700"
      )}
    >
      {priority === "urgente" ? "Urgente" : "Alta"}
    </span>
  )
}
