import { notFound } from "next/navigation"
import { getOrder } from "@/actions/orders"
import { createClient } from "@/lib/supabase/server"
import { getShopName } from "@/lib/shop-name"
import { getPlan, resolvePrintFormat } from "@/lib/plan"
import { PrintClient } from "./PrintClient"
import { FoglioLavoroClient } from "./FoglioLavoroClient"

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ formato?: string }>
}) {
  const { id } = await params
  const { formato } = await searchParams
  const order = await getOrder(id)
  if (!order) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const shopName = getShopName(user)

  const format = resolvePrintFormat(formato, getPlan())

  const data = {
    orderId: id,
    nome: order.nome,
    cognome: order.cognome,
    azienda: order.azienda,
    referente: order.referente,
    telefono: order.telefono,
    articoli: order.items.map((item) => ({ cosa_ordinato: item.cosa_ordinato, quantita: item.quantita })),
    dataConsegna: order.data_consegna,
    saldo: order.saldo,
    shopName,
  }

  return (
    <>
      <style>
        {format === "foglio"
          ? `
        @page { margin: 0; size: A4 portrait; }
        body { margin: 0; background: white; }
      `
          : `
        @page { margin: 0; size: 62mm auto; }
        body { margin: 0; background: white; }
      `}
      </style>
      {format === "foglio" ? <FoglioLavoroClient {...data} /> : <PrintClient {...data} />}
    </>
  )
}
