import { getCustomers } from "@/actions/customers"
import { formatDate } from "@/lib/utils"
import { ErrorMessage } from "@/components/ErrorMessage"
import { toUserMessage } from "@/lib/errors"
import Link from "next/link"

interface Props {
  searchParams: Promise<{ q?: string }>
}

export default async function CustomersPage({ searchParams }: Props) {
  const { q } = await searchParams
  let customers: Awaited<ReturnType<typeof getCustomers>> = []
  let errorMsg: string | null = null

  try {
    customers = await getCustomers(q)
  } catch (err) {
    errorMsg = toUserMessage(err)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Clienti</h1>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Cerca per nome o telefono…"
          className="flex-1 h-9 rounded-lg border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-espresso text-cream text-sm font-medium"
        >
          Cerca
        </button>
        {q && (
          <Link
            href="/customers"
            className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground"
          >
            Cancella
          </Link>
        )}
      </form>

      {errorMsg && <ErrorMessage message={errorMsg} />}

      {customers.length === 0 && !errorMsg && (
        <p className="text-muted-foreground text-sm">Nessun cliente trovato.</p>
      )}

      {customers.length > 0 && (
        <div className="bg-card rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-background">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  Cliente
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  Telefono
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest hidden sm:table-cell">
                  Email
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  Ordini
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest hidden sm:table-cell">
                  Ultimo ordine
                </th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c, i) => {
                const fullName = [c.nome, c.cognome].filter(Boolean).join(" ")
                const href =
                  `/customers/profilo?nome=${encodeURIComponent(fullName)}` +
                  (c.telefono ? `&tel=${encodeURIComponent(c.telefono)}` : "")
                return (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Link href={href} className="font-bold hover:underline">
                        {fullName}
                      </Link>
                      {c.consenso_marketing && (
                        <span className="ml-2 text-xs bg-honey text-bark px-1.5 py-0.5 rounded">
                          consenso
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.telefono ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {c.email ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold">
                      {c.totale_ordini}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {c.ultimo_ordine ? formatDate(c.ultimo_ordine) : "—"}
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
