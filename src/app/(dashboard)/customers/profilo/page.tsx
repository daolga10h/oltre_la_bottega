import { getOrdersByCustomer } from "@/actions/customers"
import { StatusBadge } from "@/components/OrderCard"
import { formatDate, formatEUR } from "@/lib/utils"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

interface Props {
  searchParams: Promise<{ nome?: string; tel?: string }>
}

export default async function CustomerProfiloPage({ searchParams }: Props) {
  const { nome = "", tel } = await searchParams
  const orders = await getOrdersByCustomer(nome, tel)

  const firstOrder = orders[0]
  const email = firstOrder?.email_cliente
  const telefono = tel ?? firstOrder?.telefono
  const totalSpeso = orders.reduce((sum, o) => sum + (o.prezzo ?? 0), 0)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href="/customers"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-3 h-3" />Clienti
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{nome}</h1>
        <div className="flex flex-col gap-0.5 mt-1">
          {telefono && <p className="text-sm text-muted-foreground">{telefono}</p>}
          {email && <p className="text-sm text-muted-foreground">{email}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-center shadow-[0px_4px_8px_0px_rgba(38,27,7,0.06)]">
          <p className="text-xs text-muted-foreground">Ordini totali</p>
          <p className="text-xl font-bold text-foreground">{orders.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-center shadow-[0px_4px_8px_0px_rgba(38,27,7,0.06)]">
          <p className="text-xs text-muted-foreground">Totale speso</p>
          <p className="text-xl font-bold text-foreground">€{formatEUR(totalSpeso)}</p>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
          Storico ordini
        </h2>

        {orders.length === 0 && (
          <p className="text-muted-foreground text-sm">Nessun ordine trovato.</p>
        )}

        {orders.map((o) => (
          <Link
            key={o.id}
            href={`/orders/${o.id}`}
            className="block bg-card border border-border rounded-lg p-4 hover:shadow-[0px_4px_10px_0px_rgba(38,27,7,0.1)] transition-shadow space-y-1.5"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-sm">{o.cosa_ordinato}</p>
              <StatusBadge status={o.status} />
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground">
              {o.data_ordine && <span>{formatDate(o.data_ordine)}</span>}
              {o.data_consegna && <span>Consegna: {formatDate(o.data_consegna)}</span>}
              {o.prezzo ? <span className="font-medium text-foreground">€{formatEUR(o.prezzo)}</span> : null}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
