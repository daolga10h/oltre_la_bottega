# Materiali: magazzino (carico e correzioni) — Design (Lavoro 1 di 3)

Data: 2026-10-25

## Contesto

Il listino costi (`/materiali`) è in produzione dal 2026-10-24: ogni materiale ha prezzo attuale/precedente, si riempie
leggendo i documenti dei fornitori. La titolare vuole anche sapere **quanti pezzi ha in magazzino** di alcuni prodotti
rivenduti uno a uno (timbri autoinchiostranti, penne, portachiavi, portasoldi, supporti in vetro, quadri), non di tutti
i materiali (non le targhe, gli astucci, il plexi, la gomma per i timbri).

L'obiettivo completo si costruisce in tre lavori, ciascuno utile da solo:

1. **Magazzino** (questo documento): giacenza caricata dalle fatture, correzione a mano, protezione dai caricamenti doppi,
   scorta minima con avviso «Da riordinare» e «Ho già ordinato».
2. **Ordini che scalano il magazzino**: campo «Materiale» nella riga ordine con ricerca, pezzo tolto da «Da fare» in poi,
   costo copiato nella riga (margine per ordine).
3. **Riepilogo di fine anno**: pezzi venduti, incasso e costo per materiale in magazzino.

Il Lavoro 1 non tocca gli ordini: la giacenza qui è solo quanto caricato più le correzioni.

## Decisioni prese (con l'utente)

| Tema | Decisione |
|---|---|
| Quali materiali | Solo quelli con l'opzione **«Tieni in magazzino»**, spenta di default. Gli altri non hanno giacenza |
| Come si calcola | La giacenza **non è un contatore**: `giacenza = carico_totale + rettifica − venduto`. Nel Lavoro 1 `venduto` vale 0 (lo porterà il Lavoro 2), così una modifica o una cancellazione d'ordine si riallinea da sola |
| Carico | Dalla tabella di controllo: per le righe in magazzino una colonna **«Carica»** con la quantità letta dal documento, modificabile |
| Caricamenti doppi | **L'app se ne accorge.** Ricorda in modo invisibile i documenti già caricati (solo un'impronta, nessun dato leggibile, nessuna tabella da consultare). Se il documento è già stato caricato avvisa e non somma le quantità, salvo conferma esplicita. I prezzi si aggiornano comunque (sono idempotenti) |
| Correzione | **«Correggi giacenza»**: si scrive quanti ne ha davvero e l'app calcola la rettifica. Serve anche per il valore iniziale della prima volta |
| Unità | Si conta nell'unità del documento (pezzi); nessuna conversione tra unità |
| Scorta minima | Campo facoltativo per ogni materiale in magazzino. Quando la giacenza è **uguale o inferiore** alla scorta minima il materiale è «Da riordinare». Senza scorta minima nessun avviso |
| Dove compare l'avviso | Nell'elenco Materiali (tabella e schede) **e** nella pagina «Oggi», in una sezione «Da riordinare» |
| «Ho già ordinato» | Segna la data. Per **7 giorni** l'avviso rosso è sospeso e al suo posto compare «Ordinato il 25/10 – in attesa» (nell'elenco; in «Oggi» il materiale sparisce dalla sezione). Dopo 7 giorni senza un carico l'avviso **riparte da solo** («Ordinato da 7 giorni, non è arrivato»). Caricando una quantità per quel materiale la data si cancella |
| Fuori scope | Scarico dagli ordini (Lavoro 2), riepilogo (Lavoro 3), materiali con unità diverse, distinte (cornice + vetro), notifiche fuori dall'app |

## Dati

Migration `supabase/migrations/20261025000001_add_magazzino.sql`:

- `materiali.in_magazzino boolean not null default false`
- `materiali.carico_totale numeric(12,3) not null default 0`
- `materiali.rettifica numeric(12,3) not null default 0`
- `materiali.soglia numeric(12,3)` (scorta minima, nullable, `check (soglia >= 0)`)
- `materiali.ordinato_il date` (nullable: quando è stato segnato «Ho già ordinato»)
- Nuova tabella `documenti_caricati (id uuid pk, impronta text not null unique, created_at timestamptz default now())`, RLS
  `auth.uid() is not null`. Contiene solo l'impronta; non è mostrata da nessuna parte.

Se si spegne «Tieni in magazzino» i valori restano salvati ma non si mostrano; se si riaccende ricompaiono.
Eliminando un materiale si elimina anche la sua giacenza.

La migration va applicata su Supabase **prima** del deploy (vedere la lezione della colonna `terzi_ditta`).

## Funzioni pure (TDD) — `src/lib/materiali.ts` e `src/lib/documentoFornitore.ts`

- `computeStock({ carico_totale, rettifica }, venduto = 0): number` → `carico_totale + rettifica − venduto`.
  Il parametro `venduto` serve già al Lavoro 2.
- `rettificaPerGiacenza(reale, { carico_totale }, venduto = 0): number` → la rettifica che porta la giacenza a `reale`
  (`reale − carico_totale + venduto`).
- `GIORNI_ATTESA_ORDINE = 7` e `reorderStatus({ in_magazzino, soglia, ordinato_il }, giacenza, oggi): "ok" | "da_riordinare" | "ordinato"
  | "ordinato_scaduto"`:
  - `ok` se non è in magazzino, se non ha scorta minima o se `giacenza > soglia`;
  - altrimenti, senza `ordinato_il` → `da_riordinare`;
  - con `ordinato_il` entro 7 giorni (`oggi − ordinato_il < 7`) → `ordinato`; da 7 giorni in poi → `ordinato_scaduto`
    (si tratta come `da_riordinare`, con la scritta «Ordinato da 7 giorni, non è arrivato»).
  - I giorni si contano sul calendario di Roma (`todayIso`).
- `documentFingerprint(documento): string` → SHA-256 esadecimale di fornitore normalizzato + data + righe ordinate
  (`codice|nome|quantità|prezzo|importo`, con `normalizeText` e numeri a 3 decimali). Stesso documento letto due volte dà la
  stessa impronta anche se l'ordine delle righe cambia. Si calcola sul documento **così come letto**, non sulle correzioni
  dell'utente, per non sfuggire al controllo modificando una riga.

## Lettura e salvataggio

- `extractDocument` calcola l'impronta e controlla `documenti_caricati`: restituisce `impronta` e `giaCaricato: boolean`
  insieme al documento.
- `saveMaterials` riceve per ogni riga `magazzino: boolean` e `carica: number | null`, e a livello di documento
  `impronta?: string` e `caricaComunque?: boolean`.
  - `in_magazzino` del materiale = valore della casella (l'ultima scelta vale).
  - Le quantità si sommano a `carico_totale` solo se `magazzino` è vero, `carica > 0` e il documento non è già
    stato caricato (o `caricaComunque`).
  - Quando una riga somma davvero una quantità a un materiale, `ordinato_il` torna a `null`.
  - Il risultato include `quantitaSaltate: boolean` per dire all'utente che il documento era già caricato.
  - **Ordine delle operazioni** (per non sommare due volte nemmeno rilanciando dopo un errore): (1) se ci sono quantità
    da sommare, si registra prima l'impronta; il vincolo di unicità la rende un'operazione atomica e, se l'impronta
    esiste già, le quantità si saltano; (2) si scrivono i materiali; (3) se la scrittura fallisce, si **toglie
    l'impronta** appena registrata, così il tentativo successivo parte pulito. I prezzi restano idempotenti.
- Nuova azione `setStock(id, reale)`: legge il materiale, calcola `rettificaPerGiacenza` e salva la rettifica.
- `updateMaterial` accetta anche `in_magazzino` e `soglia` (scorta minima, vuota = nessuna).
- Nuova azione `markOrdered(id)`: imposta `ordinato_il` a oggi (calendario di Roma). Si può rilanciare per rinnovare i 7 giorni.
- Una funzione sul server `getStockOverview()` restituisce i materiali in magazzino con `giacenza` e `reorderStatus`; la usano
  l'elenco Materiali e la pagina «Oggi». Il Lavoro 2 le passerà il `venduto` calcolato dagli ordini senza cambiare i chiamanti.

## Schermate

- **Tabella di controllo** (`MaterialiImport.tsx`): colonna **«Magazzino»** con una casella per riga (precompilata con
  lo stato del materiale se esiste già, altrimenti spenta) e colonna **«Carica»** (quantità letta, modificabile, visibile
  solo con la casella accesa). Se `giaCaricato`, un avviso in alto «Questo documento sembra già caricato: le quantità non
  verranno sommate» con la casella «Carica comunque le quantità».
- **Elenco Materiali** (tabella e schede): per i materiali in magazzino compare **«In magazzino: N»**, in terracotta se è
  zero o negativo (un negativo indica vendite non caricate o un conteggio da correggere).
- **Modifica materiale** (`MaterialeRowActions.tsx`): casella «Tieni in magazzino», campo «Giacenza attuale» (se compilato e
  diverso dal calcolato chiama `setStock`) e campo «Scorta minima».
- **Avviso «Da riordinare»**: nell'elenco (tabella e schede) un'etichetta in terracotta accanto a «In magazzino: N» con il
  pulsante **«Ho già ordinato»**; nello stato `ordinato` al suo posto una nota neutra «Ordinato il 25/10 – in attesa»;
  nello stato `ordinato_scaduto` l'etichetta «Ordinato da 7 giorni, non è arrivato» con lo stesso pulsante.
- **Pagina «Oggi»**: nuova sezione **«Da riordinare»** (solo livello completo) con i materiali in stato `da_riordinare` o
  `ordinato_scaduto`: nome, fornitore, «In magazzino: N (minimo M)» e il pulsante «Ho già ordinato». Si aggiunge una lista
  `daRiordinare` alla risposta di `/api/dashboard/today` e si mostra con il componente già usato per le altre sezioni
  (`DashboardListCard`). Un materiale `ordinato` (entro i 7 giorni) non compare.

## Errori

- Impronta già presente: non è un errore, è l'avviso descritto sopra.
- Quantità non valida o negativa nella colonna «Carica»: la riga è segnalata come non valida, come già per prezzo e sconti.
- `setStock` con un valore non numerico o negativo: rifiutato con il messaggio di validazione.

## Test

- Jest: `reorderStatus` (nessuna scorta minima, sopra e sotto soglia, uguale alla soglia, ordinato da 0/6/7/8 giorni, giorno di
  Roma a cavallo della mezzanotte), `markOrdered`, azzeramento di `ordinato_il` al carico, lista `daRiordinare` della route
  Oggi, `computeStock`, `rettificaPerGiacenza`, `documentFingerprint` (stabile all'ordine delle righe, diversa se cambia
  una quantità), `saveMaterials` (carico su materiale nuovo e esistente, documento già caricato, `caricaComunque`,
  casella spenta, quantità zero), `setStock`.
- Prova reale con un documento vero (la fattura Trodat): caricare, accendere «Magazzino» sui 4 timbri, salvare, vedere
  «In magazzino: 50 / 50 / 25 / 25», ricaricare lo stesso PDF e vedere l'avviso senza somma, correggere a mano un valore.
  Script Playwright temporaneo con righe di prova cancellate a fine verifica.
- I dati veri già nel database (4 righe FB Targhe, Elijte, Munari, Trodat) restano come sono: la giacenza parte da zero
  e si imposta solo per i materiali scelti.
