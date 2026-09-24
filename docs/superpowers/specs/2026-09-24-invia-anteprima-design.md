# Messaggio pronto per l'invio dell'anteprima al cliente

**Data**: 2026-09-24
**Stato**: approvato, pronto per il piano di implementazione

## Problema

L'utente manda l'anteprima (bozza grafica) al cliente via WhatsApp/email 4-6 volte al giorno. Oggi deve cercare nella chat un messaggio già scritto in passato per riusarlo, invece di averne uno pronto che la porti subito alla chat del cliente giusto; poi allega a mano il PDF/screenshot e manda. Segnalata il 2026-09-24; frequenza confermata dall'utente (4-6 volte al giorno), quindi non un capriccio ma un'azione frequente vera — coerente con la regola guida di prodotto (massimo 3-4 passi per ogni azione frequente).

## Contesto tecnico (letto dal codice attuale)

- La scheda ordine (`src/app/(dashboard)/orders/[id]/page.tsx`) ha già un riquadro analogo, "Avvisa il cliente" (righe ~138-156): compare solo con `status === "pronto"` e `!msg_pronto_inviato`, costruisce `waLink` (`buildWhatsAppLink`, null se `canale === "mail"`) e `mailLink` (`buildMailtoLink`), e li passa al componente client `NotifyReadyLinks`, che al click chiama `markMsgProntoInviato(orderId)` e poi `router.refresh()`. Non renderizza nulla se mancano entrambi i link.
- I pulsanti della "Bozza grafica" (Da fare / Inviata / Modificata / Approvata) vivono nel blocco "Key info", visibili solo con `order.status === "bozza_grafica" && order.bozza_grafica !== "non_serve"`.
- `updateBozzaGrafica(id, value)` (`src/actions/orders.ts:251`) esiste già: aggiorna `orders.bozza_grafica`, per `"approvata"` porta anche lo status a `da_fare`, e scrive in `order_events` una riga `bozza_change` con nota `"Bozza inviata al cliente"` per `"inviata"` (`BOZZA_LABELS`). Nessun effetto collaterale sullo status per `"inviata"`.
- `QuickContactLink` (`src/components/QuickContactLink.tsx`) ha già un `onClick` opzionale, gestisce `target="_blank" rel="noopener noreferrer"` tramite il prop `external`.
- Nessuna infrastruttura di test per componenti/pagine in questo codebase (Jest `testEnvironment: "node"`), convenzione già seguita da `/pagamenti`, `/riepilogo`, `NotifyReadyLinks`.

## Decisioni chiave

| Decisione | Motivazione |
|---|---|
| Riquadro "Invia anteprima" in scheda ordine, stesso stile e posizione di "Avvisa il cliente" (sotto l'intestazione, sopra "Key info") | Stesso pattern già rodato e familiare; i due riquadri non coesistono mai (`status` diversi: `bozza_grafica` vs `pronto`), quindi la scheda resta pulita |
| Compare solo se `status === "bozza_grafica"` **e** `bozza_grafica` è `"da_fare"` o `"modificata"` | Sono i due momenti in cui c'è un'anteprima da mandare o rimandare; sparisce dopo l'invio (`"inviata"`), e ricompare da sola se la bozza torna `"modificata"`. Scelta esplicita dell'utente rispetto a un bottone sempre visibile (più flessibile ma occupa spazio anche quando non serve) |
| Al click su WhatsApp/Email la bozza passa automaticamente a `"inviata"` | Scelta esplicita dell'utente: un click in meno (oggi va comunque cliccato a mano il pill "Inviata"), su un'azione da 4-6 volte al giorno. Stesso meccanismo già usato per `msg_pronto_inviato`. Se l'utente clicca ma poi non manda davvero, basta un click sul pill per correggere |
| Testo unico e neutro per prima anteprima e versione modificata: "Buongiorno, ecco l'anteprima. Attendo i commenti o le modifiche da apportare." | Scelta esplicita dell'utente. Nessun nome cliente né dettaglio ordine, coerente con la scelta già fatta per "Avvisa il cliente" ("così rimane neutro, va bene per tutti"). Testo fisso nel codice, non modificabile da interfaccia (cambiare le parole = una richiesta di modifica, come già avvenuto per l'altro messaggio) |
| Rispetta il canale "mail": link WhatsApp assente se `canale === "mail"`, solo Email in quel caso | Regola già in vigore per tutte le altre comunicazioni (vedere CLAUDE.md, "Le comunicazioni rispettano il canale mail"). Se non c'è nessun contatto valido, il riquadro non viene renderizzato (stesso comportamento di "Avvisa il cliente") |
| Nuovo componente client `SendPreviewLinks` separato, senza unificare con `NotifyReadyLinks` | Con soli due usi la duplicazione (~25 righe) è minima e non conviene toccare un componente già verificato end-to-end. Una generalizzazione ha senso alla terza occorrenza — i messaggi "ordine in ritardo"/"promemoria pagamento" già in backlog |
| Nessuna migration, nessun nuovo server action, nessuna dipendenza npm | Riusa `updateBozzaGrafica`, `QuickContactLink`, `buildWhatsAppLink`, `buildMailtoLink` già esistenti |
| Il PDF/screenshot resta da allegare a mano | I link `wa.me`/`mailto:` non possono allegare file; è esattamente il flusso che l'utente ha descritto ("poi allego il pdf o screen e mando") |

## File coinvolti

- **Create**: `src/components/SendPreviewLinks.tsx` — componente client: due `QuickContactLink` (WhatsApp, Email) che al click chiamano `updateBozzaGrafica(orderId, "inviata")` e poi `router.refresh()`, stesso schema di `NotifyReadyLinks`.
- **Modify**: `src/app/(dashboard)/orders/[id]/page.tsx` — nuovo blocco condizionale sotto "Avvisa il cliente", con costante per il testo, calcolo di `waLink`/`mailLink` (oggetto email: "Anteprima") e render di `SendPreviewLinks`.

## Gestione errori

Se `updateBozzaGrafica` fallisse (es. rete), il link WhatsApp/mailto si è già aperto (il click naviga comunque), lo stato non si aggiorna e il riquadro resta visibile: l'utente può riprovare o cliccare il pill "Inviata" a mano. Nessun messaggio d'errore aggiuntivo — stessa scelta di `NotifyReadyLinks`.

## Fuori scope

- Bottone anche in dashboard "Oggi" o nelle liste/bacheca (es. sezione "Bozze da inviare") — valutabile in futuro se serve.
- Testo del messaggio modificabile da Impostazioni.
- Testi diversi per la prima anteprima e per la versione modificata (scelto un solo testo).
- Allegare automaticamente il file.

## Verifica

Nessuna infrastruttura di test automatico per componenti/pagine (convenzione del progetto). Verifica end-to-end con uno script Playwright temporaneo (stesso pattern delle feature precedenti, autenticato via `e2e/helpers/auth.ts`, cancellato a verifica completata), con ordini di prova creati/cancellati via client admin Supabase:

1. Ordine `status = "bozza_grafica"`, `bozza_grafica = "da_fare"`, con telefono+email: riquadro "Invia anteprima" visibile, href WhatsApp (`wa.me/...?text=`) ed Email (`mailto:`) corretti col testo atteso.
2. Click su Email: `bozza_grafica` diventa `"inviata"`, riquadro sparisce, evento "Bozza inviata al cliente" in cronologia.
3. Impostata la bozza a `"modificata"`: il riquadro ricompare.
4. Canale `"mail"` con telefono+email: solo il link Email.
5. Ordine con `bozza_grafica = "inviata"` o `status` diverso da `"bozza_grafica"`: nessun riquadro.

Solo dopo la verifica reale si aggiorna CLAUDE.md (riga in Decisioni chiave + bullet Testing) con l'esito.
