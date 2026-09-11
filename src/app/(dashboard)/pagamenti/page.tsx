import { getOrders } from "@/actions/orders"
import { toUserMessage } from "@/lib/errors"
import { ErrorMessage } from "@/components/ErrorMessage"
import { formatDate, formatEUR, buildClientDisplayName, buildWhatsAppLink, buildMailtoLink, cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { getShopName } from "@/lib/shop-name"
import { MessageCircle, Mail } from "lucide-react"
import Link from "next/link"

export default async function PagamentiPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const shopName = getShopName(user)

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
                        {waLink && (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                              "w-full text-xs inline-flex items-center justify-center gap-1"
                            )}
                          >
                            <MessageCircle className="w-3 h-3" />Chiedi su WhatsApp
                          </a>
                        )}
                        {mailLink && (
                          <a
                            href={mailLink}
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                              "w-full text-xs inline-flex items-center justify-center gap-1"
                            )}
                          >
                            <Mail className="w-3 h-3" />Chiedi via email
                          </a>
                        )}
                        <Link
                          href={`/orders/${o.id}`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full text-xs")}
                        >
                          Scheda
                        </Link>
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
