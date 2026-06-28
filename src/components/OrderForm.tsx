"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createOrder, updateOrder, type OrderRow } from "@/actions/orders"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ErrorMessage } from "@/components/ErrorMessage"
import { toUserMessage } from "@/lib/errors"

const CANALI = ["negozio", "WhatsApp", "telefono", "mail", "sito", "altro"]
const BOZZA_OPTIONS = [
  { value: "non_serve", label: "Non serve" },
  { value: "da_fare", label: "Da fare" },
  { value: "inviata", label: "Inviata" },
  { value: "approvata", label: "Approvata" },
]

interface Props {
  order?: OrderRow
}

export function OrderForm({ order }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const isEdit = !!order

  const [canale, setCanale] = useState(order?.canale ?? "negozio")
  const [bozza, setBozza] = useState(order?.bozza_grafica ?? "non_serve")
  const [chiedereRec, setChiedereRec] = useState(order?.chiedere_recensione ?? false)
  const [recRichiesta, setRecRichiesta] = useState(order?.recensione_richiesta ?? false)
  const [recRicevuta, setRecRicevuta] = useState(order?.recensione_ricevuta ?? false)
  const [msgPronto, setMsgPronto] = useState(order?.msg_pronto_inviato ?? false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const fd = new FormData(e.currentTarget)

    const v = (k: string) => (fd.get(k) as string | null)?.trim() || null
    const n = (k: string) => { const val = fd.get(k); return val ? Number(val) : 0 }

    const payload = {
      nome: (fd.get("nome") as string).trim(),
      cognome: v("cognome"),
      telefono: v("telefono"),
      email_cliente: v("email_cliente"),
      canale,
      // data_ordine: set automatically by DB default on create, shown only in edit
      data_ordine: isEdit ? (order.data_ordine ?? null) : undefined,
      data_consegna: v("data_consegna"),
      data_consegnato: isEdit ? v("data_consegnato") : undefined,
      cosa_ordinato: (fd.get("cosa_ordinato") as string).trim(),
      testo_da_scrivere: v("testo_da_scrivere"),
      tipo_lavorazione: v("tipo_lavorazione"),
      quantita: Number(fd.get("quantita") ?? 1),
      bozza_grafica: bozza,
      foto_oggetto: v("foto_oggetto"),
      file_cliente: v("file_cliente"),
      note: v("note"),
      prezzo: n("prezzo"),
      acconto: n("acconto"),
      saldo: n("saldo"),
      chiedere_recensione: chiedereRec,
      recensione_richiesta: recRichiesta,
      recensione_ricevuta: recRicevuta,
      msg_pronto_inviato: msgPronto,
    }

    try {
      if (isEdit) {
        await updateOrder(order.id, payload)
        router.push(`/orders/${order.id}`)
      } else {
        const result = await createOrder(payload)
        router.push(`/orders/${result.id}`)
      }
      router.refresh()
    } catch (err) {
      setError(toUserMessage(err))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {error && <ErrorMessage message={error} />}

      {/* CLIENTE */}
      <section className="space-y-4">
        <h2 className="font-semibold text-slate-700 border-b pb-1">Cliente</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="nome">Nome *</Label>
            <Input id="nome" name="nome" required defaultValue={order?.nome} placeholder="Nome" />
          </div>
          <div>
            <Label htmlFor="cognome">Cognome</Label>
            <Input id="cognome" name="cognome" defaultValue={order?.cognome ?? ""} placeholder="Cognome" />
          </div>
          <div>
            <Label htmlFor="telefono">Telefono</Label>
            <Input id="telefono" name="telefono" type="tel" defaultValue={order?.telefono ?? ""} placeholder="+39 333 ..." />
          </div>
          <div>
            <Label htmlFor="email_cliente">Email</Label>
            <Input id="email_cliente" name="email_cliente" type="email" defaultValue={order?.email_cliente ?? ""} placeholder="email@..." />
          </div>
          <div>
            <Label htmlFor="canale">Canale d&apos;ingresso</Label>
            <select
              id="canale"
              value={canale}
              onChange={(e) => setCanale(e.target.value)}
              className="w-full h-9 rounded-lg border border-input bg-white px-3 text-sm"
            >
              {CANALI.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* ORDINE */}
      <section className="space-y-4">
        <h2 className="font-semibold text-slate-700 border-b pb-1">Ordine</h2>
        <div>
          <Label htmlFor="cosa_ordinato">Cosa ordinato *</Label>
          <Input id="cosa_ordinato" name="cosa_ordinato" required defaultValue={order?.cosa_ordinato} placeholder="Es. targa plexiglass, timbro, portachiavi inciso..." />
        </div>
        <div>
          <Label htmlFor="testo_da_scrivere">Testo da scrivere / incidere / stampare</Label>
          <Textarea id="testo_da_scrivere" name="testo_da_scrivere" rows={3} defaultValue={order?.testo_da_scrivere ?? ""} placeholder="Frase, nome, data, testo targa, testo timbro..." />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="tipo_lavorazione">Tipo lavorazione</Label>
            <Input id="tipo_lavorazione" name="tipo_lavorazione" defaultValue={order?.tipo_lavorazione ?? ""} placeholder="Incisione laser, stampa UV..." />
          </div>
          <div>
            <Label htmlFor="quantita">Quantità</Label>
            <Input id="quantita" name="quantita" type="number" min="1" defaultValue={order?.quantita ?? 1} />
          </div>
          <div>
            <Label htmlFor="bozza_grafica">Bozza grafica</Label>
            <select
              id="bozza_grafica"
              value={bozza}
              onChange={(e) => setBozza(e.target.value)}
              className="w-full h-9 rounded-lg border border-input bg-white px-3 text-sm"
            >
              {BOZZA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="file_cliente">File inviati dal cliente</Label>
            <Input id="file_cliente" name="file_cliente" defaultValue={order?.file_cliente ?? ""} placeholder="Nome file, link Drive, logo, foto..." />
          </div>
          <div>
            <Label htmlFor="foto_oggetto">Foto oggetto scelto</Label>
            <Input id="foto_oggetto" name="foto_oggetto" defaultValue={order?.foto_oggetto ?? ""} placeholder="Nome file o link" />
          </div>
        </div>
      </section>

      {/* DATE */}
      <section className="space-y-4">
        <h2 className="font-semibold text-slate-700 border-b pb-1">Date</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {isEdit && (
            <div>
              <Label htmlFor="data_ordine">Data ordine</Label>
              <Input id="data_ordine" name="data_ordine" type="date" defaultValue={order?.data_ordine ?? ""} />
            </div>
          )}
          <div>
            <Label htmlFor="data_consegna">Data consegna prevista</Label>
            <Input id="data_consegna" name="data_consegna" type="date" defaultValue={order?.data_consegna ?? ""} />
          </div>
          {isEdit && (
            <div>
              <Label htmlFor="data_consegnato">Data consegnato</Label>
              <Input id="data_consegnato" name="data_consegnato" type="date" defaultValue={order?.data_consegnato ?? ""} />
            </div>
          )}
        </div>
      </section>

      {/* PAGAMENTO */}
      <section className="space-y-4">
        <h2 className="font-semibold text-slate-700 border-b pb-1">Pagamento</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="prezzo">Prezzo (€)</Label>
            <Input id="prezzo" name="prezzo" type="number" step="0.01" min="0" defaultValue={order?.prezzo ?? 0} />
          </div>
          <div>
            <Label htmlFor="acconto">Acconto (€)</Label>
            <Input id="acconto" name="acconto" type="number" step="0.01" min="0" defaultValue={order?.acconto ?? 0} />
          </div>
          <div>
            <Label htmlFor="saldo">Saldo (€)</Label>
            <Input id="saldo" name="saldo" type="number" step="0.01" min="0" defaultValue={order?.saldo ?? 0} />
          </div>
        </div>
      </section>

      {/* VARIE */}
      <section className="space-y-4">
        <h2 className="font-semibold text-slate-700 border-b pb-1">Note</h2>
        <div>
          <Label htmlFor="note">Note interne</Label>
          <Textarea id="note" name="note" rows={2} defaultValue={order?.note ?? ""} placeholder="Note interne..." />
        </div>
        {isEdit && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Msg PRONTO inviato", state: msgPronto, set: setMsgPronto },
            { label: "Chiedere recensione", state: chiedereRec, set: setChiedereRec },
            { label: "Recensione richiesta", state: recRichiesta, set: setRecRichiesta },
            { label: "Recensione ricevuta", state: recRicevuta, set: setRecRicevuta },
          ].map(({ label, state, set }) => (
            <button
              key={label}
              type="button"
              onClick={() => set(!state)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors text-left ${
                state
                  ? "bg-green-50 border-green-300 text-green-700"
                  : "bg-white border-slate-200 text-slate-500"
              }`}
            >
              {state ? "✓ " : ""}{label}
            </button>
          ))}
        </div>
        )}
      </section>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Salvataggio…" : isEdit ? "Salva modifiche" : "Crea ordine"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Annulla
        </Button>
      </div>
    </form>
  )
}
