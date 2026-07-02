import { notFound } from "next/navigation"
import { getOrder } from "@/actions/orders"
import { createClient } from "@/lib/supabase/server"
import { getShopName } from "@/lib/shop-name"
import { PrintClient } from "./PrintClient"

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const order = await getOrder(id)
  if (!order) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const shopName = getShopName(user)

  return (
    <>
      <style>{`
        @page { margin: 0; size: 62mm auto; }
        body { margin: 0; background: white; }
      `}</style>
      <PrintClient
        orderId={id}
        nome={order.nome}
        cognome={order.cognome}
        telefono={order.telefono}
        dataConsegna={order.data_consegna}
        shopName={shopName}
      />
    </>
  )
}
