# Lavorazione "Terzi" + campo "Affidato a" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere "Terzi" alla lista Tipo lavorazione e un campo facoltativo "Affidato a" (nome della ditta/artigiano esterno a cui è affidata la lavorazione), visibile nel form quando Tipo lavorazione = "Terzi" e in scheda ordine quando valorizzato.

**Architecture:** Nuova colonna `orders.terzi_ditta` (text, nullable). Campo passthrough, nessuna logica di business, nessun sottostato — stesso trattamento di `materiale_fornitore` lato dati, ma senza bottoni di stato. Segue il gate esistente `hasFeature("campi_avanzati")` perché è un'estensione di "Tipo lavorazione", già dietro quel flag.

**Tech Stack:** Next.js Server Actions (`src/actions/orders.ts`), React client form (`OrderForm.tsx`), Supabase Postgres (migration SQL).

Spec di riferimento: `docs/superpowers/specs/2026-09-30-lavorazione-terzi-design.md`

---

### Task 1: Migration — colonna `orders.terzi_ditta`

**Files:**
- Create: `supabase/migrations/20260930000001_add_terzi_ditta.sql`

- [ ] **Step 1: Scrivi il file di migration**

```sql
-- Lavorazione affidata a una ditta/artigiano esterno ("Terzi" nella lista
-- Tipo lavorazione, testo libero in OrderForm.tsx): terzi_ditta annota a chi
-- è stata affidata. Nessuno stato/sottostato associato (a differenza di
-- materiale_fornitore), facoltativo, nessun vincolo NOT NULL.
alter table public.orders
  add column if not exists terzi_ditta text;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260930000001_add_terzi_ditta.sql
git commit -m "feat(db): aggiungi colonna orders.terzi_ditta"
```

**Nota:** questa migration non viene applicata automaticamente — va eseguita manualmente dallo SQL Editor del Supabase Dashboard, stesso processo già usato per tutte le migration precedenti di questo progetto (nessuna CLI Supabase collegata in ambiente di sviluppo). Da fare dopo il merge, prima di usare il campo in produzione.

---

### Task 2: Tipo `OrderRow` — campo `terzi_ditta`

**Files:**
- Modify: `src/actions/orders.ts:38`

- [ ] **Step 1: Aggiungi il campo al tipo**

In `src/actions/orders.ts`, il tipo `OrderRow` (righe 22-61) ha oggi alla riga 38:

```ts
  tipo_lavorazione: string | null
```

Aggiungi subito dopo:

```ts
  tipo_lavorazione: string | null
  terzi_ditta: string | null
```

Nessun'altra modifica in questo file: `getOrders`/`getOrder` usano già `select("*")`, e `createOrder`/`updateOrder` passano `...rest` direttamente senza whitelist di campi — il nuovo campo attraversa già tutto lo stack una volta aggiunto al tipo.

- [ ] **Step 2: Verifica che il progetto compili**

Run: `npx tsc --noEmit`
Expected: nessun nuovo errore (il campo è opzionale da passare grazie a `Partial<CreateOrderInput>`, ma obbligatorio leggerlo da `OrderRow` — nessun punto del codice costruisce oggi un `OrderRow` letterale completo a mano, quindi non ci si aspettano errori da questo cambiamento).

- [ ] **Step 3: Commit**

```bash
git add src/actions/orders.ts
git commit -m "feat(orders): aggiungi terzi_ditta al tipo OrderRow"
```

---

### Task 3: Form ordine — voce "Terzi" e campo "Affidato a"

**Files:**
- Modify: `src/components/OrderForm.tsx:24` (lista `TIPI_LAVORAZIONE`)
- Modify: `src/components/OrderForm.tsx:121` (nuovo state, dopo `tipoLavorazione`)
- Modify: `src/components/OrderForm.tsx:203` (payload, dopo `tipo_lavorazione`)
- Modify: `src/components/OrderForm.tsx:497-509` (JSX del blocco Tipo lavorazione)

- [ ] **Step 1: Aggiungi "Terzi" alla lista**

Riga 24, oggi:

```ts
const TIPI_LAVORAZIONE = ["Stampa UV", "Taglio + stampa", "Incisione/taglio laser", "Fresatura", "Stampa"]
```

Diventa:

```ts
const TIPI_LAVORAZIONE = ["Stampa UV", "Taglio + stampa", "Incisione/taglio laser", "Fresatura", "Stampa", "Terzi"]
```

- [ ] **Step 2: Nuovo state `terziDitta`**

Riga 121, oggi:

```ts
  const [tipoLavorazione, setTipoLavorazione] = useState(order?.tipo_lavorazione ?? "")
```

Aggiungi subito dopo:

```ts
  const [tipoLavorazione, setTipoLavorazione] = useState(order?.tipo_lavorazione ?? "")
  const [terziDitta, setTerziDitta] = useState((order as any)?.terzi_ditta ?? "")
```

(Il cast `as any` segue lo stesso pattern già usato in questo file per `dettagli_grafici` alla riga 491 — `order` è tipato da un `OrderRow` importato da un client component, e finché `src/types/supabase.ts` non è rigenerato alcuni campi nuovi vengono letti così altrove nel file.)

- [ ] **Step 3: Aggiungi il campo al payload di salvataggio**

Riga 203, oggi:

```ts
      tipo_lavorazione: tipoLavorazione || null,
```

Diventa:

```ts
      tipo_lavorazione: tipoLavorazione || null,
      terzi_ditta: terziDitta.trim() || null,
```

Invio incondizionato (non dentro l'`if`/spread di `campi_avanzati`), stesso trattamento di `materiale_fornitore` alla riga 206: se l'utente cambia Tipo lavorazione e il campo sparisce dalla UI, il valore resta in state e viene comunque inviato — nessun reset forzato.

- [ ] **Step 4: Aggiungi il campo condizionale nella UI**

Righe 497-509, oggi:

```tsx
          {hasFeature("campi_avanzati") && (
            <div>
              <Label htmlFor="tipo_lavorazione">Tipo lavorazione</Label>
              <Select value={tipoLavorazione} onValueChange={(v) => setTipoLavorazione(v ?? "")}>
                <SelectTrigger id="tipo_lavorazione" className="w-full">
                  <SelectValue placeholder="— Seleziona —" />
                </SelectTrigger>
                <SelectContent>
                  {TIPI_LAVORAZIONE.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
```

Diventa:

```tsx
          {hasFeature("campi_avanzati") && (
            <div>
              <Label htmlFor="tipo_lavorazione">Tipo lavorazione</Label>
              <Select value={tipoLavorazione} onValueChange={(v) => setTipoLavorazione(v ?? "")}>
                <SelectTrigger id="tipo_lavorazione" className="w-full">
                  <SelectValue placeholder="— Seleziona —" />
                </SelectTrigger>
                <SelectContent>
                  {TIPI_LAVORAZIONE.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              {tipoLavorazione === "Terzi" && (
                <div className="mt-2">
                  <Label htmlFor="terzi_ditta">Affidato a</Label>
                  <Input id="terzi_ditta" value={terziDitta} onChange={(e) => setTerziDitta(e.target.value)} placeholder="Nome ditta/artigiano" />
                </div>
              )}
            </div>
          )}
```

`Input` è già importato in cima al file (riga 8), nessun nuovo import necessario.

- [ ] **Step 5: Verifica che il progetto compili**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add src/components/OrderForm.tsx
git commit -m "feat(orders): aggiungi \"Terzi\" a Tipo lavorazione e campo \"Affidato a\""
```

---

### Task 4: Scheda ordine — mostra "Affidato a"

**Files:**
- Modify: `src/app/(dashboard)/orders/[id]/page.tsx:276-284` (card "Files")

- [ ] **Step 1: Estendi la card "Files" esistente**

Righe 276-284, oggi:

```tsx
      {/* Files */}
      {(order.file_cliente || order.foto_oggetto) && (
        <Card>
          <CardContent className="pt-4 space-y-1 text-sm">
            {order.file_cliente && <p><span className="text-muted-foreground">File cliente: </span>{order.file_cliente}</p>}
            {order.foto_oggetto && <p><span className="text-muted-foreground">Foto oggetto: </span>{order.foto_oggetto}</p>}
          </CardContent>
        </Card>
      )}
```

Diventa:

```tsx
      {/* Files */}
      {(order.file_cliente || order.foto_oggetto || order.terzi_ditta) && (
        <Card>
          <CardContent className="pt-4 space-y-1 text-sm">
            {order.file_cliente && <p><span className="text-muted-foreground">File cliente: </span>{order.file_cliente}</p>}
            {order.foto_oggetto && <p><span className="text-muted-foreground">Foto oggetto: </span>{order.foto_oggetto}</p>}
            {order.terzi_ditta && <p><span className="text-muted-foreground">Affidato a: </span>{order.terzi_ditta}</p>}
          </CardContent>
        </Card>
      )}
```

**Nota rispetto alla spec:** la spec descrive "un nuovo blocco informativo... posizionato subito dopo la card Articoli e prima della card Files". In pratica la card "Files" è esattamente quel blocco (stesso stile, stessa posizione, condizione content-based) — qui si aggiunge "Affidato a" come terza riga della card esistente invece di creare una card quasi identica con una sola riga. Stesso risultato visivo per l'utente (informazione visibile nella stessa zona della pagina), meno codice duplicato.

- [ ] **Step 2: Verifica che il progetto compili**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/orders/[id]/page.tsx"
git commit -m "feat(orders): mostra \"Affidato a\" in scheda ordine"
```

---

### Task 5: Aggiorna CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Aggiungi la riga alla tabella "Decisioni chiave e motivazioni"**

Aggiungi come nuova riga in fondo alla tabella (prima della riga "Regola guida di prodotto"):

```
| Voce "Terzi" in Tipo lavorazione + campo facoltativo "Affidato a" (2026-09-30) | Alcune lavorazioni vengono affidate a una ditta/artigiano esterno (macchina che la bottega non ha). Nuova colonna `orders.terzi_ditta` (migration `20260930000001_add_terzi_ditta.sql`), testo libero, nessun sottostato/stato (a differenza di "Materiale fornitore") — confermato esplicitamente dall'utente. Campo mostrato nel form solo quando Tipo lavorazione = "Terzi" (stesso gate `hasFeature("campi_avanzati")` del campo padre), e in scheda ordine solo se valorizzato (terza riga della card "Files" esistente, stesso stile content-based) — eccezione esplicita rispetto alla regola "Tipo lavorazione non compare in scheda ordine", richiesta dall'utente per poter seguire l'ordine. Non compare in lista/bacheca/etichetta/ricerca/CSV backup. |
```

- [ ] **Step 2: Aggiungi la migration all'elenco numerato**

Nella sezione "Modello dati (v1)", dopo la voce 11 (`20260909000001_add_ente_referente.sql`), aggiungi:

```
12. `20260930000001_add_terzi_ditta.sql` — colonna `terzi_ditta` su `orders`
```

- [ ] **Step 3: Aggiungi una voce in "Testing" (bullet Feature)**

Nella sezione Testing, dopo l'ultimo bullet Feature esistente, aggiungi:

```
- **Feature (2026-09-30)**: voce "Terzi" in Tipo lavorazione + campo "Affidato a" — vedere riga corrispondente in Decisioni chiave. Nuova colonna `orders.terzi_ditta` (migration, da applicare manualmente da SQL Editor del Supabase Dashboard). Modifiche in `OrderForm.tsx` (lista `TIPI_LAVORAZIONE`, state `terziDitta`, campo condizionato a Tipo lavorazione = "Terzi") e `orders/[id]/page.tsx` (terza riga nella card "Files" esistente). Nessuna logica di business, nessun nuovo test automatico (campo passthrough, stessa convenzione già seguita per `materiale_fornitore`/`dettagli_grafici`) — verificato con `npx tsc --noEmit` pulito e lettura del JSX.
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: aggiorna CLAUDE.md per lavorazione Terzi + Affidato a"
```

---

### Task 6: Verifica finale

- [ ] **Step 1: Type check completo**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 2: Suite Jest completa**

Run: `npx jest --roots=src`
Expected: tutte le suite verdi, nessuna regressione (nessun test esistente referenzia `materiale_fornitore`/`tipo_lavorazione` per valore letterale, vedere verifica fatta in fase di piano — non sono attese rotture).

- [ ] **Step 3: Checklist di verifica manuale (da eseguire con `npm run dev`, non automatizzabile in questo codebase)**

1. Creazione ordine con Tipo lavorazione = "Terzi" e "Affidato a" = "Incisioni Rossi" → salva → scheda ordine mostra "Affidato a: Incisioni Rossi" nella card in basso.
2. Creazione ordine con Tipo lavorazione diverso da "Terzi" (o non selezionato) → nessuna card "Affidato a" in scheda ordine (a meno che l'ordine abbia comunque `file_cliente`/`foto_oggetto`, nel qual caso la card resta ma senza la riga "Affidato a").
3. Modifica di un ordine "Terzi" cambiando Tipo lavorazione a un altro valore senza svuotare "Affidato a" → dopo il salvataggio la riga "Affidato a" resta visibile in scheda ordine (il valore non viene azzerato automaticamente).
4. Selezionando "Terzi" nel form, il campo "Affidato a" compare subito sotto il menu a tendina; cambiando di nuovo Tipo lavorazione a un altro valore il campo sparisce dalla UI (senza svuotare quanto digitato, coerente con lo Step 3).

---

## Self-review

- **Copertura spec:** tutte le sezioni della spec (nuova voce "Terzi", nuova colonna, form condizionato, visualizzazione in scheda ordine, "non compare altrove") sono coperte rispettivamente da Task 3 (lista + campo form), Task 1 (migration), Task 3 (condizione UI), Task 4 (scheda ordine). Nessuna modifica a ricerca/CSV/etichetta prevista né necessaria (nessun task la tocca, coerente con "Cosa NON cambia" della spec).
- **Placeholder:** nessuno — ogni step ha codice completo o comando+output atteso.
- **Coerenza dei nomi:** `terzi_ditta` (colonna DB / `OrderRow` / payload) e `terziDitta` (state React) usati in modo coerente in tutti i task; `tipoLavorazione === "Terzi"` è la condizione usata sia nel form (Task 3) sia implicitamente prevista lato dati (il valore può restare anche se il tipo cambia, gestito in Task 4 via condizione content-based su `order.terzi_ditta`, non su `tipo_lavorazione`).
- **Deviazione dalla spec:** Task 4 piega "Affidato a" dentro la card "Files" esistente invece di crearne una nuova — annotato esplicitamente nel task con la motivazione (stesso risultato visivo, meno duplicazione). Non cambia il comportamento osservabile dall'utente descritto nella spec.
