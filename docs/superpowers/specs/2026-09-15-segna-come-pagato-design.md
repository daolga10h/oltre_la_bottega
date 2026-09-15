# Design: bottone rapido "Segna come pagato"

Data: 2026-09-15

## Motivazione

Un ordine consegnato con saldo residuo compare in "Da incassare" (`/pagamenti`, vedere `docs/superpowers/specs/2026-09-10-pagamenti-in-sospeso-design.md`), ma oggi l'unico modo per azzerare il saldo è aprire "Modifica" dalla scheda ordine e cambiare a mano il campo Acconto — nessuna azione diretta né sulla scheda ordine né nella lista stessa. Segnalato dall'utente: prova a "segnalare pagamento effettuato" dalla scheda ordine e non trova un modo per farlo.

## Nuova server action `markPaymentReceived`

In `src/actions/orders.ts`, stesso stile di `markReviewReceived`/`markReviewRequested`:

```ts
export async function markPaymentReceived(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: order, error: readError } = await supabase
    .from("orders")
    .select("prezzo")
    .eq("id", id)
    .single()
  if (readError) {
    logError("markPaymentReceived", readError, { id })
    throw new Error(USER_MESSAGES.saveFailed)
  }
  const { error } = await supabase
    .from("orders")
    .update({ acconto: order.prezzo, saldo: 0 })
    .eq("id", id)
  if (error) {
    logError("markPaymentReceived", error, { id })
    throw new Error(USER_MESSAGES.saveFailed)
  }
  await supabase.from("order_events").insert({
    order_id: id,
    event_type: "payment_received",
    note: "Pagamento saldato",
  })
}
```

Stesso stile di gestione errori già in uso in tutte le altre action di questo file (`logError` + `throw new Error(USER_MESSAGES.saveFailed)`).

Imposta `acconto = prezzo` (invece di un flag separato) perché il saldo si calcola sempre come `prezzo - acconto` in tutta l'app (`computeSaldo`, `OrderForm.tsx`) — coerente con come si azzererebbe manualmente da Modifica, nessuna doppia fonte di verità tra "pagato" e "acconto pari al prezzo".

## Dove compare il bottone

**Scheda ordine** (`src/app/(dashboard)/orders/[id]/page.tsx`): nel riquadro Pagamento (Prezzo/Acconto/Saldo), un bottone "Segna come pagato" visibile solo quando `order.saldo > 0`. Stesso pattern già in uso in questa pagina per le altre azioni rapide (`changeStatus`, `changeBozza`, `changeMateriale`): `<form action={...}>` con funzione `"use server"` locale che chiama l'action e fa `revalidatePath` su `/orders/${id}`, `/orders`, `/dashboard` **e `/pagamenti`** (quest'ultimo percorso manca oggi anche in `updateOrder`/`updateOrderStatus` — bug collaterale minore, mai notato perché finora nessuna azione poteva far sparire un ordine da quella lista).

**Lista "Da incassare"** (`src/app/(dashboard)/pagamenti/page.tsx`): stesso bottone nella colonna Azioni, sotto ai link WhatsApp/Email/Scheda già presenti — permette di saldare senza aprire la scheda. Stessa funzione `"use server"` locale con gli stessi `revalidatePath`.

**Nessuna conferma (`confirm()`)** prima del click: azione leggera e corretta al bisogno da Modifica in caso di errore, stesso principio già scelto per il completamento dei promemoria in Agenda.

## Cosa NON cambia

- **Nessuna migration**: `acconto`/`saldo` esistono già.
- **Nessun modo per "annullare"**: se il pagamento è stato segnato per errore, si corregge da Modifica riportando l'Acconto al valore corretto — stesso meccanismo già usato oggi per qualsiasi altra correzione.
- **`updateOrder`/`updateOrderStatus`**: `revalidatePath("/pagamenti")` viene aggiunto anche qui nello stesso passaggio, per coerenza (un saldo può tornare a zero anche modificando l'ordine per intero, non solo con questo bottone).

## Test

Nuovi unit test in `src/actions/__tests__/orders.test.ts` per `markPaymentReceived` (stesso stile dei test già presenti per `updateMaterialeFornitore`/`markReviewReceived`): acconto impostato al valore di prezzo, saldo a 0, evento `payment_received` registrato, propagazione dell'errore se l'update fallisce. Nessuna infrastruttura di test per pagine/componenti in questo codebase (stessa convenzione già seguita per `/pagamenti`/`/recensioni`) — verificato manualmente: ordine consegnato con saldo residuo, click su "Segna come pagato" dalla scheda, sparisce da `/pagamenti`; stesso test dal bottone dentro `/pagamenti` stessa; un ordine con saldo già a zero non mostra il bottone.
