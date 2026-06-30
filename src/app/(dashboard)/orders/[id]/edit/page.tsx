import { notFound } from "next/navigation"
import { getOrder } from "@/actions/orders"
import { OrderForm } from "@/components/OrderForm"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const order = await getOrder(id)
  if (!order) notFound()

  return (
    <div className="max-w-4xl mx-auto">
      <Link href={`/orders/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="w-3 h-3" />Torna all&apos;ordine
      </Link>
      <h1 className="text-2xl font-bold mb-6">Modifica ordine</h1>
      <OrderForm order={order} />
    </div>
  )
}
