import { notFound } from "next/navigation"
import { getCustomer } from "@/actions/customers"
import { StatusBadge } from "@/components/StatusBadge"
import { Card, CardContent } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, Phone, Mail, Plus } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { cn } from "@/lib/utils"

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const customer = await getCustomer(id)
  if (!customer) notFound()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/customers"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-3 h-3" />
          Clienti
        </Link>
        <h1 className="text-2xl font-bold">{customer.name}</h1>
        <div className="flex gap-3 flex-wrap text-sm text-slate-500 mt-1">
          {customer.phone && (
            <span className="flex items-center gap-1">
              <Phone className="w-3 h-3" />
              {customer.phone}
            </span>
          )}
          {customer.email && (
            <span className="flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {customer.email}
            </span>
          )}
        </div>
        {customer.notes && (
          <p className="text-sm mt-2 text-slate-600">{customer.notes}</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">
          Ordini ({customer.orders.length})
        </h2>
        <Link
          href={`/orders/new?customer_id=${customer.id}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex items-center gap-1")}
        >
          <Plus className="w-3 h-3" />
          Nuovo ordine
        </Link>
      </div>

      {customer.orders.length === 0 ? (
        <p className="text-slate-500 text-sm">Nessun ordine per questo cliente.</p>
      ) : (
        <div className="space-y-2">
          {customer.orders.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`}>
              <Card className="hover:shadow-sm transition-shadow">
                <CardContent className="py-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{o.title}</p>
                    {o.due_date && (
                      <p className="text-xs text-slate-500">
                        {formatDate(o.due_date)}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={o.status as "nuovo" | "in_lavorazione" | "pronto" | "consegnato" | "annullato"} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
