# Design: ordini consegnati in attesa di pagamento

Data: 2026-09-10

## Motivazione

Alcuni ordini non si chiudono davvero con la consegna — restano da incassare. Oggi il modello non distingue questo caso: `status: "consegnato"` è il passo finale del flusso principale, e una volta consegnato un ordine sparisce dalla vista principale (Ordini, Bacheca) a meno che non debba ancora chiedere una recensione. Il pagamento (`prezzo`/`acconto`/`saldo`) è solo un dato mostrato in scheda, non un segnale che si nota da qualche parte se resta a zero.

## Come si individua un ordine "da incassare"

Nessun campo nuovo, nessuna migration. Un ordine è "da incassare" quando:
- `status === "consegnato"`
- `saldo > 0` (campo già esistente, calcolato in `OrderForm.tsx` come `prezzo - acconto` e salvato a ogni modifica dell'ordine)

Derivato al volo dalla query, non salvato da nessuna parte — sempre coerente col saldo reale. Un ordine sparisce da questo elenco da solo non appena, modificandolo, il saldo torna a zero (stesso meccanismo già in uso per "Recensioni": un campo che torna `false`/`0` fa sparire l'ordine dall'elenco senza bisogno di un'azione dedicata "rimuovi da qui").

## Nuova pagina `/pagamenti`

Stessa struttura già rodata di `/recensioni` (`src/app/(dashboard)/recensioni/page.tsx`): una tabella, niente stato client-side, azioni via server action + `revalidatePath`.

**Query:** `getOrders({ status: "consegnato" })`, poi filtro in memoria su `saldo > 0` (stesso pattern di Recensioni, che filtra `chiedere_recensione && !recensione_ricevuta` dopo la stessa chiamata).

**Ordinamento:** dai consegnati più vecchi ai più recenti (`data_consegnato` crescente) — chi aspetta il saldo da più tempo compare in alto, per dare priorità a chi solleciti prima.

**Colonne della tabella:**
- **Cliente**: link alla scheda ordine, tramite `buildClientDisplayName(nome, cognome, azienda)`; se `referente` è presente, riga "Ref. {referente}" sotto, stesso trattamento già in uso in tutte le altre viste (card, bacheca, ricerca, ecc.)
- **Data consegnato**: `formatDate(order.data_consegnato)` — la data di consegna *effettiva*, non quella prevista, per capire da quanto tempo il saldo è in sospeso
- **Saldo da incassare**: `formatEUR(order.saldo)`
- **Azioni**: bottone "Chiedi su WhatsApp" (link `wa.me` precompilato via `buildWhatsAppLink`, stesso meccanismo di Recensioni — nessuna integrazione/costo aggiuntivo) con testo `Ciao {nome}! Qui è {shopName} 🙂 Ti ricordiamo che il saldo di €{saldo} per il tuo ordine è ancora da saldare. Grazie!`; link "Scheda" per apire l'ordine e registrare il pagamento da lì (via "Modifica", aggiornando l'acconto)

**Stato vuoto:** "Nessun pagamento in sospeso." quando non ci sono ordini da mostrare.

**Niente menu di cambio stato** in questa pagina — l'ordine è già nello stato finale, non ha senso spostarlo da qui.

## Voce di menu "Da incassare"

Aggiunta sia in `Sidebar.tsx` (sezione "Gestione", dopo "Recensioni") sia in `BottomNav.tsx` (che passa da 6 a 7 voci) — a differenza di "Impostazioni" (solo sidebar), questa pagina si consulta anche da tablet/mobile in bottega, come già "Recensioni".

- **Etichetta**: "Da incassare" (breve, adatta alla barra in basso; linguaggio naturale da negozio)
- **Titolo pagina**: "In attesa di pagamento" (più descrittivo, spazio non è un vincolo dentro la pagina)
- **Icona**: `Euro` di `lucide-react` (stessa libreria delle altre icone di menu, nessuna già in uso ha un significato legato ai pagamenti)
- **Nessun contatore/numero** sulla voce di menu — si consulta quando serve, non deve richiamare l'attenzione ogni volta

## Cosa NON cambia

- **Nessuna migration**: `saldo` esiste già, nessun nuovo campo.
- **Bacheca**: nessuna modifica. Prima idea scartata: una sesta colonna in Bacheca per questi ordini — scartata perché la Bacheca è pensata per il flusso di lavorazione attivo, non per un controllo periodico, e avrebbe reso le colonne più strette senza un beneficio reale.
- **Ordini/Dashboard "Oggi"**: nessuna modifica — gli ordini consegnati restano fuori da queste viste come oggi.
- **Nessun campo per "chiudere" un ordine indipendentemente dal saldo**: se il saldo scritto è zero, l'ordine è considerato pagato per definizione — nessun override manuale.

## Fuori scope

- **Redesign della navigazione** (spostare il menu laterale in una barra orizzontale in alto): idea emersa durante la discussione per liberare spazio in Bacheca, ma è un cambiamento che toccherebbe tutte le pagine dell'app — trattato come spunto separato in backlog, non parte di questo lavoro.
- **Promemoria automatici** (email/notifica quando un ordine resta da incassare per troppo tempo): nessuna richiesta in questo senso, resta un controllo manuale come per le recensioni.

## Test

Nessuna infrastruttura di test per pagine/componenti in questo codebase (stessa convenzione già seguita per `/recensioni`) — verificato manualmente nel browser: creare un ordine, segnarlo consegnato con saldo residuo, controllare che compaia in `/pagamenti`; modificarlo per azzerare il saldo, controllare che sparisca; verificare ordinamento con più ordini a date diverse; verificare che un ordine ente mostri "Ref." se presente; verificare che un ordine consegnato con saldo zero non compaia mai.
