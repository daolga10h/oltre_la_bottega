# Sidebar semplificata e colori per stadio — design

**Data**: 2026-07-09
**Stato**: approvato, in attesa di piano di implementazione

Due modifiche di design indipendenti, discusse nella stessa sessione.

## Parte 1 — Sidebar semplificata

### Problema

Il sidebar mostra oggi un quadratino con le iniziali della bottega (es.
"OB"), il nome della bottega in grassetto, e sotto "Oltre la Bottega" in
piccolo. L'utente non gradisce il quadratino e preferisce mostrare
sempre e solo il testo fisso "Oltre la Bottega".

### Cosa NON facciamo

- Non tocchiamo login, etichetta di stampa, favicon — usano lo stesso
  quadratino ma restano invariati per ora (valutare a parte in futuro
  se serve).
- Non rimuoviamo `getShopName`/`lib/shop-name.ts` — restano usati altrove
  (WhatsApp/email nella scheda ordine, etichetta di stampa).

### Comportamento

In `src/components/nav/Sidebar.tsx`:
- Rimosso il div del quadratino (`w-6 h-6 rounded-md bg-espresso...`).
- Rimossa la riga con `{shopName}` in grassetto.
- Il testo "Oltre la Bottega" (oggi sottotitolo piccolo/opaco) diventa
  l'unica riga, nello stesso stile grassetto/dimensione che aveva prima
  il nome bottega (`font-bold text-[13px] tracking-tight text-foreground`).
- Rimossi di conseguenza `useState`/`useEffect`/`createClient`/
  `getShopName` dal componente (non più necessari lì) — il componente
  resta comunque un client component per `usePathname()`.

## Parte 2 — Colori per stadio (preventivo, bozza grafica, materiale)

### Problema

Tre sottostati indipendenti dell'ordine (`preventivo`, `bozza_grafica`,
`materiale`) hanno ciascuno 3-4 valori possibili che rappresentano uno
stadio di avanzamento (non ancora iniziato → in attesa → completato).
Oggi, sia nei bottoni rapidi della scheda ordine sia nei badge di
lista/bacheca, lo stadio attivo/presente usa **un solo colore fisso per
tutto il sottostato**, indipendentemente da quale dei valori sia
selezionato — quindi "appena iniziato" e "completato" sono visivamente
indistinguibili.

### Cosa NON facciamo

- Nessun colore nuovo: riusiamo terracotta/honey/sage, già nel design
  system con lo stesso significato semantico che hanno altrove
  (terracotta = urgenza/da fare, honey = stato attivo/in corso, sage =
  completato).
- Nessun badge "verde" nelle card di lista/bacheca per lo stadio
  completato di bozza/preventivo: quando bozza o preventivo vengono
  approvati, lo `status` principale dell'ordine avanza automaticamente
  (comportamento già esistente), quindi il badge sparisce da solo senza
  bisogno di gestire esplicitamente uno stadio verde lì.
- Il badge materiale segue lo stesso principio già esistente: nessun
  badge per lo stadio "arrivato" (comportamento invariato).

### Mappatura stadio → colore

| Sottostato | Valore | Stadio | Colore |
|---|---|---|---|
| preventivo | da_inviare | non iniziato | terracotta |
| preventivo | inviato | in attesa | honey |
| preventivo | approvato | completato | sage |
| bozza_grafica | da_fare | non iniziato | terracotta |
| bozza_grafica | inviata | in attesa | honey |
| bozza_grafica | modificata | in attesa | honey |
| bozza_grafica | approvata | completato | sage |
| materiale | da_ordinare | non iniziato | terracotta |
| materiale | ordinato | in attesa | honey |
| materiale | arrivato | completato | sage |

### Nuovo helper condiviso: `src/lib/orderConstants.ts`

Tre funzioni pure che mappano valore → stadio (`"red" | "yellow" |
"green" | null`), stesso stile di `computeOrderStatus`/`computeSaldo`
già presenti nel file:

```typescript
export type Stage = "red" | "yellow" | "green"

export function preventivoStage(value: string): Stage | null {
  if (value === "da_inviare") return "red"
  if (value === "inviato") return "yellow"
  if (value === "approvato") return "green"
  return null
}

export function bozzaStage(value: string): Stage | null {
  if (value === "da_fare") return "red"
  if (value === "inviata" || value === "modificata") return "yellow"
  if (value === "approvata") return "green"
  return null
}

export function materialeStage(value: string): Stage | null {
  if (value === "da_ordinare") return "red"
  if (value === "ordinato") return "yellow"
  if (value === "arrivato") return "green"
  return null
}
```

### Bottoni rapidi nella scheda ordine (`src/app/(dashboard)/orders/[id]/page.tsx`)

Per ciascuno dei tre gruppi di pill (preventivo, bozza grafica,
materiale), la classe del pill attivo non è più fissa ma dipende dallo
stadio del valore in questione:

```typescript
const PILL_STAGE_CLASSES: Record<Stage, string> = {
  red: "bg-terracotta/15 text-terracotta border-terracotta/30",
  yellow: "bg-honey text-bark border-gold/40",
  green: "bg-sage text-[#3a5a2e] border-sage",
}
```

Il pill attivo usa `PILL_STAGE_CLASSES[stageFn(v) ?? "yellow"]` al posto
del colore fisso attuale (`bg-espresso...`/`bg-sage...`/`bg-honey...`),
dove `stageFn` è `preventivoStage`/`bozzaStage`/`materialeStage` a
seconda del gruppo. Il pill inattivo resta invariato
(`bg-card text-foreground border-border hover:border-foreground/30`).

### Badge in lista (`src/components/OrderCard.tsx`) e bacheca (`src/components/KanbanBoard.tsx`)

Nuovo componente condiviso `StageBadge`, esportato da `OrderCard.tsx`
(che già esporta `StatusBadge`, importato da `KanbanBoard.tsx`):

```typescript
const BADGE_STAGE_CLASSES: Record<"red" | "yellow", string> = {
  red: "bg-terracotta/15 text-terracotta",
  yellow: "bg-honey text-bark",
}

export function StageBadge({
  label,
  tone,
}: {
  label: string
  tone: "red" | "yellow"
}) {
  return (
    <span className={cn(
      "inline-flex items-center text-xs px-1.5 py-0.5 rounded whitespace-nowrap",
      BADGE_STAGE_CLASSES[tone]
    )}>
      {label}
    </span>
  )
}
```

Nessuna icona (niente `Clock`/`Package`): solo testo su sfondo colorato,
su richiesta esplicita — le iconcine abbassavano la percezione qualitativa
delle card. Le icone `Clock`/`Package` restano importate nel file solo se
usate altrove (verificare in fase di implementazione se rimuovere
l'import diventa necessario per evitare un import inutilizzato).

Etichette per badge:

| Badge | Stadio rosso | Stadio giallo |
|---|---|---|
| materiale | "da ordinare" | "ordinato" |
| bozza/preventivo | "da fare" (bozza) / "da inviare" (preventivo) | "in attesa" |

**`OrderCard.tsx`** (vista Lista — oggi mostra solo il badge materiale):
aggiunto anche il badge bozza/preventivo, stessa logica di
visibilità già usata in `KanbanBoard.tsx` (mostrato solo quando
`order.status` è esattamente `"preventivo"` o `"bozza_grafica"`).

**`KanbanBoard.tsx`** (vista Bacheca — già mostra entrambi i badge):
badge esistenti aggiornati per usare `StageBadge` con tono ed etichetta
dinamici invece del colore/etichetta fissi attuali.

Entrambi i file calcolano il tono così (esempio per il badge
bozza/preventivo):

```typescript
const subStage =
  order.status === "preventivo" ? preventivoStage(order.preventivo)
  : order.status === "bozza_grafica" ? bozzaStage(order.bozza_grafica)
  : null
// mostra il badge solo se subStage è "red" o "yellow" (mai "green" o null)
```

## Testing

- Test unitari per `preventivoStage`/`bozzaStage`/`materialeStage` in
  `src/lib/orderConstants.ts` (nuovo file di test o aggiunta a un file
  esistente se già presente per questo modulo): ogni valore mappato al
  colore atteso, valori sconosciuti/`non_serve`/`non_inviare` → `null`.
- Verifica manuale: aprire un ordine con bozza "da fare" → pill "Da
  fare" nella scheda ordine è terracotta, non sage. Cambiarlo a
  "Inviata" → diventa honey. Cambiarlo a "Approvata" → diventa sage,
  badge sparisce da lista/bacheca (perché lo status avanza). Stesso giro
  per preventivo e materiale (per materiale, il badge sparisce solo
  quando "arrivato", non quando cambia lo status principale).
- Verifica manuale sidebar: nessun quadratino, nessun nome bottega,
  solo "Oltre la Bottega" in grassetto.
