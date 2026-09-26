# Livello base dell'app — design

Data: 2026-09-26
Stato: approvato in conversazione, da rileggere prima del piano di implementazione.

## Scopo

Offrire una versione più semplice dell'app ("livello base") per botteghe che non sono la mia: stesso prodotto, meno cose da imparare, altrettanto forte rispetto ai concorrenti (Danea e simili). La versione completa resta quella in uso nella mia bottega.

## Come nasce (PEP del target)

Tre bisogni del target, dal documento "PEP - Oltre la bottega":

1. **Controllo del lavoro** — vedere subito cosa richiede attenzione. È il motivo per cui si compra l'app.
2. **Semplicità dello strumento** — niente menu e campi da ufficio, registrare un lavoro in pochi passaggi. Toglie la paura di non saperla usare.
3. **Valore dello storico clienti** — chi ritorna, recensioni. Il vantaggio cresce col tempo.

**Promessa del livello base:** "Apri l'app e sai cosa fare oggi." Lo storico clienti è il valore che si accumula da solo inserendo ordini.

**Scartato:** puntare sulla "registrazione veloce di un ordine". Tutti i concorrenti lo promettono, quindi non differenzia; deve funzionare bene ma non è la storia da raccontare.

**Clienti tipo:** sia chi lavora da solo sia chi è in 2-3 persone. Lo strumento è lo stesso (un login, una dashboard condivisa); non servono funzioni diverse.

## Cosa contiene il livello base

**Menu (5 voci):** Oggi, Ordini (lista e bacheca insieme), Agenda, Clienti, Recensioni.

**Oggi:** da consegnare oggi, consegnati oggi, da avvisare, promemoria del giorno. Nessuna sezione sul materiale del fornitore.

**Ordine:**
- Stati: Preventivo → Da fare → In lavorazione → Pronto → Consegnato. Il preventivo è facoltativo, come oggi (si sceglie alla creazione dell'ordine); senza preventivo l'ordine parte da Da fare. Manca solo la Bozza grafica.
- Preventivo con i suoi sottostati (da inviare, inviato, approvato) e avanzamento automatico a Da fare quando viene approvato.
- Una sola riga articolo.
- Campi obbligatori: nome, cognome, telefono, cosa ordinato, data di consegna.
- Campi facoltativi: prezzo, acconto, note. Il saldo si calcola da solo.
- Assenti: operatore, ente/azienda con referente, materiale del fornitore, bozza grafica.

**Scheda ordine:**
- Riquadro "Avvisa il cliente" con WhatsApp o email, che rispetta il canale "mail".
- Bottone "Segna come pagato".
- Stampa **solo come foglio lavoro** per stampante normale: QR code, elenco articoli e "Da pagare", caratteri grandi, su mezzo foglio A4 (formato A5 orizzontale, nella metà superiore del foglio). Si allega alla busta o al lavoro. Non serve nessuna stampante speciale. L'etichetta termica da 62 mm non fa parte del livello base (resta nel completo).
- Nessun riquadro "Invia anteprima".

**Recensioni:** richiesta recensione via WhatsApp o email, come oggi.

**Altre funzioni incluse (già pronte, nessuna voce di menu in più):** dettatura vocale, ricerca globale.

**Sicurezza:** backup automatico via email e copia tecnica giornaliera (risposta a "sapere che i dati sono recuperabili").

**Fuori dal livello base (livelli superiori):** ordini multi-riga, ente/referente, materiale del fornitore, bozza grafica e anteprima, "Da incassare", Riepilogo stampabile, campo operatore, etichetta termica da 62 mm, calcolatrice.

Il **livello di mezzo** non è definito: si decide dopo i primi clienti veri. Per ora esistono solo "base" e "completo".

## Stampa: foglio lavoro

La pagina di stampa esistente (`(print)/orders/[id]/print`) accetta un parametro di formato (`?formato=foglio`; assente = etichetta come oggi).

- **Livello completo:** la scheda ordine ha due bottoni, "Stampa etichetta" (termica, invariata) e "Stampa foglio lavoro".
- **Livello base:** un solo bottone, "Stampa foglio lavoro". La pagina di stampa mostra sempre il foglio lavoro, anche se si apre l'indirizzo dell'etichetta a mano; la funzione `etichetta_termica` è spenta in `plan.ts`.

Il foglio riusa gli stessi dati dell'etichetta e lo stesso QR verso la scheda ordine; cambiano solo dimensioni e layout. Nessuna migration, nessun nuovo server action.

## Come si realizza

**Un solo codice, un interruttore per installazione.** Ogni cliente ha la propria istanza (single-tenant), quindi il livello si sceglie con una variabile d'ambiente, ad esempio `PLAN=base` oppure `PLAN=completo`. Nessun fork.

- Nuovo file `src/lib/plan.ts`: funzione pura che, dato il livello, dice quali funzioni sono attive (`hasFeature("materiale")`). Tutte le regole stanno lì.
- Se la variabile manca o ha un valore non riconosciuto, l'app parte in **completo** (la mia installazione non deve rompersi).
- Sidebar e bottom nav nascondono le voci che non fanno parte del livello.
- `OrderForm` mostra solo i campi del livello e una sola riga articolo.
- `TodayBoard` e `/api/dashboard/today` saltano le sezioni del materiale.
- Le pagine fuori livello (`/pagamenti`, `/riepilogo`, sezione operatori in Impostazioni) rispondono 404 se aperte a mano.
- Lo stato Bozza grafica e il suo sottostato non compaiono in nessun selettore, colonna della bacheca o badge nel livello base. Preventivo resta attivo.
- I componenti non conoscono i livelli: chiedono solo se una funzione è attiva.

**Il database non cambia.** Un ordine base usa le stesse tabelle, con una sola riga in `order_items`. Passare al livello superiore = cambiare la variabile e rifare il deploy, senza migrazioni e senza perdere dati.

**Perché non un ramo separato:** i bug fix arrivano a tutti insieme (promessa del canone), non ci sono due app da mantenere, l'upgrade è immediato.

**Rischio noto:** i controlli sul livello si sparpagliano in più file (soprattutto `OrderForm`). Si contiene tenendo tutta la logica in `plan.ts` e testandola.

## Verifica

1. **Test unitari Jest** su `plan.ts`: ogni livello espone le funzioni giuste; variabile mancante o non valida → completo.
2. **Prova reale con Playwright** su un'istanza avviata con `PLAN=base` (utente di test, ordini creati e poi cancellati via service role, come nei flussi già esistenti): menu a 5 voci, form con soli campi del livello, ordine con preventivo portato da "Preventivo" fino a "Consegnato", ordine senza preventivo, foglio lavoro raggiungibile con i dati giusti e senza bottone etichetta, indirizzo dell'etichetta che mostra comunque il foglio, pagine fuori livello → 404.
3. **Nessuna regressione sul completo:** con `PLAN=completo` (o variabile assente) l'app è identica a oggi. Suite Jest esistente verde, `npx tsc --noEmit` pulito, flussi E2E A-D invariati.

## Ordine di lavoro

1. `plan.ts` con i suoi test.
2. Menu e pagine fuori livello.
3. Form ordine e schermata Oggi.
4. Prova reale e verifica di non regressione.

## Fuori scope (ora)

- Definizione del livello di mezzo.
- Segnale "lavori fermi da N giorni" (primo miglioramento da provare con i clienti pilota, dopo la validazione).
- Cambio di livello da dentro l'app (per ora si cambia la variabile su Vercel).
- Più etichette per foglio (griglia) e stampa su formati diversi da A4.
- Funnel di distribuzione, demo online con dati finti, sito vetrina: progetti separati (vedere `2026-09-24-sito-vetrina-design.md`).
- Prezzi e canone: già discussi a parte (setup una tantum + canone), non fanno parte di questo lavoro.
