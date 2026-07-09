# Rimuovi voce Quantità dal riquadro pagamento — design

**Data**: 2026-07-09
**Stato**: approvato, in attesa di piano di implementazione

## Problema

Il riquadro "Pagamento" (form ordine e scheda ordine) mostra un box "Qtà"
accanto a Prezzo/Acconto/Saldo. Il campo confonde: il Saldo non tiene conto
della quantità (è sempre `prezzo - acconto`, indipendentemente dal valore in
Qtà), quindi inserire "4 pz a 6€" non porta il totale a 24€ come ci si
aspetterebbe — resta 6€. L'utente lo trova fuorviante più che utile.

## Cosa NON facciamo (scope esplicitamente escluso)

- Nessuna gestione multi-riga/multi-oggetto per ordine (più oggetti diversi
  con prezzi diversi nello stesso ordine) — idea reale e frequente emersa
  durante la discussione, ma è una feature a sé che richiede una nuova
  architettura (righe ordine, subtotali) e va progettata separatamente in
  un secondo momento.
- Nessuna migration: la colonna `quantita` resta nello schema del database,
  invariata — stesso trattamento già riservato alla tabella
  `inventory_items` quando fu rimossa la UI Inventario (2026-07-04): il
  dato resta silenzioso nel DB, riutilizzabile in futuro se si costruirà il
  multi-riga.
- Nessuna modifica ad altre pagine: `quantita` non compare in card
  lista/bacheca, dashboard "Oggi", etichetta di stampa (verificato via
  ricerca nel codice) — quindi non c'è altro da toccare.

## Modello dati

Nessuna modifica. La colonna `quantita` (default 1) resta su `orders`,
semplicemente non più letta né scritta da UI.

## Comportamento

### Form ordine (`src/components/OrderForm.tsx`)

Il riquadro "Pagamento" passa da 4 a 3 colonne (Prezzo / Acconto / Saldo).
Il campo `quantita` non viene più inviato nel payload di submit.

### Scheda ordine (`src/app/(dashboard)/orders/[id]/page.tsx`)

Il riquadro pagamento passa da 4 a 3 colonne (Prezzo / Acconto / Saldo),
stesso adeguamento di stile del form.

## Error handling

Nessun caso nuovo — è una rimozione, non un'aggiunta di logica.

## Testing

- Verifica manuale: aprire `/orders/new` e un ordine esistente in
  `/orders/[id]` e `/orders/[id]/edit` → il riquadro pagamento mostra solo
  Prezzo, Acconto, Saldo, senza spazi vuoti o disallineamenti nel grid.
- `npx tsc --noEmit` pulito (nessun test unitario esistente copre
  `quantita`, quindi non ne servono di nuovi da aggiornare).
