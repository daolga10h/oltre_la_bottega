import { getOrders, markPaymentReceived } from "@/actions/orders"
import { toUserMessage } from "@/lib/errors"
import { revalidatePath } from "next/cache"
import { ErrorMessage } from "@/components/ErrorMessage"
import { QuickContactLink } from "@/components/QuickContactLink"
import { formatDate, formatEUR, buildClientDisplayName, buildWhatsAppLink, buildMailtoLink, cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { getShopName } from "@/lib/shop-name"
import { MessageCircle, Mail } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { hasFeature } from "@/lib/plan"

export default async function PagamentiPage() {
  if (!hasFeature("da_incassare")) notFound()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const shopName = getShopName(user)

  async function segnaPagato(formData: FormData) {
    "use server"
    const id = formData.get("id") as string
    await markPaymentReceived(id)
    revalidatePath("/pagamenti")
    revalidatePath(`/orders/${id}`)
    revalidatePath("/riepilogo")
  }

  let orders: Awaited<ReturnType<typeof getOrders>> = []
  let errorMsg: string | null = null

  try {
    const all = await getOrders({ status: "consegnato" })
    orders = all
      .filter((o) => o.saldo > 0)
      .sort((a, b) => {
        const da = a.data_consegnato ? new Date(a.data_consegnato).getTime() : 0
        const db = b.data_consegnato ? new Date(b.data_consegnato).getTime() : 0
        return da - db
      })
  } catch (err) {
    errorMsg = toUserMessage(err)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">In attesa di pagamento</h1>

      {errorMsg && <ErrorMessage message={errorMsg} />}

      {orders.length === 0 && !errorMsg && (
        <p className="text-muted-foreground text-sm">Nessun pagamento in sospeso.</p>
      )}

      {orders.length > 0 && (
        <div className="bg-card rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-background">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Data consegnato</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Saldo da incassare</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const clientName = buildClientDisplayName(o.nome, o.cognome, o.azienda)
                const messaggio = `Ciao ${o.nome}! Qui è ${shopName} 🙂 Ti ricordiamo che il saldo di €${formatEUR(o.saldo)} per il tuo ordine è ancora da saldare. Grazie!`
                const waLink = o.canale === "mail" ? null : buildWhatsAppLink(o.telefono, messaggio)
                const mailLink = o.canale === "mail" ? buildMailtoLink(o.email_cliente, `Saldo in sospeso — ${shopName}`, messaggio) : null
                return (
                  <tr key={o.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Link href={`/orders/${o.id}`} className="font-bold hover:underline">
                        {clientName}
                      </Link>
                      {o.referente && (
                        <p className="text-xs text-muted-foreground">Ref. {o.referente}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {o.data_consegnato ? formatDate(o.data_consegnato) : "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gold">€{formatEUR(o.saldo)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <QuickContactLink href={waLink} icon={MessageCircle} label="Chiedi su WhatsApp" external />
                        <QuickContactLink href={mailLink} icon={Mail} label="Chiedi via email" />
                        <Link
                          href={`/orders/${o.id}`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full text-xs")}
                        >
                          Scheda
                        </Link>
                        <form action={segnaPagato}>
                          <input type="hidden" name="id" value={o.id} />
                          <button
                            type="submit"
                            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full text-xs")}
                          >
                            Segna come pagato
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
