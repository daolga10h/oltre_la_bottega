# Cognome e data consegna obbligatori nel form ordine — design

**Data**: 2026-07-09
**Stato**: approvato, in attesa di piano di implementazione

## Problema

Attualmente `cognome` e `data_consegna` sono campi opzionali nel form ordine
(`src/components/OrderForm.tsx`). Si è deciso che vanno resi obbligatori per
garantire dati più completi su ogni nuovo ordine.

## Cosa NON facciamo (scope esplicitamente escluso)

- Nessun vincolo `NOT NULL` a livello di database — stesso precedente già
  usato per `telefono` (commit `399ea0d`, "fix: rendi obbligatorio il
  telefono cliente nel form ordine"): validazione solo lato form.
- Nessuna migrazione dei dati esistenti — gli ordini già creati senza
  cognome o data consegna restano validi e continuano a comparire
  normalmente in lista, bacheca, scheda ordine e dashboard, finché non
  vengono modificati.
- Nessuna modifica alle query esistenti che già gestiscono `data_consegna`
  come eventualmente nullo (dashboard "Oggi", calcolo ritardo `isOverdue`,
  link "Aggiungi data consegna" nella scheda ordine per gli ordini vecchi).

## Modello dati

Nessuna modifica. `cognome` e `data_consegna` restano colonne nullable su
`orders`.

## Comportamento

### Form ordine (creazione e modifica)

In `src/components/OrderForm.tsx`, stessa sezione "Cliente" già esistente:

- Campo **Cognome**: aggiunto l'attributo `required` sull'`<Input
  id="cognome" ...>` e l'asterisco nell'etichetta (`Cognome *`), stesso
  trattamento già usato per `nome`/`telefono`/`cosa_ordinato`.
- Campo **Data consegna**: aggiunto l'attributo `required` sull'`<Input
  id="data_consegna" type="date" ...>` e l'asterisco nell'etichetta (`Data
  consegna *`).

Il browser blocca il submit del form finché entrambi i campi non sono
compilati, stesso meccanismo nativo HTML già usato per gli altri campi
obbligatori (nessun JavaScript aggiuntivo).

### Ordini esistenti

Nessun impatto. Gli ordini creati prima di questa modifica che non hanno
cognome o data consegna restano validi: non c'è un vincolo a database che
li invaliderebbe, e la UI che già gestisce l'assenza di questi valori
(es. il link "Aggiungi data consegna" nella scheda ordine quando
`order.data_consegna` è null) continua a funzionare invariata.

## Error handling

Nessun caso nuovo da gestire — la validazione `required` è nativa del
browser, non richiede gestione lato server oltre a quella già esistente.

## Testing

- Verifica manuale: aprire `/orders/new`, provare a inviare il form senza
  cognome o senza data consegna → il browser blocca l'invio e mostra
  l'indicazione nativa del campo obbligatorio mancante.
- Verifica manuale: aprire un ordine esistente senza cognome/data consegna
  (se presente in dati di test) → la scheda ordine e la modifica
  continuano a funzionare senza errori.
- Nessun test unitario nuovo necessario: `required` è un attributo HTML,
  non logica applicativa testabile a livello di server action.
