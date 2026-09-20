# Dettatura vocale per campi di testo libero

**Data**: 2026-09-20
**Stato**: approvato, pronto per il piano di implementazione

## Problema

Alcuni campi di testo libero dell'app vengono compilati al banco, spesso con le mani occupate o mentre si parla col cliente: descrivere cosa scrivere/incidere su un articolo, annotare una nota interna, o segnare al volo un promemoria mentre si sta lavorando a qualcos'altro. Digitare in queste situazioni è più lento e scomodo che dettare.

Idea segnalata dall'utente il 2026-09-20, senza dettagli iniziali su campo/i, trascrizione vs allegato audio, o costo di un eventuale servizio di riconoscimento vocale.

## Decisioni chiave

| Decisione | Motivazione |
|---|---|
| Trascrizione automatica in testo, non allegato audio | L'utente vuole che il testo dettato appaia scritto nel campo, come una dettatura vocale su smartphone — non un file audio da riascoltare dopo |
| Web Speech API del browser (`SpeechRecognition`/`webkitSpeechRecognition`), non un servizio cloud a pagamento | Stessa dettatura integrata già usata da Chrome/Edge (es. Google Docs), costo zero, nessun backend nuovo — coerente con la filosofia cost-conscious del progetto (vedere altre decisioni in CLAUDE.md: link WhatsApp invece di API, export CSV manuale invece di automazione). L'audio viene inviato brevemente ai server di Google per la trascrizione senza essere salvato — l'utente ha confermato esplicitamente che va bene, stesso livello di privacy di una dettatura vocale su smartphone |
| Tre campi in scope: "Note interne" e "Testo da scrivere" (riga articolo) in `OrderForm.tsx`, "Cosa ricordare…" in `ReminderForm.tsx` | I tre campi dove si cattura un pensiero/istruzione al volo mentre si lavora. Esclusi "Dettagli grafici" (scelta esplicita dell'utente, non tra i campi indicati) e "Cosa manca" — materiale fornitore (tipicamente 2-3 parole, dettarlo non farebbe risparmiare tempo reale) |
| Componente condiviso `VoiceDictationButton`, non tre implementazioni separate | Stesso principio già applicato a `QuickContactLink` in questo progetto — evitare di duplicare la stessa logica (avvio/stop ascolto, gestione errori, feature detection) in tre punti diversi |
| Click per iniziare/fermare l'ascolto, nessun rilevamento automatico del silenzio | Più affidabile del rilevamento automatico in un ambiente con rumore di sottofondo (bottega, clienti che parlano) — l'utente controlla esplicitamente quando la dettatura finisce |
| Il testo dettato si accoda al contenuto esistente del campo, non lo sostituisce mai | Comportamento scelto esplicitamente dall'utente — utile per aggiungere un dettaglio senza perdere quanto già scritto |
| Lingua fissa `it-IT` | Unica lingua usata nell'app e dagli utenti |
| Pulsante assente (non disabilitato, non visibile) se il browser non supporta l'API | Stesso trattamento già riservato ad altre funzionalità non supportate in questo progetto — nessun messaggio d'errore per una funzione che semplicemente non esiste su quel browser (es. Firefox) |

## Componente: `VoiceDictationButton`

Nuovo componente client React, riusato nei tre punti sopra.

**Props**: `onTranscript: (text: string) => void` — chiamata con il testo riconosciuto quando la dettatura produce un risultato. Il chiamante decide come accodarlo al proprio state (stesso pattern già usato da `QuickContactLink` con `onClick` opzionale).

**Stato interno**:
- `idle` — pulsante microfono normale, cliccabile
- `listening` — sta ascoltando (stile visivo distinto, es. icona rossa/pulsante), click per fermare
- Feature detection al mount: se `window.SpeechRecognition`/`window.webkitSpeechRecognition` non esiste, il componente non renderizza nulla (`return null`)

**Gestione errori**:
- Permesso microfono negato (evento `onerror` con `error === "not-allowed"`) → messaggio inline breve sotto il pulsante ("Permesso microfono negato"), pulsante torna a `idle`
- Nessun parlato riconosciuto (`no-speech`) o altro errore non bloccante → pulsante torna semplicemente a `idle`, nessun messaggio

## Integrazione

- **`OrderForm.tsx`**, campo "Note interne" (riga ~591): `VoiceDictationButton` accanto al `Textarea` esistente, `onTranscript` accoda al valore controllato dallo stesso state già usato dal campo.
- **`OrderForm.tsx`**, "Testo da scrivere" per riga articolo (dentro il loop `items`, riga ~417-423): un `VoiceDictationButton` per riga, `onTranscript` chiama `updateItem(item.id, "testoDaScrivere", nuovoValore)` accodando al testo esistente di quella riga.
- **`ReminderForm.tsx`**, campo "Cosa ricordare…" (`Input`, riga ~24-27): `VoiceDictationButton` accanto all'`Input`, stesso comportamento di accodamento.

Nessuna migration, nessun nuovo server action, nessuna dipendenza npm — solo un componente client che usa un'API già integrata nel browser.

## Fuori scope

- Campo "Dettagli grafici" (`OrderForm.tsx`) — escluso su scelta esplicita dell'utente.
- Campo "Cosa manca" — materiale fornitore (`OrderForm.tsx`) — valutato e scartato, testo troppo breve per beneficiare della dettatura.
- Allegato audio grezzo (senza trascrizione) — idea iniziale scartata in favore della trascrizione automatica.
- Servizio cloud di trascrizione a pagamento (es. Whisper API) — scartato: costo ricorrente e complessità di backend non giustificati quando l'alternativa gratuita del browser è già accettabile per l'utente.

## Verifica

Nessuna infrastruttura di test automatico per componenti in questo codebase (stessa convenzione già usata per `/pagamenti`, `/riepilogo`, `QuickContactLink`). Verifica manuale su Chrome desktop e su un tablet Android (stessi dispositivi già usati per verificare la stampa etichetta), confermando: dettatura funzionante e testo accodato correttamente nei tre campi, pulsante assente su un browser non supportato (es. Firefox, se disponibile per il test), messaggio corretto quando il permesso microfono viene negato.
