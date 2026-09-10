# Design: niente recensione per gli ordini ente

Data: 2026-09-10

## Motivazione

Un ente/azienda (`is_ente: true`, vedi `docs/superpowers/specs/2026-09-09-clienti-ente-referente-design.md`) non ha senso nel flusso "chiedi la recensione" — non è una persona privata che lascia una recensione Google della bottega. Oggi i tre toggle "Chiedere recensione" / "Recensione richiesta" / "Recensione ricevuta" sono disponibili e modificabili a mano per qualunque ordine, indipendentemente da `is_ente`.

## Cosa cambia

### Form ordine (`OrderForm.tsx`)

Nella sezione "Note" (visibile solo in modifica, riga 593-605), i tre toggle della pipeline recensione (`chiedereRec`, `recRichiesta`, `recRicevuta`) non compaiono quando `isEnte` è true — resta solo "Msg PRONTO inviato" (cosa diversa: notifica che l'oggetto è pronto per il ritiro, valida per qualunque cliente, ente incluso).

### Payload di salvataggio

`chiedere_recensione`, `recensione_richiesta`, `recensione_ricevuta` vengono forzati a `false` quando `isEnte` è true, indipendentemente dal valore rimasto nello state React — stesso meccanismo di sicurezza già usato per `cognome`/`azienda` quando si attiva "È un ente" (vedere `docs/superpowers/specs/2026-09-09-clienti-ente-referente-design.md`, sezione Form ordine). Necessario perché lo state di questi tre toggle non si azzera automaticamente solo perché il toggle è nascosto — se un ordine privato con `chiedere_recensione: true` viene convertito in ente durante una modifica, il salvataggio deve comunque scrivere `false`.

## Cosa NON cambia

- **Nessuna migration**: nessun nuovo campo, nessuna modifica di schema.
- **Pagina "Recensioni"** (`/recensioni`) e **pallini riepilogativi in scheda ordine** (sezione "Flags", `orders/[id]/page.tsx`): nessuna modifica di codice necessaria. Il filtro esistente della pagina Recensioni (`chiedere_recensione && !recensione_ricevuta`) e la resa condizionale dei pallini già non mostrano nulla quando questi campi sono `false` — dato che il payload li forza sempre a `false` per un ente, un ordine ente non comparirà mai in quella pagina né in quei pallini, senza bisogno di un filtro `is_ente` separato.
- **"Msg PRONTO inviato"**, **consenso marketing (GDPR)**: restano invariati e disponibili per qualunque cliente, ente incluso — non fanno parte della pipeline recensione.
- **Ordini ente già esistenti**: nessun problema. La sezione "Note" con questi toggle esiste solo in modifica, non in creazione — un ordine ente creato dopo l'introduzione della feature ente/referente (2026-09-09) ha quindi già `chiedere_recensione`/`recensione_richiesta`/`recensione_ricevuta` a `false` per costruzione, prima ancora di questa modifica.

## Test

- Nessuna infrastruttura di test per componenti in questo codebase (stessa convenzione già seguita per il resto di `OrderForm.tsx`) — verificato manualmente nel browser: modificare un ordine ente esistente, controllare che i tre toggle non compaiano; modificare un ordine privato, controllare che compaiano come oggi; convertire un ordine privato con "Chiedere recensione" già attivo in ente e salvare, controllare che il valore salvato sia `false`.

## Fuori scope

- Nessuna modifica al comportamento per `consenso_marketing` — non richiesto, resta un campo GDPR indipendente dalla pipeline recensione.
- Nessun filtro `is_ente` aggiunto alla pagina Recensioni — la conseguenza automatica del forzare `false` al salvataggio è già sufficiente, aggiungerlo sarebbe ridondante.
