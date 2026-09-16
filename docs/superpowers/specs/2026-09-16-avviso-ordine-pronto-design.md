# Design: sezione "Da avvisare" + auto-segna "Msg pronto inviato"

Data: 2026-09-16

## Motivazione

Oggi avvisare il cliente che l'ordine è pronto è un passo interamente manuale: nel riquadro "Avvisa il cliente" della scheda ordine (`orders/[id]/page.tsx`) si clicca un link `wa.me`/`mailto`, e poi — separatamente — bisogna aprire "Modifica" e spuntare a mano il campo `msg_pronto_inviato` perché nessun'altra azione lo imposta. Il problema segnalato dall'utente non è "il messaggio si perde dopo l'invio": è che il passo umano salta a monte — l'ordine resta "pronto" e nessuno arriva mai a cliccare il link, perché non c'è nessun punto dell'app che lo segnali come "cosa da fare oggi". Scartata l'idea di una nuova voce di menu dedicata (navigazione già a 8 voci, rischio di appesantirla ulteriormente) in favore di appoggiarsi alla dashboard "Oggi", già il punto d'ingresso quotidiano.

## 1. Sezione "Da avvisare" nella dashboard "Oggi"

Nuova query in `src/app/api/dashboard/today/route.ts`, stesso pattern già in uso per "Materiale da ordinare":

```ts
supabase.from("orders").select("id, cosa_ordinato, nome, cognome, azienda, referente")
  .eq("status", "pronto").eq("msg_pronto_inviato", false),
```

aggiunta al `Promise.all` esistente, esposta nella risposta JSON come `daAvvisare`.

In `src/components/TodayBoard.tsx`, nuova `DashboardListCard` ("Da avvisare", badge honey/gold — lo stesso già usato per il riquadro "Avvisa il cliente" in scheda ordine, coerenza semantica con lo stesso concetto), con `chevron` (è un'azione da fare, non uno stato completato — stesso trattamento di "Da consegnare oggi"/"Materiale da ordinare"). Posizionata subito dopo "Da consegnare oggi": entrambe sono liste "da fare" legate allo stato ordine, prima delle liste "completato oggi" (Consegnati oggi, Materiale ordinato oggi). Click sulla card → scheda ordine, come tutte le altre sezioni.

Mostra **tutti** gli ordini pronti-non-avvisati, anche quelli senza telefono/email valido: in quel caso serve comunque un'azione (chiamare, o aggiungere il contatto da Modifica), quindi non va nascosto — a differenza del riquadro in scheda ordine, che invece si nasconde del tutto se non c'è nessun link possibile (nessuna regressione lì, resta come oggi).

Aggiornata anche la condizione dell'empty-state ("Nessuna scadenza per oggi...") per includere `daAvvisare.length === 0`.

## 2. Il click sul link WhatsApp/Email segna da solo "Msg pronto inviato"

Nuova server action `markMsgProntoInviato(id)` in `src/actions/orders.ts`, stesso stile di `markPaymentReceived`:

```ts
export async function markMsgProntoInviato(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("orders")
    .update({ msg_pronto_inviato: true })
    .eq("id", id)
  if (error) {
    logError("markMsgProntoInviato", error, { id })
    throw new Error(USER_MESSAGES.saveFailed)
  }
  await supabase.from("order_events").insert({
    order_id: id,
    event_type: "msg_pronto_inviato",
    note: "Messaggio \"pronto per il ritiro\" inviato",
  })
}
```

Nessuna lettura preliminare necessaria (a differenza di `markPaymentReceived`, che deve leggere `prezzo` prima di scrivere l'acconto): qui il nuovo valore non dipende da nulla che sia già in tabella.

`src/components/QuickContactLink.tsx` guadagna un prop opzionale `onClick?: () => void`, passato all'`<a>` insieme a `href`/`target` — non cambia nulla per i 4 usi esistenti (Recensioni, Da incassare) che non lo passano.

Nuovo componente client `src/components/NotifyReadyLinks.tsx`:

```tsx
"use client"
export function NotifyReadyLinks({ orderId, waLink, mailLink }: { orderId: string; waLink: string | null; mailLink: string | null }) {
  const router = useRouter()
  function handleClick() {
    markMsgProntoInviato(orderId).then(() => router.refresh())
  }
  return (
    <>
      <QuickContactLink href={waLink} icon={MessageCircle} label="WhatsApp" external variant="toolbar" onClick={handleClick} />
      <QuickContactLink href={mailLink} icon={Mail} label="Email" variant="toolbar" onClick={handleClick} />
    </>
  )
}
```

usato al posto dei due `QuickContactLink` diretti nel riquadro "Avvisa il cliente" (`orders/[id]/page.tsx`, righe 159-160) — il resto del riquadro (calcolo di `waLink`/`mailLink`, rispetto del canale "mail", il testo del messaggio) resta identico, cambia solo chi rende i due bottoni. Il click non blocca la navigazione (l'`<a>` apre comunque WhatsApp in nuova scheda / il client di posta): l'azione parte in parallelo, e `router.refresh()` aggiorna la UI (il riquadro sparisce, il badge "Msg PRONTO" nei Flags si accende) non appena risponde.

Il badge "Msg PRONTO" esistente (Flags, riquadro sola lettura) non cambia — riflette lo stesso campo, ora aggiornabile anche dal click oltre che da "Modifica".

## Cosa NON cambia

- **Nessuna migration**: `msg_pronto_inviato` esiste già.
- **Nessuna integrazione WhatsApp vera**: resta un link `wa.me`/`mailto` cliccato dall'utente, non un invio automatico via API — coerente con l'approccio "soluzione minima" già scelto per Recensioni/Da incassare. Il salto a un invio davvero automatico (senza click umano) richiederebbe l'API ufficiale WhatsApp Business (verifica Meta, numero dedicato, template pre-approvati, costo per conversazione) — scartato in fase di brainstorming: il problema reale era il passo umano che salta, non la mancanza di automazione vera, e questa soluzione lo risolve senza quel costo/complessità.
- **Nessun modo per "annullare"**: se il flag viene segnato per errore (es. click accidentale), si corregge da Modifica — stesso meccanismo già usato per ogni altra correzione in questo progetto.
- **Recensioni e Da incassare**: i loro `QuickContactLink` non passano `onClick`, nessun comportamento nuovo lì.

## Test

Nuovi unit test in `src/actions/__tests__/orders.test.ts` per `markMsgProntoInviato` (stesso stile dei test già presenti per `markPaymentReceived`): campo impostato a `true`, evento `msg_pronto_inviato` registrato, propagazione dell'errore se l'update fallisce. Nuovi test in `src/app/api/dashboard/today/__tests__/route.test.ts` per la sezione `daAvvisare` (ordine pronto+non avvisato incluso, ordine pronto+già avvisato escluso, ordine non pronto escluso).

Nessuna infrastruttura di test per pagine/componenti in questo codebase (stessa convenzione di `/pagamenti`/`/riepilogo`) — verificato manualmente con script Playwright temporaneo (stesso pattern delle feature precedenti, cancellato a verifica completata): ordine pronto compare in "Da avvisare"; click su WhatsApp/Email marca il flag e la card sparisce da "Da avvisare" senza aprire Modifica; ordine pronto senza telefono/email resta in "Da avvisare" senza riquadro visibile in scheda; nessuna regressione su Recensioni/Da incassare.
