import { notFound } from "next/navigation"
import { ArrowDown, ArrowUp } from "lucide-react"
import { getMaterials } from "@/actions/materiali"
import { toUserMessage } from "@/lib/errors"
import { ErrorMessage } from "@/components/ErrorMessage"
import { MaterialiImport } from "@/components/MaterialiImport"
import { MaterialeRowActions } from "@/components/MaterialeRowActions"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { formatDate, cn } from "@/lib/utils"
import { hasFeature } from "@/lib/plan"
import { formatPrezzo, matchesSearch, priceVariation, type Materiale } from "@/lib/materiali"

// La lettura di un documento (server action chiamata da questa pagina) può durare qualche secondo.
export const maxDuration = 60

const TH = "text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest"

function Variazione({ attuale, precedente }: { attuale: number; precedente: number | null }) {
  const v = priceVariation(attuale, precedente)
  if (v === null || Math.abs(v) < 0.05) return null
  const su = v > 0
  const Icona = su ? ArrowUp : ArrowDown
  return (
    <span
      className={cn(
        "ml-2 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs",
        su ? "bg-terracotta/15 text-terracotta" : "bg-sage text-espresso"
      )}
    >
      <Icona className="w-3 h-3" />
      {su ? "+" : "−"}
      {Math.abs(v).toFixed(1).replace(".", ",")}%
    </span>
  )
}

export default async function MaterialiPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  if (!hasFeature("materiali")) notFound()
  const { q } = await searchParams

  let tutti: Materiale[] = []
  let errorMsg: string | null = null
  try {
    tutti = await getMaterials()
  } catch (err) {
    errorMsg = toUserMessage(err)
  }
  const mostrati = q ? tutti.filter((m) => matchesSearch(m, q)) : tutti

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Materiali</h1>

      {errorMsg && <ErrorMessage message={errorMsg} />}

      <MaterialiImport esistenti={tutti} />

      <form method="get" className="flex gap-2 max-w-md">
        <Input name="q" defaultValue={q ?? ""} placeholder="Cerca fornitore, codice o materiale" aria-label="Cerca" />
        <Button type="submit" variant="outline">
          Cerca
        </Button>
      </form>

      {mostrati.length === 0 && !errorMsg && (
        <p className="text-muted-foreground text-sm">
          {tutti.length === 0
            ? "Nessun materiale. Carica un documento del fornitore o aggiungi i materiali a mano."
            : "Nessun materiale corrisponde alla ricerca."}
        </p>
      )}

      {mostrati.length > 0 && (
        <>
        {/* Tablet e telefono (sotto i 1280 px): una scheda per materiale, senza scorrere di lato */}
        <div className="xl:hidden space-y-3">
          {mostrati.map((m) => (
            <div key={m.id} className="bg-card rounded-lg border border-border p-4 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">{m.fornitore}</p>
                <p className="font-semibold">{m.nome}</p>
                {(m.codice || m.unita) && (
                  <p className="text-xs text-muted-foreground">{[m.codice, m.unita].filter(Boolean).join(" · ")}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Prezzo attuale</p>
                  <p className="font-semibold">
                    €{formatPrezzo(m.prezzo_attuale)}
                    <Variazione attuale={m.prezzo_attuale} precedente={m.prezzo_precedente} />
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(m.data_acquisto_attuale)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Prezzo precedente</p>
                  <p>{m.prezzo_precedente === null ? "—" : `€${formatPrezzo(m.prezzo_precedente)}`}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.data_acquisto_precedente ? formatDate(m.data_acquisto_precedente) : "—"}
                  </p>
                </div>
              </div>
              <MaterialeRowActions materiale={m} />
            </div>
          ))}
        </div>

        <div className="hidden xl:block bg-card rounded-lg border border-border scroll-visibile">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-background">
                <th className={TH}>Fornitore</th>
                <th className={TH}>Materiale</th>
                <th className={TH}>Prezzo attuale</th>
                <th className={TH}>Data acquisto attuale</th>
                <th className={TH}>Prezzo precedente</th>
                <th className={TH}>Data acquisto precedente</th>
                <th className={TH}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {mostrati.map((m) => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-muted/40 align-top">
                  <td className="px-4 py-3">{m.fornitore}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{m.nome}</p>
                    {(m.codice || m.unita) && (
                      <p className="text-xs text-muted-foreground">
                        {[m.codice, m.unita].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-semibold">
                    €{formatPrezzo(m.prezzo_attuale)}
                    <Variazione attuale={m.prezzo_attuale} precedente={m.prezzo_precedente} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(m.data_acquisto_attuale)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {m.prezzo_precedente === null ? "—" : `€${formatPrezzo(m.prezzo_precedente)}`}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {m.data_acquisto_precedente ? formatDate(m.data_acquisto_precedente) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <MaterialeRowActions materiale={m} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  )
}
