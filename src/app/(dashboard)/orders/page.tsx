import { getOrders } from "@/actions/orders"
import { OrderCard } from "@/components/OrderCard"
import { ErrorMessage } from "@/components/ErrorMessage"
import { buttonVariants } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "lucide-react"
import { toUserMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"

interface OrdersPageProps {
  searchParams: Promise<{ status?: string; priority?: string; q?: string }>
}

const STATUS_FILTERS = [
  { value: "tutti", label: "Tutti" },
  { value: "nuovo", label: "Nuovo" },
  { value: "in_lavorazione", label: "In lavorazione" },
  { value: "pronto", label: "Pronto" },
  { value: "consegnato", label: "Consegnato" },
]

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = await searchParams
  let orders: Awaited<ReturnType<typeof getOrders>> = []
  let errorMsg: string | null = null

  try {
    orders = await getOrders({
      status: params.status,
      priority: params.priority,
      search: params.q,
    })
  } catch (err) {
    errorMsg = toUserMessage(err)
  }

  const activeStatus = params.status ?? "tutti"

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ordini</h1>
        <Link
          href="/orders/new"
          className={cn(buttonVariants({ variant: "default" }), "flex items-center gap-2")}
        >
          <Plus className="w-4 h-4" />
          Nuovo ordine
        </Link>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(({ value, label }) => (
          <Link
            key={value}
            href={value === "tutti" ? "/orders" : `/orders?status=${value}`}
            className={cn(
              buttonVariants({ variant: activeStatus === value ? "default" : "outline", size: "sm" })
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      {errorMsg && <ErrorMessage message={errorMsg} />}

      {orders.length === 0 && !errorMsg ? (
        <p className="text-slate-500 text-sm">Nessun ordine trovato.</p>
      ) : (
        <div className="grid gap-3">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </div>
      )}
    </div>
  )
}
