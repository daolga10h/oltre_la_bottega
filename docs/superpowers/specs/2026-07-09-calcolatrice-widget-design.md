# Calcolatrice al volo — design

**Data**: 2026-07-09
**Stato**: approvato, in attesa di piano di implementazione

## Problema

Durante la compilazione di un ordine (o in qualsiasi altro momento) può
servire fare un calcolo veloce (es. sommare più prezzi, calcolare uno
sconto) senza uscire dall'app per aprire la calcolatrice del telefono/PC.

## Cosa NON facciamo (scope esplicitamente escluso)

- Nessun collegamento ai campi del form (es. Prezzo/Acconto) — è uno
  strumento indipendente, il numero va scritto a mano dove serve.
- Nessuna cronologia dei calcoli salvata tra sessioni.
- Nessuna funzione scientifica, percentuale, memoria (M+/M-), o
  precedenza tra operatori — solo le 4 operazioni base, calcolo
  sequenziale come una calcolatrice tascabile fisica (es. `4 + 6 × 2`
  esegue 4+6=10 poi ×2=20, non 4+12=16).
- Nessuna persistenza del valore nel database — stato solo client-side,
  vive finché la pagina resta montata.

## Dove vive

Componente nuovo `src/components/CalculatorWidget.tsx` (client
component), montato una sola volta in `src/app/(dashboard)/layout.tsx`
(dentro il div principale, allo stesso livello di `Sidebar`/`BottomNav`).
Visibile su tutte le pagine sotto `(dashboard)` — Oggi, Ordini, Bacheca,
Agenda, Recensioni, Clienti. Non è montato su `(auth)/login` né su
`(print)/orders/[id]/print` (layout separati, non toccati da questo
lavoro).

## Comportamento

### Bottone

Cerchio flottante fisso in basso a sinistra, solo icona `Calculator`
(lucide-react — un disegno stilizzato di una calcolatrice), nessuna
etichetta testuale.
Posizione: `fixed left-4 z-50`, con offset verticale diverso su mobile per
non sovrapporsi a `BottomNav` (che è `fixed bottom-0` e visibile solo sotto
`md:`): `bottom-20 md:bottom-4` (20 = spazio sufficiente sopra la bottom
nav, che su mobile occupa circa 64px di altezza).

### Pannello

Al click sul bottone, si apre un pannello ancorato sopra di esso (non un
modale centrato): `absolute bottom-full left-0 mb-2`, dentro un contenitore
`relative` che avvolge bottone + pannello. Contiene:
- una riga di display (sola lettura) che mostra il valore corrente o il
  risultato dell'ultima operazione
- tastierino: cifre 0-9, punto decimale, operatori + − × ÷, tasto `=`,
  tasto `C` (cancella tutto)

Il pannello si chiude:
- cliccando il bottone una seconda volta (toggle)
- cliccando fuori dal pannello (stesso meccanismo già usato in
  `OrderForm.tsx` per chiudere i suggerimenti autocomplete: listener
  `mousedown` su `document` che verifica se il click è fuori da un `ref`
  sul contenitore)

Lo stato del calcolo (valore corrente, operatore in sospeso, ecc.) è
interno al componente e persiste mentre il pannello resta aperto o
richiuso senza smontare la pagina — si azzera solo premendo `C` o
ricaricando la pagina.

### Logica di calcolo

Modello "calcolatrice a operazione singola in sospeso", lo stesso usato
dalle calcolatrici tascabili:
- si tiene un valore corrente in display, un operatore in sospeso
  (nessuno all'inizio) e un valore precedente
- quando si preme un operatore (+ − × ÷): se c'è già un operatore in
  sospeso e un valore precedente, si esegue subito quell'operazione
  (valore precedente op valore corrente), si mostra il risultato, e
  quello diventa il nuovo valore precedente; poi si registra il nuovo
  operatore premuto
- quando si preme `=`: si esegue l'operazione in sospeso (se presente) e
  si azzera l'operatore in sospeso (permette di premere `=` più volte
  senza effetto se non si è inserito altro)
- la divisione per zero mostra `Errore` nel display invece di bloccare o
  lanciare eccezioni; premere `C` resetta

## Error handling

- Divisione per zero → mostra `Errore` nel display (stringa), nessun
  crash. Qualsiasi tasto dopo (numero o `C`) resetta lo stato normale.
- Nessun altro caso di errore applicabile (input solo da tastierino
  controllato, niente digitazione libera da tastiera fisica in questa
  versione).

## Testing

- Test unitari sulla funzione pura di calcolo (non sul componente React,
  per mantenere la logica testabile senza dover montare il DOM): estrarre
  la logica "applica operatore" in una funzione pura testabile
  (es. `applyOperator(a: number, op: Operator, b: number): number`,
  gestendo la divisione per zero restituendo `null` o lanciando, a
  discrezione dell'implementazione, purché il componente lo traduca in
  `Errore` nel display).
- Verifica manuale: aprire una pagina qualsiasi sotto `/dashboard`,
  cliccare il bottone in basso a sinistra, verificare che il pannello si
  apra sopra il bottone; provare una sequenza tipo `12 + 8 =` → mostra
  `20`; provare `5 ÷ 0 =` → mostra `Errore`; cliccare fuori dal pannello
  → si chiude; su mobile (viewport stretto), verificare che il bottone non
  si sovrapponga alla bottom nav.
