# Materiali con lettura automatica dei documenti del fornitore — Design

Data: 2026-10-24

## Problema

Il prezzo di acquisto dei materiali non è scritto da nessuna parte: arriva sui documenti dei fornitori (PDF sul PC, fatture o DDT cartacei) e si perde. Senza quei prezzi non si può né controllare i rincari né, in futuro, costruire preventivi a partire dal costo.

Riscrivere i documenti a mano è la fatica da evitare. L'idea è caricare un PDF o una foto e far leggere le righe in automatico, con un controllo umano prima di salvare.

## Decisioni prese (con l'utente)

| Tema | Decisione |
|---|---|
| Dove | Dentro Oltre la Bottega, nuova pagina "Materiali", solo livello **completo** (nuova funzione `materiali` in `plan.ts`, spenta nel base) |
| Cos'è | Un **listino costi** che si aggiorna da solo leggendo i documenti, non un inventario: nessun carico/scarico, nessuna giacenza |
| Chi paga l'API | Per ora **solo la bottega dell'utente**, con la sua chiave (`ANTHROPIC_API_KEY`). Se in futuro il prodotto sarà venduto ad altre botteghe si sceglierà tra chiave per installazione e chiave unica con limite; la variabile d'ambiente rende il passaggio indolore |
| File dopo la lettura | **Si scarta.** Niente Supabase Storage, nessun archivio |
| Tabella acquisti | **Non serve.** Niente numero documento, niente quantità/totali salvati |
| Abbinamento | Per **fornitore + codice articolo**; se il codice manca, per nome (senza maiuscole/spazi) |
| Prezzi | Senza IVA, 3 decimali (come in fattura, es. 14,380) |
| Storico | Un solo passo indietro: Prezzo attuale / Prezzo precedente, ciascuno con la propria data di acquisto |
| Inserimento a mano | Sì: stessa tabella di controllo, vuota |
| Preventivi | **Fuori scope** di questo giro; si valuteranno quando l'elenco avrà dati veri |

## Dati

Nuova migration `supabase/migrations/20261024000001_add_materiali.sql`.

Tabella `materiali`:
- `id`, `fornitore` (not null), `codice` (nullable), `nome` (not null), `unita` (nullable, es. "Nr.")
- `prezzo_attuale` numeric(12,3) not null, `data_acquisto_attuale` date not null
- `prezzo_precedente` numeric(12,3) nullable, `data_acquisto_precedente` date nullable
- `created_at`, `updated_at`
- Indice univoco su (`fornitore`, `codice`) dove `codice` non è nullo. Indice di ricerca su `nome`
- RLS abilitata, policy `auth.uid() is not null` come le altre tabelle

La migration va applicata su Supabase **prima** del deploy del codice (vedere la lezione della colonna `terzi_ditta`).

## Regole di calcolo (funzioni pure, TDD) — `src/lib/materiali.ts`

- **`matchMaterial(esistenti, riga)`**: stesso fornitore + stesso codice; senza codice, stesso nome normalizzato (minuscolo, spazi compattati). Fornitore confrontato allo stesso modo.
- **`applyPriceUpdate(materiale, { prezzo, data })`**:
  - prezzo uguale all'attuale: nessuna modifica (il precedente resta com'è; la data attuale si aggiorna solo se la nuova è più recente);
  - prezzo diverso e data più recente (o uguale) dell'attuale: l'attuale diventa precedente, il nuovo diventa attuale;
  - data più vecchia dell'attuale: l'attuale non si tocca; il prezzo entra come precedente solo se la sua data è più recente del precedente già presente (o se non c'è un precedente).
- **`checkRow({ quantita, prezzo, importo })`**: `true` se quantità × prezzo coincide con l'importo entro 0,01; `true` anche quando mancano quantità o importo (nulla da controllare).
- **`priceVariation(attuale, precedente)`**: percentuale con segno, `null` se manca il precedente o è zero.

Il confronto tra righe lette e materiali esistenti produce l'etichetta mostrata nella tabella di controllo: *Nuovo*, *Invariato*, *Variato (era X)*.

## Lettura del documento

Server action `extractDocument(formData)` in `src/actions/materiali.ts`:
- Verifica che l'utente sia autenticato e che `ANTHROPIC_API_KEY` esista.
- Accetta PDF o immagine (jpeg/png/webp), con limite di dimensione; rifiuta altro.
- Invia il file a Claude (SDK `@anthropic-ai/sdk`, unica dipendenza nuova) con uno schema fisso: `fornitore`, `data` (ISO), `righe[]` con `codice`, `nome`, `unita`, `quantita`, `prezzo`, `importo`.
- Modello letto da `MATERIALI_MODEL` (default un modello con visione, es. `claude-sonnet-5-5`).
- Non salva nulla: restituisce i dati alla tabella di controllo. `maxDuration` portato a 60 s sulla pagina.

Nel browser la foto viene ridotta (lato lungo ~1800 px, JPEG ~0,8) prima dell'invio, perché le foto da telefono (3–8 MB) superano il limite di 4,5 MB delle richieste Vercel. I PDF passano invariati (se superano il limite, messaggio chiaro).

## Salvataggio

Server action `saveMaterials({ fornitore, data, righe })`:
- Per ogni riga confermata: `matchMaterial` poi `applyPriceUpdate` (aggiorna) oppure inserisce un materiale nuovo.
- Non è una transazione unica (il client Supabase non la offre: un inserimento e un aggiornamento in blocco), ma è **idempotente**: se una delle due chiamate fallisce, rilanciare lo stesso salvataggio dà "Invariato" per ciò che è già scritto e completa il resto.
- `revalidatePath("/materiali")`.

Modifica manuale dall'elenco: **correzione diretta** di nome, unità, prezzo attuale e prezzo precedente di un singolo materiale (non registra un acquisto: nessuna logica di storico), più cancellazione.

## Schermata

Pagina `src/app/(dashboard)/materiali/page.tsx`, solo livello completo (nel base `notFound()`, come `/pagamenti`), nuova voce di menu solo in `Sidebar.tsx` (tablet/PC). La bottom nav del telefono ha già 8 voci e non cambia.

- **Elenco** con ricerca: Fornitore, Materiale, Prezzo attuale (con freccia ↑↓ e %), Data acquisto attuale, Prezzo precedente, Data acquisto precedente.
- Due bottoni: **Carica documento** e **Aggiungi a mano**.
- **Tabella di controllo** (componente client): fornitore e data in alto, valide per tutto il documento; una riga per articolo con codice, nome, unità e prezzo modificabili; stato per riga (*Nuovo* / *Invariato* / *Variato* / *Non torna* in giallo); righe eliminabili; "Conferma" salva. In inserimento a mano parte vuota con "aggiungi riga".
- Colori solo dalla palette esistente (terracotta per rincari, sage per ribassi, honey per attenzione).

## Errori

- Chiave mancante, errore dell'API o timeout: messaggio chiaro e tabella vuota per l'inserimento a mano.
- File non supportato o troppo grande: rifiutato prima dell'invio.
- Nessuna riga riconosciuta: stesso trattamento, con proposta di inserire a mano.

## Test

- Jest: `materiali.test.ts` (abbinamento, aggiornamento prezzo incluse le date fuori ordine, controllo riga, variazione); test di `saveMaterials` con mock di Supabase; test della validazione di `extractDocument` (tipo file, chiave mancante) con l'SDK mockato.
- Prova reale con la fattura FB Targhe già letta in conversazione (4 righe, prezzi con 3 decimali, foto ruotata di 90°). **Il file non entra nel repository**: contiene codice fiscale e indirizzo e il repo è pubblico.
- Playwright temporaneo (non permanente) per il flusso carica → controlla → conferma, con righe di prova cancellate a fine test.

## Fuori scope

Giacenze e soglie, carico/scarico, archivio dei file, tabella acquisti/storico completo, grafico dei prezzi, preventivi, fatture elettroniche XML (possibile estensione: per i fornitori che le forniscono, lettura esatta senza AI), chiave API per cliente o a canone.
