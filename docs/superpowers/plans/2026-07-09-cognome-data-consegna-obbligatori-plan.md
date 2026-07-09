# Cognome e data consegna obbligatori — Piano di implementazione

> **Per chi esegue in autonomia:** SOTTO-SKILL RICHIESTA: usa superpowers:subagent-driven-development (consigliata) o superpowers:executing-plans per eseguire questo piano un task alla volta. I passi usano la sintassi checkbox (`- [ ]`) per il tracciamento.

**Obiettivo:** Rendere obbligatori nel form ordine i campi Cognome e Data consegna, con lo stesso pattern già usato per il Telefono (validazione solo lato form, nessun vincolo a database).

**Architettura:** Aggiunta dell'attributo HTML `required` e dell'asterisco nell'etichetta per i due campi in `src/components/OrderForm.tsx`, nessuna modifica a server actions, schema database o altre pagine.

**Stack tecnico:** Next.js, TypeScript, HTML native form validation.

**Spec di riferimento:** `docs/superpowers/specs/2026-07-09-cognome-data-consegna-obbligatori-design.md`

---

### Task 1: Rendi obbligatorio il campo Cognome

**File:**
- Modifica: `src/components/OrderForm.tsx:210-217`

- [ ] **Passo 1: Modifica l'etichetta e aggiungi `required` all'input**

Sostituisci (righe 209-218):

```typescript
          <div>
            <Label htmlFor="cognome">Cognome</Label>
            <Input
              id="cognome"
              name="cognome"
              value={cognomeValue}
              onChange={(e) => setCognomeValue(e.target.value)}
              placeholder="Cognome"
            />
          </div>
```

con:

```typescript
          <div>
            <Label htmlFor="cognome">Cognome *</Label>
            <Input
              id="cognome"
              name="cognome"
              required
              value={cognomeValue}
              onChange={(e) => setCognomeValue(e.target.value)}
              placeholder="Cognome"
            />
          </div>
```

- [ ] **Passo 2: Type-check**

Comando: `npx tsc --noEmit`
Atteso: nessun errore.

- [ ] **Passo 3: Verifica manuale**

Esegui: `npm run dev`, apri `http://localhost:3000/orders/new`. Compila tutti
i campi tranne Cognome, prova a inviare il form. Atteso: il browser blocca
l'invio e mostra il messaggio nativo "Compila questo campo" (o equivalente)
sotto/accanto al campo Cognome.

- [ ] **Passo 4: Commit**

```bash
git add src/components/OrderForm.tsx
git commit -m "fix: rendi obbligatorio il cognome cliente nel form ordine"
```

---

### Task 2: Rendi obbligatorio il campo Data consegna

**File:**
- Modifica: `src/components/OrderForm.tsx:253-256`

- [ ] **Passo 1: Modifica l'etichetta e aggiungi `required` all'input**

Sostituisci (righe 253-256):

```typescript
          <div>
            <Label htmlFor="data_consegna">Data consegna</Label>
            <Input id="data_consegna" name="data_consegna" type="date" defaultValue={order?.data_consegna ?? ""} />
          </div>
```

con:

```typescript
          <div>
            <Label htmlFor="data_consegna">Data consegna *</Label>
            <Input id="data_consegna" name="data_consegna" type="date" required defaultValue={order?.data_consegna ?? ""} />
          </div>
```

- [ ] **Passo 2: Type-check**

Comando: `npx tsc --noEmit`
Atteso: nessun errore.

- [ ] **Passo 3: Verifica manuale**

Con il dev server già avviato (Task 1), su `http://localhost:3000/orders/new`
compila tutti i campi tranne Data consegna, prova a inviare il form. Atteso:
il browser blocca l'invio e mostra il messaggio nativo sotto/accanto al
campo Data consegna.

Poi, su un ordine esistente privo di data consegna (se presente tra i dati
di test) apri `/orders/[id]/edit`: il form si apre normalmente senza errori
(il valore mancante non blocca l'apertura in modifica, solo il submit senza
averlo compilato).

- [ ] **Passo 4: Commit**

```bash
git add src/components/OrderForm.tsx
git commit -m "fix: rendi obbligatoria la data di consegna nel form ordine"
```

---

### Task 3: Aggiorna CLAUDE.md

**File:**
- Modifica: `CLAUDE.md`

- [ ] **Passo 1: Aggiungi riga a "Decisioni chiave e motivazioni"**

Aggiungi questa riga alla tabella, subito dopo la riga esistente "Telefono
cliente obbligatorio nel form ordine":

```markdown
| Cognome e data consegna obbligatori nel form ordine | Senza questi dati la lista ordini perde valore come base dati consultabile (ricerca cliente, storico, programmazione consegne). Stesso pattern già usato per il telefono: validazione solo lato form (attributo `required`), nessun vincolo `NOT NULL` a livello di database — gli ordini già esistenti senza questi dati restano validi finché non vengono modificati |
```

- [ ] **Passo 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: documenta cognome e data consegna obbligatori in CLAUDE.md"
```

---

## Note di autoverifica

- **Copertura spec:** entrambi i campi (Task 1, Task 2) e la documentazione
  (Task 3) coprono l'intera spec approvata. Nessuna modifica a database o
  server actions richiesta dalla spec, e nessuna aggiunta qui.
- **Nessun placeholder:** ogni passo mostra codice esatto, percorsi file
  esatti, comandi esatti.
- **Coerenza:** i nomi dei campi (`cognome`, `data_consegna`) e degli id
  (`id="cognome"`, `id="data_consegna"`) corrispondono esattamente a quelli
  già usati altrove nel file (payload di submit, `useState` iniziali).
