# Design: riepilogo stampabile di tutti i lavori

Data: 2026-09-11

## Motivazione

Ogni tanto serve poter sfogliare o stampare su carta un elenco di tutti i lavori in corso, con lo stato di ciascuno — un riferimento fisico da consultare senza dover navigare nell'app. Oggi non esiste: l'unica stampa disponibile è l'etichetta di un singolo ordine (`(print)/orders/[id]/print`).

## Nuova pagina `/riepilogo`

**Ordini mostrati**: solo gli attivi, stessa definizione già usata per la lista Ordini (`preventivo`, `bozza_grafica`, `da_fare`, `in_lavorazione`, `pronto` — non `consegnato`). Recuperati con `getOrders({ activeOnly: true })`, che ordina già per `data_consegna` crescente di default.

**Struttura**: raggruppato per stato, una sezione per ogni valore di `STATUS_ORDER` (escluso `consegnato`, stesso ordine già usato in `KanbanBoard.tsx`: Preventivo → Bozza grafica → Da fare → In lavorazione → Pronto). Dentro ogni sezione gli ordini restano ordinati per data di consegna (l'ordinamento arriva già così da `getOrders`, si filtra soltanto per stato — stesso pattern di `KanbanBoard.tsx`). Una sezione vuota non compare.

**Colonne per ogni ordine**: Cliente (`buildClientDisplayName(nome, cognome, azienda)` + riga "Ref. {referente}" se presente, stessa convenzione delle altre viste), Cosa ordinato, Telefono, Data di consegna, Saldo (`€{formatEUR(saldo)}`). Nessun colore/badge di sottostato (preventivo/bozza/materiale) — la sezione per stato è già l'evidenziazione richiesta, aggiungere altro sarebbe ridondante rispetto alla richiesta originale.

**Intestazione della pagina**: nome bottega (`getShopName`) + "Riepilogo lavori" + data di generazione — compare anche sulla stampa, dato che il logo/nome nella sidebar sarà nascosto (vedi sotto).

**Bottone "Stampa"**: in alto, avvia `window.print()` (client component). Nessuna dimensione di carta forzata — a differenza dell'etichetta termica, qui vale il dialogo di stampa standard del browser con le impostazioni scelte dall'utente (foglio, orientamento, ecc.).

**Paginazione automatica**: se l'elenco non entra su un solo foglio, il browser prosegue su altri fogli automaticamente, come per qualunque documento lungo — nessuna logica da scrivere per questo. Aggiunta solo una regola CSS (`break-inside: avoid` sulle righe) per evitare che una riga venga tagliata a metà tra un foglio e il successivo.

## Voce di menu "Riepilogo"

In `Sidebar.tsx` (sezione "Gestione") e in `BottomNav.tsx` (che passa da 7 a 8 voci), stessa posizione relativa delle altre voci di gestione, dopo "Da incassare".

## Nascondere il resto dell'app quando si stampa

Oggi stampare una qualunque pagina dell'app stamperebbe anche sidebar, barra di ricerca in alto, barra in basso e il bottone della calcolatrice — tutto ciò che è "attorno" al contenuto, non solo il contenuto stesso. Per evitarlo, `(dashboard)/layout.tsx` guadagna la classe Tailwind `print:hidden` su `Sidebar`, sull'header (barra di ricerca + bottone aggiorna), su `BottomNav` e su `CalculatorWidget`. Effetto: da qualunque pagina della dashboard, stampare mostra solo il contenuto della pagina — non solo da `/riepilogo`, ma ovunque (nessuna pagina della dashboard ha oggi un motivo per voler stampare anche il menu). A schermo non cambia nulla: la regola si attiva solo in stampa.

## Cosa NON cambia

- **Nessuna migration, nessun nuovo server action**: riusa `getOrders` esistente.
- **Nessun filtro per data/periodo**: mostra sempre tutti gli attivi, come la lista Ordini.
- **Nessun badge di sottostato** (preventivo/bozza/materiale): la sezione per stato è l'unica evidenziazione, per restare fedele alla richiesta originale ("evidenziando in che stato si trova") senza aggiungere complessità non richiesta.
- **La pagina `(print)/orders/[id]/print`** (etichetta termica) resta invariata e indipendente — dimensioni/uso completamente diversi.

## Test

Nessuna infrastruttura di test per pagine in questo codebase (stessa convenzione di `/recensioni` e `/pagamenti`) — verificato manualmente: elenco raggruppato correttamente per stato nell'ordine previsto, ordinamento per data dentro ogni sezione, ordine ente mostra "Ref.", sezioni vuote non compaiono, il bottone "Stampa" apre il dialogo di stampa del browser, l'anteprima di stampa non mostra sidebar/barra di ricerca/barra in basso/calcolatrice su questa pagina né su un'altra pagina qualsiasi della dashboard, una lista lunga a sufficienza da superare un foglio prosegue correttamente sul foglio successivo senza tagliare righe a metà.

## Fuori scope

- Filtri per periodo/data, esportazione PDF/CSV di questo riepilogo, stampa automatica/pianificata: nessuna richiesta in questo senso.
