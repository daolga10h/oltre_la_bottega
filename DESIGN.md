# Design System — Oltre la Bottega

> Kraft paper ledger under amber desk lamp. Ogni schermata deve sembrare l'apertura di un quaderno contabile ben organizzato: carta cream, inchiostro espresso, un solo colore di evidenziazione caldo.

---

## Identità visiva

Il design si ispira a un **registro finanziario artigianale**: superfici neutre e calde come carta, testo scuro come inchiostro, un solo accento cromatico (oro ambra) riservato alle azioni primarie. Niente freddo digitale — tutto caldo, leggibile, professionale.

---

## Colori

| Nome | Hex | Token Tailwind | Uso |
|---|---|---|---|
| Cream Canvas | `#f8f7f5` | `bg-cream` / `bg-background` | Sfondo pagina principale |
| Pure Paper | `#ffffff` | `bg-card` | Superfici card, pannelli |
| Linen Border | `#e3dfd5` | `bg-linen` / `border-border` | Bordi, separatori, stato nav attivo |
| Stone Mist | `#d5d2cd` | `bg-stone` | Bordi secondari |
| Warm Ash | `#aca89f` | `text-warm-ash` | Label sezioni nav, placeholder |
| Driftwood | `#8f897e` | `text-driftwood` / `text-muted-foreground` | Testo secondario, metadata |
| Bark | `#61594a` | `text-bark` | Corpo testo, descrizioni ordini |
| Espresso | `#3b2716` | `text-espresso` / `text-foreground` | Titoli, testo principale, bottone primario |
| Amber Signal | `#f9a600` | `bg-amber` | Solo CTA primario (`variant="amber"`) |
| Burnished Gold | `#e89b01` | `bg-gold` / `text-gold` | Accento sidebar, saldo, striscia KPI oggi |
| Terracotta | `#f0624f` | `text-terracotta` / `bg-terracotta` | Errori, "In ritardo", stati urgenti |
| Sage | `#c8dab8` | `bg-sage` / `text-[#3a5a2e]` | Badge "Bozza grafica", stato attivo "Approvata", "Consegnati oggi" |
| Honey Wash | `#f8da9d` | `bg-honey` | Badge stati attivi (pronto, da_fare, in_lavorazione), toggle ON |

### Regole cromatiche

- **Un solo colore cromatico per bottone primario**: solo `bg-espresso` (azione principale) o `bg-amber` (variante alternativa). Mai altri colori pieni.
- **Mai il nero puro `#000000`**: usare sempre `#3b2716` (espresso) per testo e icone.
- **Niente blu o viola come colori interfaccia**: usare honey/sage/linen per badge stati, terracotta per errori/urgenze. Il verde salvia (sage) è l'unica eccezione cromatica, riservato a "bozza grafica" e agli stati di completamento (approvato, consegnato).
- **Ombre sempre con tinta calda**: `rgba(59,39,22,0.06)` mai grigi freddi.

---

## Tipografia

**Font**: Inter (Google Fonts) — sostituto di Interphases Pro Variable.

| Ruolo | Size | Weight | Letter-spacing |
|---|---|---|---|
| Caption / label sezione | 11–12px | 600 | `tracking-widest` (0.7px) uppercase |
| Body small | 13–14px | 400 | -0.14px |
| Body | 15–16px | 400–500 | -0.16px |
| Titolo pagina | 32px | 700 | `-0.61px` (`tracking-tight`) |
| Numero KPI | 34px | 700 | tight |

---

## Raggi e forme

| Elemento | Valore | Classe |
|---|---|---|
| Card / pannello | 8px | `rounded-lg` |
| Bottoni | 8px | `rounded-lg` |
| Badge / tag stato | 4px | `rounded` |
| Input | 8px | `rounded-lg` |
| Status stepper pill | 100px | `rounded-full` |
| Logo mark | 6px | `rounded-md` |

**Niente forme completamente circolari** eccetto per i dot (●) e pill indicatori di stato, e il bottone flottante della Calcolatrice (vedere "Componenti chiave").

---

## Ombre

```css
/* Card standard */
box-shadow: rgba(59,39,22,0.06) 0px 4px 8px 0px;

/* Bottone primario */
box-shadow: inset 0px 1px 2px rgba(255,255,255,0.18),
            0px 2px 6px rgba(59,39,22,0.32),
            0px 1px 2px rgba(59,39,22,0.12);
```

---

## Componenti chiave

### Bottone primario
```tsx
<Button variant="default">Salva</Button>
// bg-espresso, text-cream, shadow calda warm-brown
```

### Badge stato ordine
| Status | Classe |
|---|---|
| preventivo | `bg-linen text-bark` |
| bozza_grafica | `bg-sage text-[#3a5a2e]` |
| da_fare | `bg-honey text-bark` |
| in_lavorazione | `bg-honey text-bark` |
| pronto | `bg-honey text-bark` |
| consegnato | `bg-linen text-muted-foreground` |

### KPI Card
- Sfondo `bg-card`, bordo `border-border`
- Numero 34px bold espresso
- Label 11px uppercase tracking-widest driftwood
- **Striscia top**: `bg-terracotta` per "In ritardo", `bg-gold` per "Consegne oggi", niente per le altre

### Sidebar
- Sfondo `bg-card` (paper white)
- Striscia ambra orizzontale in cima: `bg-gradient-to-r from-gold to-amber`
- Logo mark 24×24px `bg-espresso text-cream rounded-md`
- Link attivo: `bg-muted` + barra verticale `bg-gold` a sinistra (3px)
- Label sezioni: 10px uppercase tracking-widest `text-warm-ash`

### Logo mark "OB" — riutilizzo
Lo stesso marchio (quadrato espresso, testo cream "OB") va ripetuto ovunque il brand deve comparire, per coerenza:
- Sidebar (24×24px)
- Login page (32×32px, con striscia ambra sopra la card)
- Favicon — generato dinamicamente in `src/app/icon.tsx` via `next/og` `ImageResponse` (nessun file binario da mantenere)
- Etichetta di stampa — versione bianco/nero 14×14px per compatibilità stampante termica monocromatica

### Righe liste (Oggi, Agenda)
- Sfondo `bg-background` (cream), bordo-radius `rounded-lg`, padding `px-4 py-3`
- Hover: `hover:bg-muted/60`
- Freccia › a destra `text-muted-foreground/50`

### Valore in box (Prezzo, Acconto, Saldo)
- Ogni valore in un box separato: `border border-border bg-card rounded-lg px-3 py-3 text-center`, ombra standard
- Numero `text-base font-semibold` (non `text-lg font-bold` — risulta più elegante e meno "urlato")
- Label sopra `text-xs text-muted-foreground`
- Importi sempre con 2 decimali (`formatEUR` da `lib/utils.ts`), mai numeri interi grezzi
- Non aggiungere un box "Qtà": rimosso il 2026-07-09 perché il Saldo non l'ha mai moltiplicata (resta sempre `prezzo - acconto`), risultava fuorviante

### Bottone flottante + pannello (Calcolatrice)
- Unico caso d'uso di forma completamente circolare in tutta l'interfaccia (eccezione esplicita alla regola generale, vedere "Cosa NON fare"): `rounded-full h-12 w-12 bg-espresso text-cream`, icona centrata, nessun testo
- Posizione fissa `fixed left-4 bottom-20 md:bottom-4 z-50` — offset maggiore su mobile per non sovrapporsi a `BottomNav`
- Il pannello si apre ancorato sopra il bottone (`absolute bottom-full left-0 mb-2`), mai come modale centrato con overlay scuro
- Tasti operatore nel pannello: `bg-honey text-bark` (stesso token dei badge stato attivo), tasto azione principale (`=`): `bg-espresso text-cream`, tasto distruttivo (`C`): `bg-destructive/10 text-destructive`

### Menu a tendina (Select)
- Usare sempre `@/components/ui/select` (basato su `@base-ui/react/select`), **mai** l'elemento `<select>` nativo
- Motivo: il popup nativo del `<select>` browser ignora il font-family della pagina su alcune combinazioni OS/browser, mostrando un font di sistema (serif) invece di Inter — bug non risolvibile via CSS
- Quando valore e etichetta differiscono (es. `da_fare` → "Da fare"), passare sempre la prop `items` (array `{value,label}` o `Record<string,string>`): senza `items`, `<SelectValue>` mostra il valore grezzo invece dell'etichetta

### Campi form (Input, Textarea, Select trigger)
- Sfondo sempre `bg-card` (bianco), **mai** `bg-transparent`: su pagina `bg-background` (cream) un campo trasparente si confonde con lo sfondo e non si capisce dove si scrive
- `Label` ha sempre `mb-1.5` (respiro tra etichetta e campo) — eccezione: label inline accanto a una checkbox usa `mb-0` (sono affiancate, non impilate)
- Campi a digitazione libera che non devono suggerire valori precedenti (es. "Cosa ordinato", "Testo da scrivere"): `autoComplete="off"`

---

## Token CSS (globals.css)

```css
:root {
  --background: #f8f7f5;    /* cream canvas */
  --foreground: #3b2716;    /* espresso */
  --card: #ffffff;          /* pure paper */
  --primary: #3b2716;       /* espresso button */
  --primary-foreground: #f8f7f5;
  --muted: #f8f7f5;
  --muted-foreground: #8f897e;  /* driftwood */
  --border: #e3dfd5;        /* linen */
  --ring: #e89b01;          /* gold focus */
  --radius: 0.5rem;         /* 8px base */
}
```

### Token brand disponibili come utility Tailwind
`bg-cream`, `bg-linen`, `bg-honey`, `bg-sage`, `bg-amber`, `bg-gold`, `bg-terracotta`
`text-espresso`, `text-bark`, `text-driftwood`, `text-warm-ash`, `text-gold`, `text-terracotta`

---

## Cosa NON fare

- ❌ Non usare `blue-*`, `purple-*` come colori interfaccia decorativi (eccetto `sage` per bozza/stati completati)
- ❌ Non usare `#000000` per testo — sempre `text-foreground` (`#3b2716`)
- ❌ Non usare `slate-*` — rimpiazzare con `muted-foreground`, `foreground`, `border`, `background`
- ❌ Non usare ombre con tinte fredde (`rgba(0,0,0,...)`) — sempre tinta warm-brown
- ❌ Non usare `rounded-full` su card o bottoni (eccezione esplicita: il bottone flottante della Calcolatrice, unico caso di forma completamente circolare)
- ❌ Non usare più colori cromatici pieni nei bottoni — solo espresso (default) o amber
- ❌ Non ripetere la stessa parola in titolo sezione + etichetta campo + placeholder (es. sezione "Note" con label "Note interne" e placeholder "Note interne...") — se la sezione ha un solo campo, il titolo di sezione basta
