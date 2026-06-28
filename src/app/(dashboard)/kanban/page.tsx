export const dynamic = "force-dynamic"

import { getOrders } from "@/actions/orders"
import { KanbanBoard } from "@/components/KanbanBoard"

export default async function KanbanPage() {
  const orders = await getOrders()
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Stati lavoro</h1>
      <p className="text-sm text-slate-500">Ordini divisi per fase di lavorazione</p>
      <KanbanBoard orders={orders} />
    </div>
  )
}
