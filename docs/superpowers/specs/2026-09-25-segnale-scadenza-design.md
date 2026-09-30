# Segnale visivo "in scadenza" sugli ordini

**Data**: 2026-09-25
**Stato**: approvato, pronto per il piano di implementazione

## Problema

Oggi l'app avvisa di una consegna solo quando è già tardi: `OrderCard` evidenzia soltanto gli ordini in ritardo (bordo terracotta, sfondo rosato, data rossa). Nulla segnala il giorno prima o il giorno stesso, quando si può ancora intervenire. In Bacheca le card mostrano solo la data in grigio, nemmeno il ritardo è evidenziato. L'utente ha proposto una "lampadina/lampeggiante" che attiri l'attenzione quando manca 1 giorno alla consegna (2026-09-24). Regola di prodotto: le priorità si devono leggere in meno di 30 secondi.

## Scelte dell'utente (brainstorming con mockup nel browser)

- **Scala a 3 livelli**, non solo "domani": Domani, Oggi, In ritardo.
- **Solo i giorni contano**, non lo stato di lavorazione: proposta di rendere il segnale più forte per gli ordini ancora indietro (preventivo/bozza/da fare) esplicitamente rifiutata.
- **Niente segnale "Domani"/"Oggi" sugli ordini già "Pronti"** (il lavoro è finito; per avvisare il cliente c'è "Da avvisare"). Il rosso del ritardo resta com'è oggi.
- **Aspetto**: card con sfondo colorato + un "pallino" luminoso senza scritte, che pulsa piano per Oggi e In ritardo; Domani resta fermo. Scartati: etichetta con testo dentro l'etichetta, striscia laterale, solo etichetta.
- **Solo tema chiaro**: l'app ha i colori scuri definiti in `globals.css` (`.dark`) ma nessuna parte li attiva mai, quindi resta sempre chiara anche con il tablet in modalità notte. L'utente ha escluso di ragionare sulla versione scura.
- **Nessuna nuova scheda in dashboard** ("non voglio una colonna ancora"): scartata la scheda "Da consegnare domani".
- Il segnale deve comparire "su tutte le schede".

## Contesto tecnico (letto dal codice attuale)

- `src/components/OrderCard.tsx` (lista ordini, server component): `overdue = isOverdue(data_consegna)`, classe `border-terracotta/40 bg-[#fdf0ef]` e data `text-terracotta font-semibold` se in ritardo e non consegnato. `isOverdue` (`src/lib/utils.ts`) usa `date-fns` sul fuso del server (UTC su Vercel).
- `src/components/KanbanBoard.tsx` (client): card con `formatDate(order.data_consegna)` in grigio, nessuna evidenziazione.
- `src/app/(dashboard)/orders/[id]/page.tsx`: intestazione con "Consegna prevista" + data.
- `src/components/TodayBoard.tsx`: `DashboardListCard` mostra righe `OrderSummary` (senza `status`/`data_consegna`); solo `todayOrders` ha `status` e `data_consegna`. La route `/api/dashboard/today` seleziona solo `id, cosa_ordinato, nome, cognome, azienda, referente` per `materialeDaOrdinare`, `daAvvisare`, ecc.
- Palette (`globals.css`): honey `#f8da9d`, gold `#e89b01`, terracotta `#f0624f`. `DESIGN.md`: terracotta = urgenza, honey = attivo; `bg-amber` riservato ai pulsanti primari (non usato qui).
- Le date `data_consegna` sono stringhe `YYYY-MM-DD` (colonna `date`).
- Jest gira con `testEnvironment: "node"`: solo la logica pura è testabile in automatico.

## Decisioni chiave

| Decisione | Motivazione |
|---|---|
| Funzione pura `deadlineLevel(dataConsegna, status, now)` in `src/lib/deadline.ts`, testata con TDD | Unica logica non banale della feature; usata da tutti i punti dove compare il segnale, così le regole stanno in un posto solo |
| Livelli: `"domani"` (mancano 1 giorno), `"oggi"` (0), `"ritardo"` (<0), altrimenti `null`. `consegnato` → sempre `null`. `pronto` → solo `"ritardo"` (mai domani/oggi). Nessuna data → `null` | Regola concordata: contano solo i giorni; pronto escluso da domani/oggi; il ritardo resta identico a oggi (vale anche per i pronti, come `isOverdue` attuale) |
| I giorni si contano confrontando date `YYYY-MM-DD`, con "oggi" calcolato in `Europe/Rome` (`Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" })`) | Il server gira in UTC: tra mezzanotte e l'1-2 di notte italiane un calcolo sul fuso del server sbaglierebbe giorno. Confrontare stringhe-data (via `Date.UTC`) evita ogni problema di fuso/ora legale. Sostituisce `isOverdue` nel solo `OrderCard`; `isOverdue`/`dueDateLabel` restano in `utils.ts` (non toccati) |
| Componente `DeadlineDot` (`src/components/DeadlineDot.tsx`), senza stato né hook, usabile da server e client component | Un solo pallino coerente ovunque. Riceve `level`, non rende nulla se `null`. Ha `role="img"` e `aria-label`/`title` ("Consegna domani" / "Consegna oggi" / "Consegna in ritardo") perché non ha testo visibile |
| Colori per livello (solo palette esistente): Domani = honey (card `bg-[#fef6e4]`, bordo `border-honey`, pallino honey); Oggi = gold (card `bg-[#fde7bd]`, bordo `border-gold`, pallino gold); In ritardo = terracotta (card `bg-[#fdf0ef]`, bordo `border-terracotta/40`, pallino terracotta) | Scala a intensità crescente coerente con i significati del design system (honey = attivo, terracotta = urgenza). Nessun colore nuovo, nessun `bg-amber` |
| Pallino: 12px con alone luminoso (`box-shadow`); Oggi e In ritardo pulsano lentamente (~2,2 s, ciclo dolce, non lampeggio secco); Domani fermo; `@media (prefers-reduced-motion: reduce)` disattiva la pulsazione | L'utente ha scelto la versione che "respira". Un lampeggio secco continuo su più card stancherebbe e peggiorerebbe la lettura delle priorità; l'opzione di sistema per ridurre le animazioni va rispettata. Keyframes e classi in `globals.css` (colore via variabile CSS per livello) |
| Dove compare: (1) `OrderCard` (lista ordini): card colorata + pallino a destra vicino ai badge, data rossa e in grassetto se ritardo (come oggi); (2) card di `KanbanBoard`: stesso trattamento, novità assoluta (oggi nemmeno il ritardo è evidenziato); (3) scheda ordine: pallino accanto alla data di consegna in intestazione; (4) dashboard: pallino (+ sfondo colorato) sulle righe di "Materiale da ordinare" e "Da avvisare" | "Su tutte le schede". In dashboard servono `status` e `data_consegna`: la route `/api/dashboard/today` li aggiunge alla select di `materialeDaOrdinare` e `daAvvisare` (le altre liste no) |
| Nessun segnale nella scheda dashboard "Da consegnare oggi", né in "Consegnati oggi" e "Materiale ordinato oggi" | In "Da consegnare oggi" tutte le righe sarebbero "Oggi" (rumore ridondante col titolo); le altre due mostrano lavoro già fatto |
| Nessuna migration, nessun nuovo server action, nessuna dipendenza npm | Solo presentazione e una select più ampia |

## File coinvolti

- **Create**: `src/lib/deadline.ts` (`DeadlineLevel`, `deadlineLevel`, `DEADLINE_LABELS`), `src/lib/__tests__/deadline.test.ts`, `src/components/DeadlineDot.tsx` (componente + classi card per livello).
- **Modify**: `src/app/globals.css` (keyframes/classi del pallino, reduced-motion), `src/components/OrderCard.tsx`, `src/components/KanbanBoard.tsx`, `src/app/(dashboard)/orders/[id]/page.tsx`, `src/components/TodayBoard.tsx`, `src/app/api/dashboard/today/route.ts` (e il relativo test se asserisce le select), `DESIGN.md` (nuova convenzione "segnale di scadenza").

## Casi limite

- `data_consegna` assente: nessun segnale.
- Ordine `consegnato`: nessun segnale, nemmeno il ritardo (come oggi).
- Ordine `pronto` con consegna domani/oggi: nessun segnale; `pronto` in ritardo: segnale rosso (come oggi).
- Stato sconosciuto/vuoto: trattato come non pronto e non consegnato (mostra il segnale).
- Cambio giorno a mezzanotte italiana: il livello cambia senza sfasamento di 1-2 ore.
- Tema scuro forzato dal browser del tablet: fuori scope, non gestito.

## Fuori scope

Scheda "Da consegnare domani" in dashboard (rifiutata dall'utente); soglie più larghe (2-3 giorni); tenere conto dello stato di lavorazione (rifiutato); scritta visibile nel pallino; notifiche/suoni; tema scuro; sostituzione/pulizia di `isOverdue`/`dueDateLabel` in `utils.ts`.

## Verifica

1. **Jest (TDD)** per `deadlineLevel` con `now` fissato: senza data; `consegnato` (anche in ritardo); domani/oggi/ritardo/lontano per un ordine in lavorazione; `pronto` (domani → null, oggi → null, ritardo → "ritardo"); confine di mese (30 set → 1 ott = domani); confine di fuso (ore 00:30 italiane con UTC ancora al giorno prima: oggi/domani calcolati sul giorno italiano).
2. **Playwright temporaneo** (stesso pattern delle feature precedenti, auth via `e2e/helpers/auth.ts`, ordini di prova creati/cancellati via service role, script cancellato a fine verifica, assenza di residui controllata con query indipendente): date calcolate rispetto a oggi in `Europe/Rome`. Verifica dei pallini (per `aria-label`) in lista ordini, Bacheca, scheda ordine e dashboard (riga "Materiale da ordinare"), ordini pronti/consegnati/lontani senza segnale, nessun pallino in "Da consegnare oggi".
3. Solo dopo la verifica reale si aggiorna `CLAUDE.md` con l'esito. Il "come appare davvero" (colori, pulsazione su tablet) resta da guardare dall'utente su un ordine vero.
