# Pipeline CI automatica Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere una pipeline CI su GitHub Actions che esegue automaticamente test e type check (bloccanti) e lint (informativo) ad ogni push su `main` e ad ogni Pull Request.

**Architecture:** Un singolo workflow file (`.github/workflows/ci.yml`) con un job che fa checkout, installa le dipendenze, e lancia in sequenza `npx jest --roots=src`, `npx tsc --noEmit` (entrambi bloccanti: se falliscono, il job fallisce) e `npx eslint .` (con `continue-on-error: true`, quindi non blocca il job anche se trova problemi). Prima di questo, due correzioni abilitanti: lo script `lint` in `package.json` è rotto (`next lint` non esiste più su Next 16) e va sostituito con `eslint .` diretto; `eslint.config.mjs` non esclude `.claude/worktrees/**`, un vecchio worktree Git dimenticato che gonfia il conteggio dei problemi lint.

**Tech Stack:** GitHub Actions (`actions/checkout@v4`, `actions/setup-node@v4`), Node.js 20.x (coerente con `engines.node` in `package.json`), npm, Jest, TypeScript, ESLint 9 (flat config).

---

## Contesto tecnico importante (verificato prima di scrivere questo piano)

- `npm run lint` fallisce oggi con `Invalid project directory provided, no such directory: .../lint` — conferma che `next lint` non è più un sottocomando valido su Next.js 16.2.9.
- Una volta corretto lo script a `eslint .`, il comando linta anche `.claude/worktrees/login-pin/` (459 file, una copia duplicata di `src/`), portando il conteggio a 18.483 problemi totali. Escludendo quella cartella, i problemi reali sono **12 errori + 6 avvisi su 107 file di progetto** — nessuno correlato a questo lavoro, da NON correggere in questo piano (deciso in fase di brainstorming: lint resta informativo proprio per questo).
- `package.json` ha già `"engines": { "node": ">=20.9.0" }` — usare Node 20.x nel workflow.
- `package-lock.json` esiste nella root del progetto — `npm ci` funzionerà.
- Nessuna cartella `.github/` esiste ancora nel repository.
- `gh` (GitHub CLI) è disponibile e autenticato in questo ambiente — usato nell'ultimo task per verificare che il workflow giri davvero su GitHub dopo il push, non solo per sintassi.

---

### Task 1: Correggi lo script `lint` e l'esclusione del worktree

**Files:**
- Modify: `package.json:12`
- Modify: `eslint.config.mjs`

- [ ] **Step 1: Correggi lo script lint in `package.json`**

Trova (riga 12):

```json
    "lint": "next lint",
```

Sostituisci con:

```json
    "lint": "eslint .",
```

- [ ] **Step 2: Escludi il worktree dimenticato in `eslint.config.mjs`**

Il file attuale è:

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
```

Sostituiscilo con:

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vecchi worktree Git sotto .claude/ (creati dallo strumento worktree
    // di superpowers durante lo sviluppo a task): contengono una copia
    // duplicata di src/ e non vanno lintati.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
```

- [ ] **Step 3: Esegui il lint e verifica che il worktree sia escluso**

Run: `npx eslint . --format=json > _eslint-check.json && node -e "const r=JSON.parse(require('fs').readFileSync('_eslint-check.json','utf8')); const wt=r.filter(x=>x.filePath.includes('.claude')&&x.filePath.includes('worktrees')); console.log('worktree files linted:', wt.length); console.log('total files linted:', r.length);" && rm _eslint-check.json`

Expected: `worktree files linted: 0` e `total files linted: 107` (o un numero vicino a 107 — può variare leggermente se altri file sono cambiati nel frattempo, ma deve essere nell'ordine delle centinaia, non 566).

- [ ] **Step 4: Verifica che lint riporti solo i problemi pre-esistenti noti (nessuna regressione)**

Run: `npm run lint`
Expected: il comando termina (con exit code diverso da zero, è atteso — ci sono errori pre-esistenti) mostrando circa 12 errori e 6 avvisi in file come `middleware.ts`, `OrderForm.tsx`, `KanbanBoard.tsx`, `SearchBar.tsx`, `ReminderList.tsx`, `PrintClient.tsx`, `VoiceDictationButton.tsx`. Non deve più menzionare `next lint`/"Invalid project directory" e non deve elencare nessun file sotto `.claude/worktrees/`.

- [ ] **Step 5: Verifica che test e type check restino puliti (nessuna regressione da questi due file di configurazione)**

Run: `npx jest --roots=src`
Expected: PASS, tutti i test verdi (nessun cambiamento atteso rispetto al conteggio attuale)

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 6: Commit**

```bash
git add package.json eslint.config.mjs
git commit -m "$(cat <<'EOF'
fix: corregge lo script lint rotto ed esclude i worktree dal lint

next lint non esiste piu' su Next.js 16, sostituito con eslint .
diretto. eslint.config.mjs escludeva gia' .next/out/build ma non
.claude/worktrees/**, un vecchio worktree dimenticato che contiene
una copia duplicata di src/ e gonfiava il conteggio dei problemi
lint da ~18 a oltre 18000.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Crea il workflow GitHub Actions

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Crea la cartella e il file del workflow**

Crea `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20.x"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npx jest --roots=src

      - name: Type check
        run: npx tsc --noEmit

      - name: Lint (informativo, non blocca la pipeline)
        run: npx eslint .
        continue-on-error: true
```

- [ ] **Step 2: Valida la sintassi YAML del workflow**

Run: `npx -y js-yaml .github/workflows/ci.yml`
Expected: stampa il contenuto del file interpretato come struttura dati (non un errore di parsing) — conferma che lo YAML è sintatticamente valido. Se il comando restituisce un errore di parsing YAML, correggi l'indentazione/sintassi e ripeti questo step.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "$(cat <<'EOF'
feat: aggiunge la pipeline CI su GitHub Actions

Ad ogni push su main e ogni Pull Request: test (jest) e type check
(tsc) bloccanti, gia' puliti oggi; lint (eslint) informativo, non
blocca la pipeline (12 errori pre-esistenti scoperti sistemando lo
script rotto restano un lavoro a parte). Nessun controllo di build
per ora, rimandato per evitare di gestire secret Supabase su GitHub.
Costo zero: repo pubblico, GitHub Actions gratuito e illimitato.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Verifica che la pipeline giri davvero su GitHub

**Files:** nessuno (solo push e verifica remota)

Questo task richiede che i commit dei Task 1 e 2 siano già stati fatti su un branch che verrà pushato su `origin`. Se stai eseguendo questo piano su un branch/worktree separato dal branch principale del controller, salta questo task per ora — verrà eseguito dal controller dopo il merge su `main`, perché serve un push reale su GitHub per vedere il workflow girare (non è verificabile offline).

- [ ] **Step 1: Push su origin**

Run: `git push origin main` (o il branch corrente, se diverso — se il branch non è `main`, apri anche una Pull Request verso `main` con `gh pr create --fill` per far scattare il trigger `pull_request`)

- [ ] **Step 2: Osserva l'esecuzione del workflow su GitHub**

Run: `gh run list --limit 3`
Expected: una riga con workflow `CI`, evento `push` (o `pull_request`), stato inizialmente `in_progress` o `queued`.

- [ ] **Step 3: Attendi il completamento e controlla l'esito**

Run: `gh run watch` (segui il run più recente fino al completamento; se chiede di scegliere quale run, seleziona quello più recente del workflow `CI`)
Expected: gli step "Run tests" e "Type check" completati con successo (✓); lo step "Lint" può risultare fallito/con avvisi ma il job nel complesso deve concludersi con successo comunque, grazie a `continue-on-error: true`.

Se "Run tests" o "Type check" falliscono nel workflow ma erano verdi in locale nel Task 1, indagare la differenza (es. versione di Node, variabili d'ambiente mancanti) prima di considerare il lavoro concluso — non ignorare un fallimento reale in CI.

- [ ] **Step 4: Report finale**

Nessun commit in questo task. Riporta all'utente l'esito reale osservato (non assumere che abbia funzionato solo perché il workflow è stato creato) — cita l'URL del run (`gh run view --web` lo apre nel browser) così l'utente può vederlo con i propri occhi su GitHub.

---

## Dopo l'implementazione (fuori da questo piano)

- I 12 errori + 6 avvisi lint pre-esistenti restano da correggere in un lavoro a parte, quando si vuole — elencati nel design doc (`docs/superpowers/specs/2026-09-21-pipeline-ci-design.md`).
- L'opzione GitHub "richiedi che i controlli passino prima del merge" (Settings → Branches → protezione di `main`) resta una scelta dell'utente da attivare quando si fida della CI — non è un file di codice, va fatto manualmente sulla pagina del repository.
- Un controllo di build (`npm run build`) in CI resta un possibile passo successivo, rimandato perché richiederebbe secret Supabase su GitHub Actions.
