# Pipeline CI automatica

**Data**: 2026-09-21
**Stato**: approvato, pronto per il piano di implementazione

## Problema

Oggi test, controllo dei tipi e lint vengono eseguiti solo a mano prima di ogni push — se qualcuno se ne dimentica, un errore può finire in produzione senza che nessuno se ne accorga prima. Nessuna pipeline CI esiste (segnalato in CLAUDE.md il 2026-07-03, mai affrontato).

## Scoperte durante l'esplorazione del contesto

- **`npm run lint` è rotto**: lo script usa `next lint`, comando rimosso da Next.js 16 (il progetto è su Next 16.2.9). Va sostituito con `eslint .` diretto (`eslint`/`eslint-config-next` sono già devDependencies).
- **Una volta corretto, `eslint .` trova 12 errori + 6 avvisi reali** sparsi in una decina di file (`middleware.ts`, `OrderForm.tsx`, `KanbanBoard.tsx`, `SearchBar.tsx`, `ReminderList.tsx`, `PrintClient.tsx`, `VoiceDictationButton.tsx`, `orders/[id]/page.tsx`, `orders.ts`, `TodayBoard.tsx`, `FileUpload.tsx`, `setup-pin/page.tsx`, `setup-shop/page.tsx`) — mai visti prima perché il comando non funzionava. Perlopiù `@typescript-eslint/no-explicit-any`, `no-unused-vars`, e alcune regole più severe di `eslint-config-next` su Next 16 (`react-hooks/refs`, `react-hooks/set-state-in-effect`, `react-hooks/immutability`) che segnalano pattern sicuri con React classico ma da evitare in vista di funzionalità future (React Compiler). Nessuno di questi è correlato al lavoro di oggi.
- **`.claude/worktrees/login-pin`** (un vecchio worktree Git dimenticato, contiene una copia intera di `src/`) non era escluso dal lint — gonfiava il conteggio a 18.483 problemi totali. Da escludere esplicitamente.
- `package.json` dichiara `"engines": { "node": ">=20.9.0" }` — la CI userà Node 20.x.
- Test (`npx jest --roots=src`) e type check (`npx tsc --noEmit`) sono già puliti oggi (152 test, 0 errori di tipo) — nessuna correzione necessaria per farli passare in CI.

## Decisioni chiave

| Decisione | Motivazione |
|---|---|
| GitHub Actions, non un altro servizio CI | Repo già su GitHub, pubblico → minuti Actions gratuiti e illimitati, zero configurazione di account esterni |
| Trigger: push su `main` + ogni Pull Request | Controlla sia il lavoro diretto su `main` sia quello nei branch/worktree prima del merge (es. flusso `subagent-driven-development` già in uso nel progetto) |
| Test e type check **bloccanti**, lint **informativo** (non blocca) | Test e tipi sono già puliti oggi, quindi la CI parte verde da subito. Il lint invece troverebbe 12 errori pre-esistenti non correlati — farlo bloccare renderebbe la CI "rossa" dal primo giorno su codice già in produzione, il contrario dell'effetto voluto. I 12 problemi restano un lavoro a parte, da affrontare quando si vuole |
| Nessun controllo di build (`npm run build`) in CI, per ora | Richiederebbe salvare le credenziali Supabase come secret su GitHub (`NEXT_PUBLIC_SUPABASE_URL` e simili, necessarie per la generazione statica di alcune pagine) — complessità e superficie di rischio in più non necessarie per il beneficio principale. Rimandato come possibile passo successivo |
| Corretto `package.json` (`"lint": "eslint ."`) e `eslint.config.mjs` (esclude `.claude/worktrees/**`) come parte di questo lavoro | Senza questi due fix il passo di lint della CI non funzionerebbe affatto (comando rotto) o darebbe un conteggio falsato (worktree incluso) |
| Attivazione di "richiedi che i controlli passino prima del merge" (GitHub Settings → Branches) lasciata all'utente, fuori scope | È un'impostazione del repository su GitHub, non un file di codice — da attivare quando l'utente si fida della CI, non contestuale a questo lavoro |

## File coinvolti

- **Create**: `.github/workflows/ci.yml` — il workflow GitHub Actions
- **Modify**: `package.json` — script `lint` corretto
- **Modify**: `eslint.config.mjs` — esclude `.claude/worktrees/**`

Nessuna migration, nessun cambiamento al comportamento dell'app — solo configurazione.

## Verifica

- Il workflow va verificato aprendo una Pull Request di prova (o osservando l'esecuzione dopo il push su `main`) su GitHub → tab "Actions", controllando che i tre step girino e che test/type check risultino ✅.
- Nessuna infrastruttura di test automatico esiste per verificare un workflow YAML stesso — la verifica è "farlo girare davvero su GitHub e guardare l'esito", coerente con come sono state verificate altre configurazioni non di codice in questo progetto (es. SimpleBackups, Resend).
