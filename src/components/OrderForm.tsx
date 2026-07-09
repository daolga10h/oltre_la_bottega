"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { createOrder, updateOrder, type OrderRow } from "@/actions/orders"
import { getCustomers, type CustomerSummary } from "@/actions/customers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ErrorMessage } from "@/components/ErrorMessage"
import { toUserMessage } from "@/lib/errors"
import { computeOrderStatus, computeSaldo } from "@/lib/orderConstants"

const CANALI = ["negozio", "WhatsApp", "telefono", "mail", "sito", "altro"]
const TIPI_LAVORAZIONE = ["Stampa UV", "Taglio + stampa", "Incisione/taglio laser", "Fresatura", "Stampa"]
const BOZZA_OPTIONS = [
  { value: "non_serve", label: "Non serve" },
  { value: "da_fare", label: "Da fare" },
  { value: "inviata", label: "Inviata" },
  { value: "approvata", label: "Approvata" },
]
const PREVENTIVO_OPTIONS = [
  { value: "non_inviare", label: "Non inviare" },
  { value: "da_inviare", label: "Da inviare" },
  { value: "inviato", label: "Inviato" },
  { value: "approvato", label: "Approvato" },
]
const MATERIALE_OPTIONS = [
  { value: "non_serve", label: "Non serve" },
  { value: "da_ordinare", label: "Da ordinare" },
  { value: "ordinato", label: "Ordinato" },
  { value: "arrivato", label: "Arrivato" },
]

const numClass = "w-full h-9 rounded-lg border border-input bg-card px-2 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"

interface Props {
  order?: OrderRow
}

export function OrderForm({ order }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const isEdit = !!order
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [error])

  // Autocomplete clienti esistenti
  const [allCustomers, setAllCustomers] = useState<CustomerSummary[]>([])
  const [suggestions, setSuggestions] = useState<CustomerSummary[]>([])
  const [showSugg, setShowSugg] = useState(false)
  const suggRef = useRef<HTMLDivElement>(null)

  // Campi cliente controllati (necessario per auto-fill da autocomplete)
  const [nomeValue, setNomeValue] = useState(order?.nome ?? "")
  const [cognomeValue, setCognomeValue] = useState(order?.cognome ?? "")
  const [telefonoValue, setTelefonoValue] = useState(order?.telefono ?? "")
  const [emailValue, setEmailValue] = useState(order?.email_cliente ?? "")

  useEffect(() => {
    getCustomers().then(setAllCustomers).catch(() => {})
  }, [])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (suggRef.current && !suggRef.current.contains(e.target as Node)) {
        setShowSugg(false)
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  function handleNomeInput(value: string) {
    setNomeValue(value)
    if (value.length < 2) { setShowSugg(false); return }
    const v = value.toLowerCase()
    const matches = allCustomers.filter((c) =>
      `${c.nome} ${c.cognome ?? ""}`.toLowerCase().includes(v) ||
      (c.telefono ?? "").includes(value)
    ).slice(0, 6)
    setSuggestions(matches)
    setShowSugg(matches.length > 0)
  }

  function fillCustomer(c: CustomerSummary) {
    setNomeValue(c.nome)
    setCognomeValue(c.cognome ?? "")
    setTelefonoValue(c.telefono ?? "")
    setEmailValue(c.email ?? "")
    setShowSugg(false)
  }

  const [canale, setCanale] = useState(order?.canale ?? "negozio")
  const [tipoLavorazione, setTipoLavorazione] = useState(order?.tipo_lavorazione ?? "")
  const [bozza, setBozza] = useState(order?.bozza_grafica ?? "non_serve")
  const [preventivo, setPreventivo] = useState(order?.preventivo ?? "non_inviare")
  const [materiale, setMateriale] = useState(order?.materiale ?? "non_serve")
  const [materialeFornitore, setMaterialeFornitore] = useState(order?.materiale_fornitore ?? "")
  const [materialeCosaManca, setMaterialeCosaManca] = useState(order?.materiale_cosa_manca ?? "")
  const [prezzoText, setPrezzoText] = useState(order?.prezzo ? order.prezzo.toFixed(2) : "")
  const [accontoText, setAccontoText] = useState(order?.acconto ? order.acconto.toFixed(2) : "")
  const prezzo = parseFloat(prezzoText) || 0
  const acconto = parseFloat(accontoText) || 0
  const saldo = computeSaldo(prezzo, acconto)
  const [fileCliente, setFileCliente] = useState(order?.file_cliente ?? "")
  const [consensoMarketing, setConsensoMarketing] = useState(order?.consenso_marketing ?? false)
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

    const payload = {
      nome: nomeValue.trim(),
      cognome: cognomeValue.trim() || null,
      telefono: telefonoValue.trim() || null,
      email_cliente: emailValue.trim() || null,
      canale,
      data_ordine: isEdit ? (order.data_ordine ?? null) : undefined,
      data_consegna: v("data_consegna"),
      data_consegnato: isEdit ? v("data_consegnato") : undefined,
      cosa_ordinato: (fd.get("cosa_ordinato") as string).trim(),
      testo_da_scrivere: v("testo_da_scrivere"),
      tipo_lavorazione: tipoLavorazione || null,
      quantita: Number(fd.get("quantita") ?? 1),
      bozza_grafica: bozza,
      materiale,
      materiale_fornitore: materialeFornitore.trim() || null,
      materiale_cosa_manca: materialeCosaManca.trim() || null,
      materiale_data_ordine: isEdit ? (order.materiale_data_ordine ?? null) : undefined,
      foto_oggetto: v("foto_oggetto"),
      dettagli_grafici: v("dettagli_grafici"),
      file_cliente: fileCliente || null,
      note: v("note"),
      prezzo,
      acconto,
      saldo,
      status: isEdit ? undefined : computeOrderStatus(preventivo, bozza),
      consenso_marketing: consensoMarketing,
      chiedere_recensione: chiedereRec,
      recensione_richiesta: recRichiesta,
      recensione_ricevuta: recRicevuta,
      msg_pronto_inviato: msgPronto,
    }

    try {
      if (isEdit) {
        await updateOrder(order.id, payload)
        window.location.href = `/orders/${order.id}`
      } else {
        const { id } = await createOrder(payload)
        window.location.href = `/orders/${id}`
      }
    } catch (err) {
      setError(toUserMessage(err))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {error && <div ref={errorRef}><ErrorMessage message={error} /></div>}

      {/* CLIENTE */}
      <section className="space-y-4">
        <h2 className="font-semibold text-foreground border-b pb-1">Cliente</h2>
        <div className="grid grid-cols-3 gap-3">
          <div ref={suggRef} className="relative">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              name="nome"
              required
              value={nomeValue}
              onChange={(e) => handleNomeInput(e.target.value)}
              onFocus={() => { if (suggestions.length > 0) setShowSugg(true) }}
              placeholder="Nome"
              autoComplete="off"
            />
            {showSugg && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                {suggestions.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => fillCustomer(c)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 flex items-center justify-between border-b border-border last:border-0"
                  >
                    <span className="font-medium">{[c.nome, c.cognome].filter(Boolean).join(" ")}</span>
                    {c.telefono && <span className="text-muted-foreground text-xs">{c.telefono}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="cognome">Cognome *</Label>
            <Input
              id="cognome"
              name="cognome"
              required
              value={cognomeValue}
              onChange={(e) => setCognomeValue(e.target.value)}
              placeholder="Cognome"
            />
          </div>
          <div>
            <Label htmlFor="telefono">Telefono *</Label>
            <Input
              id="telefono"
              name="telefono"
              type="tel"
              required
              value={telefonoValue}
              onChange={(e) => setTelefonoValue(e.target.value)}
              placeholder="+39 333 ..."
            />
          </div>
          <div>
            <Label htmlFor="email_cliente">Email</Label>
            <Input
              id="email_cliente"
              name="email_cliente"
              type="email"
              value={emailValue}
              onChange={(e) => setEmailValue(e.target.value)}
              placeholder="email@..."
            />
          </div>
          <div>
            <Label htmlFor="canale">Canale d&apos;ingresso</Label>
            <Select value={canale} onValueChange={(v) => v && setCanale(v)}>
              <SelectTrigger id="canale" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CANALI.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="data_consegna">Data consegna *</Label>
            <Input id="data_consegna" name="data_consegna" type="date" required defaultValue={order?.data_consegna ?? ""} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            id="consenso_marketing"
            type="checkbox"
            checked={consensoMarketing}
            onChange={(e) => setConsensoMarketing(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <Label htmlFor="consenso_marketing" className="mb-0 font-normal text-sm cursor-pointer">
            Consenso recensioni e comunicazioni (GDPR)
          </Label>
        </div>
      </section>

      {/* ORDINE */}
      <section className="space-y-4">
        <h2 className="font-semibold text-foreground border-b pb-1">Ordine</h2>
        <div>
          <Label htmlFor="cosa_ordinato">Cosa ordinato *</Label>
          <Input id="cosa_ordinato" name="cosa_ordinato" required autoComplete="off" defaultValue={order?.cosa_ordinato} placeholder="Es. targa plexiglass, timbro, portachiavi inciso..." />
        </div>
        <div>
          <Label htmlFor="testo_da_scrivere">Testo da scrivere / incidere / stampare</Label>
          <Textarea id="testo_da_scrivere" name="testo_da_scrivere" rows={3} autoComplete="off" defaultValue={order?.testo_da_scrivere ?? ""} placeholder="Frase, nome, data, testo targa, testo timbro..." />
        </div>
        <div>
          <Label htmlFor="dettagli_grafici">Dettagli grafici</Label>
          <Textarea id="dettagli_grafici" name="dettagli_grafici" rows={2} defaultValue={(order as any)?.dettagli_grafici ?? ""} placeholder="Font, posizione logo, colori, misure..." />
        </div>

        {/* Tipo lavorazione · Bozza grafica · Inviare preventivo — stessa riga */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="tipo_lavorazione">Tipo lavorazione</Label>
            <Select value={tipoLavorazione} onValueChange={(v) => setTipoLavorazione(v ?? "")}>
              <SelectTrigger id="tipo_lavorazione" className="w-full">
                <SelectValue placeholder="— Seleziona —" />
              </SelectTrigger>
              <SelectContent>
                {TIPI_LAVORAZIONE.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="bozza_grafica">Bozza grafica</Label>
            <Select items={BOZZA_OPTIONS} value={bozza} onValueChange={(v) => v && setBozza(v)}>
              <SelectTrigger id="bozza_grafica" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BOZZA_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="preventivo">Preventivo</Label>
            <Select items={PREVENTIVO_OPTIONS} value={preventivo} onValueChange={(v) => v && setPreventivo(v)}>
              <SelectTrigger id="preventivo" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PREVENTIVO_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="materiale">Materiale fornitore</Label>
            <Select items={MATERIALE_OPTIONS} value={materiale} onValueChange={(v) => {
              if (!v) return
              setMateriale(v)
              if (v === "non_serve") {
                setMaterialeFornitore("")
                setMaterialeCosaManca("")
              }
            }}>
              <SelectTrigger id="materiale" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MATERIALE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {materiale !== "non_serve" && (
            <>
              <div>
                <Label htmlFor="materiale_fornitore">Fornitore</Label>
                <Input id="materiale_fornitore" value={materialeFornitore} onChange={(e) => setMaterialeFornitore(e.target.value)} placeholder="Nome fornitore" />
              </div>
              <div>
                <Label htmlFor="materiale_cosa_manca">Cosa manca</Label>
                <Input id="materiale_cosa_manca" value={materialeCosaManca} onChange={(e) => setMaterialeCosaManca(e.target.value)} placeholder="Es. cartoncino 300gr" />
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Label htmlFor="file_cliente">File inviati dal cliente</Label>
            <Input id="file_cliente" value={fileCliente} onChange={(e) => setFileCliente(e.target.value)} placeholder="Nome file, link Drive, foto WhatsApp..." />
          </div>
          <div>
            <Label htmlFor="foto_oggetto">Foto oggetto</Label>
            <Input id="foto_oggetto" name="foto_oggetto" defaultValue={order?.foto_oggetto ?? ""} placeholder="Nome file o link" />
          </div>
        </div>
      </section>

      {/* DATE — solo in modifica */}
      {isEdit && (
        <section className="space-y-4">
          <h2 className="font-semibold text-foreground border-b pb-1">Date</h2>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="data_ordine">Data ordine</Label>
              <Input id="data_ordine" name="data_ordine" type="date" defaultValue={order?.data_ordine ?? ""} />
            </div>
            <div>
              <Label htmlFor="data_consegnato">Data consegnato</Label>
              <Input id="data_consegnato" name="data_consegnato" type="date" defaultValue={order?.data_consegnato ?? ""} />
            </div>
          </div>
        </section>
      )}

      {/* PAGAMENTO — quantità + prezzo + acconto + saldo stessa riga */}
      <section className="space-y-4">
        <h2 className="font-semibold text-foreground border-b pb-1">Pagamento</h2>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <Label htmlFor="quantita">Qta</Label>
            <input id="quantita" name="quantita" type="number" min="1" max="9999" defaultValue={order?.quantita ?? 1}
              className={numClass} />
          </div>
          <div>
            <Label htmlFor="prezzo">Prezzo €</Label>
            <input id="prezzo" type="number" inputMode="decimal" step="0.01" min="0" max="99999"
              value={prezzoText} placeholder="0.00"
              onChange={(e) => setPrezzoText(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={() => setPrezzoText(prezzoText ? (parseFloat(prezzoText) || 0).toFixed(2) : "")}
              className={numClass} />
          </div>
          <div>
            <Label htmlFor="acconto">Acconto €</Label>
            <input id="acconto" type="number" inputMode="decimal" step="0.01" min="0" max="99999"
              value={accontoText} placeholder="0.00"
              onChange={(e) => setAccontoText(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={() => setAccontoText(accontoText ? (parseFloat(accontoText) || 0).toFixed(2) : "")}
              className={numClass} />
          </div>
          <div>
            <Label>Saldo €</Label>
            <div className="h-9 rounded-lg border border-input bg-background px-2 text-sm flex items-center font-medium text-foreground">
              {saldo.toFixed(2)}
            </div>
          </div>
        </div>
      </section>

      {/* NOTE + FLAG */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground border-b pb-1">Note</h2>
        <div>
          <Textarea id="note" name="note" rows={2} aria-label="Note interne" defaultValue={order?.note ?? ""} />
        </div>
        {isEdit && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Msg PRONTO inviato", state: msgPronto, set: setMsgPronto },
              { label: "Chiedere recensione", state: chiedereRec, set: setChiedereRec },
              { label: "Recensione richiesta", state: recRichiesta, set: setRecRichiesta },
              { label: "Recensione ricevuta", state: recRicevuta, set: setRecRicevuta },
            ].map(({ label, state, set }) => (
              <button key={label} type="button" onClick={() => set(!state)}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors text-left ${
                  state ? "bg-honey border-gold/40 text-bark font-semibold" : "bg-card border-border text-muted-foreground"
                }`}>
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
