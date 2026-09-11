import { getOrders } from "@/actions/orders"
import { STATUS_ORDER, STATUS_LABELS } from "@/lib/orderConstants"
import { formatDate, formatEUR, buildClientDisplayName } from "@/lib/utils"
import { createClient } from "@/lib/supabase/server"
import { getShopName } from "@/lib/shop-name"
import { StampaButton } from "./StampaButton"

export default async function RiepilogoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const shopName = getShopName(user)

  const orders = await getOrders({ activeOnly: true })
  const oggi = formatDate(new Date())

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Riepilogo lavori</h1>
          <p className="text-sm text-muted-foreground">{shopName} — {oggi}</p>
        </div>
        <StampaButton />
      </div>

      {orders.length === 0 && (
        <p className="text-muted-foreground text-sm">Nessun ordine attivo.</p>
      )}

      {STATUS_ORDER.filter((s) => s !== "consegnato").map((status) => {
        const statusOrders = orders.filter((o) => o.status === status)
        if (statusOrders.length === 0) return null
        return (
          <div key={status} className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground border-b border-border pb-1">
              {STATUS_LABELS[status]}
            </h2>
            <table className="w-full text-sm">
              <tbody>
                {statusOrders.map((o) => {
                  const clientName = buildClientDisplayName(o.nome, o.cognome, o.azienda)
                  return (
                    <tr key={o.id} className="border-b border-border last:border-0 [break-inside:avoid]">
                      <td className="px-2 py-2 align-top">
                        <p className="font-semibold">{clientName}</p>
                        {o.referente && <p className="text-xs text-muted-foreground">Ref. {o.referente}</p>}
                      </td>
                      <td className="px-2 py-2 align-top">{o.cosa_ordinato}</td>
                      <td className="px-2 py-2 align-top text-muted-foreground">{o.telefono ?? "—"}</td>
                      <td className="px-2 py-2 align-top text-muted-foreground">
                        {o.data_consegna ? formatDate(o.data_consegna) : "—"}
                      </td>
                      <td className="px-2 py-2 align-top font-semibold text-gold">€{formatEUR(o.saldo)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
