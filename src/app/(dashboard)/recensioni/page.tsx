import { getOrders, markReviewRequested, markReviewReceived } from "@/actions/orders"
import { toUserMessage } from "@/lib/errors"
import { ErrorMessage } from "@/components/ErrorMessage"
import { formatDate } from "@/lib/utils"
import { revalidatePath } from "next/cache"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import Link from "next/link"

function YesNoBadge({ value }: { value: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold",
        value
          ? "bg-honey text-bark"
          : "bg-linen text-muted-foreground"
      )}
    >
      {value ? "Sì" : "No"}
    </span>
  )
}

export default async function RecensioniPage() {
  let orders: Awaited<ReturnType<typeof getOrders>> = []
  let errorMsg: string | null = null

  try {
    const all = await getOrders({ status: "consegnato" })
    orders = all.filter((o) => o.chiedere_recensione && !o.recensione_ricevuta)
  } catch (err) {
    errorMsg = toUserMessage(err)
  }

  async function segnaRichiesta(formData: FormData) {
    "use server"
    const id = formData.get("id") as string
    await markReviewRequested(id)
    revalidatePath("/recensioni")
  }

  async function segnaRicevuta(formData: FormData) {
    "use server"
    const id = formData.get("id") as string
    await markReviewReceived(id)
    revalidatePath("/recensioni")
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Recensioni</h1>

      {errorMsg && <ErrorMessage message={errorMsg} />}

      {orders.length === 0 && !errorMsg && (
        <p className="text-muted-foreground text-sm">
          Nessuna recensione da gestire. Le recensioni appaiono quando un ordine
          consegnato ha &ldquo;Chiedere recensione&rdquo; attivo.
        </p>
      )}

      {orders.length > 0 && (
        <div className="bg-card rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-background">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Telefono</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Data consegnato</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Cosa ordinato</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Chiedere recensione</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Recensione richiesta?</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Recensione ricevuta</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const clientName = [o.nome, o.cognome].filter(Boolean).join(" ")
                return (
                  <tr key={o.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Link href={`/orders/${o.id}`} className="font-bold hover:underline">
                        {clientName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{o.telefono ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {o.data_consegnato ? formatDate(o.data_consegnato) : "—"}
                    </td>
                    <td className="px-4 py-3">{o.cosa_ordinato}</td>
                    <td className="px-4 py-3 text-center">
                      <YesNoBadge value={o.chiedere_recensione} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <YesNoBadge value={o.recensione_richiesta} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <YesNoBadge value={o.recensione_ricevuta} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {!o.recensione_richiesta && (
                          <form action={segnaRichiesta}>
                            <input type="hidden" name="id" value={o.id} />
                            <button
                              type="submit"
                              className={cn(
                                buttonVariants({ variant: "outline", size: "sm" }),
                                "w-full text-xs"
                              )}
                            >
                              Segna richiesta
                            </button>
                          </form>
                        )}
                        {!o.recensione_ricevuta && (
                          <form action={segnaRicevuta}>
                            <input type="hidden" name="id" value={o.id} />
                            <button
                              type="submit"
                              className={cn(
                                buttonVariants({ variant: "outline", size: "sm" }),
                                "w-full text-xs"
                              )}
                            >
                              Segna ricevuta
                            </button>
                          </form>
                        )}
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
