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
import { computeOrderSummary, type OrderItemInput } from "@/lib/orderItems"
import { appendDictatedText } from "@/lib/dictation"
import { VoiceDictationButton } from "@/components/VoiceDictationButton"
import type { OrderItemRow } from "@/actions/orders"
import { getRememberedOperator, setRememberedOperator } from "@/lib/device-operator"
import { hasFeature } from "@/lib/plan"
import Link from "next/link"

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
  order?: OrderRow & { items?: OrderItemRow[] }
  operatori?: string[]
}

export function OrderForm({ order, operatori = [] }: Props) {
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
  const [aziendaValue, setAziendaValue] = useState(order?.azienda ?? "")
  const [isEnte, setIsEnte] = useState(order?.is_ente ?? false)
  const [referenteValue, setReferenteValue] = useState(order?.referente ?? "")
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
      (c.azienda ?? "").toLowerCase().includes(v) ||
      (c.telefono ?? "").includes(value)
    ).slice(0, 6)
    setSuggestions(matches)
    setShowSugg(matches.length > 0)
  }

  function fillCustomer(c: CustomerSummary) {
    setNomeValue(c.nome)
    setIsEnte(c.is_ente)
    setCognomeValue(c.is_ente ? "" : (c.cognome ?? ""))
    setAziendaValue(c.is_ente ? "" : (c.azienda ?? ""))
    setReferenteValue(c.is_ente ? (c.referente ?? "") : "")
    setTelefonoValue(c.telefono ?? "")
    setEmailValue(c.email ?? "")
    setShowSugg(false)
  }

  const [canale, setCanale] = useState(order?.canale ?? "negozio")
  const [operatoreValue, setOperatoreValue] = useState<string>(() => {
    if (isEdit) return ""
    const remembered = getRememberedOperator()
    return remembered && operatori.includes(remembered) ? remembered : ""
  })
  const [tipoLavorazione, setTipoLavorazione] = useState(order?.tipo_lavorazione ?? "")
  const [bozza, setBozza] = useState(order?.bozza_grafica ?? "non_serve")
  const [preventivo, setPreventivo] = useState(order?.preventivo ?? "non_inviare")
  const [materiale, setMateriale] = useState(order?.materiale ?? "non_serve")
  const [materialeFornitore, setMaterialeFornitore] = useState(order?.materiale_fornitore ?? "")
  const [materialeCosaManca, setMaterialeCosaManca] = useState(order?.materiale_cosa_manca ?? "")
  type ItemRow = { id: number; cosaOrdinato: string; testoDaScrivere: string; quantita: string; prezzoUnitario: string }
  const [items, setItems] = useState<ItemRow[]>(() => {
    if (order?.items && order.items.length > 0) {
      return order.items.map((it, idx) => ({
        id: idx,
        cosaOrdinato: it.cosa_ordinato,
        testoDaScrivere: it.testo_da_scrivere ?? "",
        quantita: String(it.quantita),
        prezzoUnitario: it.prezzo_unitario.toFixed(2),
      }))
    }
    return [{ id: 0, cosaOrdinato: "", testoDaScrivere: "", quantita: "1", prezzoUnitario: "" }]
  })
  const nextItemId = useRef(items.length)
  const noteRef = useRef<HTMLTextAreaElement>(null)

  function addItem() {
    setItems((prev) => [...prev, { id: nextItemId.current++, cosaOrdinato: "", testoDaScrivere: "", quantita: "1", prezzoUnitario: "" }])
  }
  function removeItem(id: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev))
  }
  function updateItem(
    id: number,
    field: keyof Omit<ItemRow, "id">,
    value: string | ((prev: string) => string)
  ) {
    // Il valore puo' essere una funzione: serve per la dettatura vocale, dove
    // ogni frase riconosciuta deve accodarsi al testo piu' recente e non a
    // quello catturato nella closure al momento in cui l'ascolto e' partito.
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? { ...it, [field]: typeof value === "function" ? value(it[field]) : value }
          : it
      )
    )
  }
  const itemInputs: OrderItemInput[] = items.map((it) => ({
    cosa_ordinato: it.cosaOrdinato.trim(),
    testo_da_scrivere: it.testoDaScrivere.trim() || null,
    quantita: parseInt(it.quantita, 10) || 1,
    prezzo_unitario: parseFloat(it.prezzoUnitario) || 0,
  }))
  const { prezzo: itemsTotal } = computeOrderSummary(itemInputs)
  const [accontoText, setAccontoText] = useState(order?.acconto ? order.acconto.toFixed(2) : "")
  const acconto = parseFloat(accontoText) || 0
  const saldo = computeSaldo(itemsTotal, acconto)
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
      is_ente: isEnte,
      cognome: isEnte ? null : (cognomeValue.trim() || null),
      azienda: isEnte ? null : (aziendaValue.trim() || null),
      referente: isEnte ? (referenteValue.trim() || null) : null,
      telefono: telefonoValue.trim() || null,
      email_cliente: emailValue.trim() || null,
      canale,
      operatore: isEdit || !hasFeature("operatore") ? undefined : operatoreValue,
      data_ordine: isEdit ? (order.data_ordine ?? null) : undefined,
      data_consegna: v("data_consegna"),
      data_consegnato: isEdit ? v("data_consegnato") : undefined,
      items: itemInputs,
      tipo_lavorazione: tipoLavorazione || null,
      bozza_grafica: bozza,
      materiale,
      materiale_fornitore: materialeFornitore.trim() || null,
      materiale_cosa_manca: materialeCosaManca.trim() || null,
      materiale_data_ordine: isEdit ? (order.materiale_data_ordine ?? null) : undefined,
      // Nel livello base questi campi non ci sono: non vanno inviati, altrimenti
      // il salvataggio azzererebbe i valori già presenti nell'ordine.
      ...(hasFeature("campi_avanzati")
        ? {
            foto_oggetto: v("foto_oggetto"),
            dettagli_grafici: v("dettagli_grafici"),
            file_cliente: fileCliente || null,
          }
        : {}),
      note: v("note"),
      acconto,
      saldo,
      status: isEdit ? undefined : computeOrderStatus(preventivo, bozza),
      consenso_marketing: consensoMarketing,
      chiedere_recensione: isEnte ? false : chiedereRec,
      recensione_richiesta: isEnte ? false : recRichiesta,
      recensione_ricevuta: isEnte ? false : recRicevuta,
      msg_pronto_inviato: msgPronto,
    }

    try {
      if (isEdit) {
        await updateOrder(order.id, payload)
        window.location.href = `/orders/${order.id}`
      } else {
        const { id } = await createOrder(payload)
        if (hasFeature("operatore")) setRememberedOperator(operatoreValue)
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
        {hasFeature("ente") && (
          <div className="flex items-center gap-2">
            <input
              id="is_ente"
              type="checkbox"
              checked={isEnte}
              onChange={(e) => setIsEnte(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="is_ente" className="mb-0 font-normal text-sm cursor-pointer">
              È un ente/azienda (non una persona)
            </Label>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          <div ref={suggRef} className="relative">
            <Label htmlFor="nome">{isEnte ? "Nome ente/azienda *" : "Nome *"}</Label>
            <Input
              id="nome"
              name="nome"
              required
              value={nomeValue}
              onChange={(e) => handleNomeInput(e.target.value)}
              onFocus={() => { if (suggestions.length > 0) setShowSugg(true) }}
              placeholder={isEnte ? "Es. Comune di X" : "Nome"}
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
                    <span className="font-medium">
                      {c.is_ente ? c.nome : [c.nome, c.cognome].filter(Boolean).join(" ")}
                      {!c.is_ente && c.azienda && (
                        <span className="text-muted-foreground font-normal"> — {c.azienda}</span>
                      )}
                      {c.is_ente && c.referente && (
                        <span className="text-muted-foreground font-normal"> — Ref. {c.referente}</span>
                      )}
                    </span>
                    {c.telefono && <span className="text-muted-foreground text-xs">{c.telefono}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          {!isEnte && (
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
          )}
          {!isEnte && (
            <div>
              <Label htmlFor="azienda">Azienda</Label>
              <Input
                id="azienda"
                name="azienda"
                value={aziendaValue}
                onChange={(e) => setAziendaValue(e.target.value)}
                placeholder="Associazione, azienda... (facoltativo)"
              />
            </div>
          )}
          {isEnte && (
            <div>
              <Label htmlFor="referente">Referente</Label>
              <Input
                id="referente"
                name="referente"
                value={referenteValue}
                onChange={(e) => setReferenteValue(e.target.value)}
                placeholder="Facoltativo — persona di contatto"
              />
            </div>
          )}
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
        {!isEdit && hasFeature("operatore") && (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="operatore">Operatore *</Label>
              {operatori.length > 0 ? (
                <Select value={operatoreValue} onValueChange={(v) => v && setOperatoreValue(v)}>
                  <SelectTrigger id="operatore" className="w-full">
                    <SelectValue placeholder="— Seleziona —" />
                  </SelectTrigger>
                  <SelectContent>
                    {operatori.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-xs text-muted-foreground pt-2">
                  Nessun operatore configurato.{" "}
                  <Link href="/impostazioni" className="underline hover:text-foreground">
                    Aggiungi operatori in Impostazioni
                  </Link>
                </p>
              )}
            </div>
          </div>
        )}
        <div className="space-y-3">
          <Label>Articoli *</Label>
          {items.map((item, idx) => (
            <div key={item.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Riga {idx + 1}</span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-xs text-terracotta hover:underline"
                  >
                    Rimuovi
                  </button>
                )}
              </div>
              <Input
                required
                autoComplete="off"
                value={item.cosaOrdinato}
                onChange={(e) => updateItem(item.id, "cosaOrdinato", e.target.value)}
                placeholder="Es. targa plexiglass, timbro, portachiavi inciso..."
              />
              <div className="flex items-start gap-2">
                <Textarea
                  rows={2}
                  autoComplete="off"
                  value={item.testoDaScrivere}
                  onChange={(e) => updateItem(item.id, "testoDaScrivere", e.target.value)}
                  placeholder="Testo da scrivere / incidere / stampare"
                  className="flex-1"
                />
                <VoiceDictationButton
                  onTranscript={(chunk) =>
                    updateItem(item.id, "testoDaScrivere", (prev) => appendDictatedText(prev, chunk))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Quantità</Label>
                  <input
                    type="number" inputMode="numeric" min="1" step="1"
                    value={item.quantita}
                    onChange={(e) => updateItem(item.id, "quantita", e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className={numClass}
                  />
                </div>
                <div>
                  <Label className="text-xs">Prezzo unitario €</Label>
                  <input
                    type="number" inputMode="decimal" step="0.01" min="0" max="99999"
                    value={item.prezzoUnitario} placeholder="0.00"
                    onChange={(e) => updateItem(item.id, "prezzoUnitario", e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className={numClass}
                  />
                </div>
              </div>
            </div>
          ))}
          {hasFeature("multi_riga") && (
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              + Aggiungi articolo
            </Button>
          )}
          <p className="text-sm text-muted-foreground">
            Totale: <span className="font-semibold text-foreground">€{itemsTotal.toFixed(2)}</span>
          </p>
        </div>
        {hasFeature("campi_avanzati") && (
          <div>
            <Label htmlFor="dettagli_grafici">Dettagli grafici</Label>
            <Textarea id="dettagli_grafici" name="dettagli_grafici" rows={2} defaultValue={(order as any)?.dettagli_grafici ?? ""} placeholder="Font, posizione logo, colori, misure..." />
          </div>
        )}

        {/* Tipo lavorazione · Bozza grafica · Inviare preventivo — stessa riga */}
        <div className="grid grid-cols-3 gap-3">
          {hasFeature("campi_avanzati") && (
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
          )}
          {hasFeature("bozza_grafica") && (
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
          )}
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

        {hasFeature("materiale") && (
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
        )}

        {hasFeature("campi_avanzati") && (
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
        )}
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

      {/* PAGAMENTO — prezzo + acconto + saldo stessa riga */}
      <section className="space-y-4">
        <h2 className="font-semibold text-foreground border-b pb-1">Pagamento</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Prezzo € (calcolato)</Label>
            <div className="h-9 rounded-lg border border-input bg-background px-2 text-sm flex items-center font-medium text-foreground">
              {itemsTotal.toFixed(2)}
            </div>
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
        <div className="flex items-start gap-2">
          <Textarea
            id="note"
            name="note"
            rows={2}
            aria-label="Note interne"
            defaultValue={order?.note ?? ""}
            ref={noteRef}
            className="flex-1"
          />
          <VoiceDictationButton
            onTranscript={(chunk) => {
              if (!noteRef.current) return
              noteRef.current.value = appendDictatedText(noteRef.current.value, chunk)
            }}
          />
        </div>
        {isEdit && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Msg PRONTO inviato", state: msgPronto, set: setMsgPronto },
              ...(isEnte ? [] : [
                { label: "Chiedere recensione", state: chiedereRec, set: setChiedereRec },
                { label: "Recensione richiesta", state: recRichiesta, set: setRecRichiesta },
                { label: "Recensione ricevuta", state: recRicevuta, set: setRecRicevuta },
              ]),
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
        <Button type="submit" disabled={saving || (!isEdit && hasFeature("operatore") && !operatoreValue)}>
          {saving ? "Salvataggio…" : isEdit ? "Salva modifiche" : "Crea ordine"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Annulla
        </Button>
      </div>
    </form>
  )
}
