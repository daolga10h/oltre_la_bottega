# Dettatura vocale per campi di testo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere un pulsante di dettatura vocale (Web Speech API del browser, gratuita) a tre campi di testo libero: "Testo da scrivere" per riga articolo e "Note interne" in `OrderForm.tsx`, "Cosa ricordare…" in `ReminderForm.tsx`.

**Architecture:** Un componente client riutilizzabile `VoiceDictationButton` incapsula l'API `SpeechRecognition`/`webkitSpeechRecognition` del browser (feature-detected, si nasconde da solo se non supportata) ed espone una singola prop `onTranscript(chunk: string)` chiamata una volta per ogni frase riconosciuta durante la sessione di ascolto. Una funzione pura condivisa `appendDictatedText` (testata con Jest) decide come accodare ogni chunk al testo esistente. I tre punti di integrazione usano due tecniche diverse a seconda di come il campo è già gestito nel codice esistente: i campi controllati da React state (Testo da scrivere) accodano tramite un aggiornamento funzionale dello state; i campi non controllati (Note interne, Cosa ricordare — entrambi letti da `FormData`/`defaultValue`) accodano leggendo/scrivendo direttamente `ref.current.value`.

**Tech Stack:** Next.js 16 / React 19 (client components), TypeScript strict, Web Speech API nativa del browser (nessuna dipendenza npm nuova), Jest (`ts-jest`, `testEnvironment: "node"`) per la funzione pura, `lucide-react` (icone `Mic`/`MicOff`), componenti shadcn/base-ui esistenti (`Button`/`buttonVariants`).

---

## Contesto tecnico importante (letto dal codice attuale)

- **Testo da scrivere** (`src/components/OrderForm.tsx:417-423`) è **controllato**: `value={item.testoDaScrivere}` con state React (`items`, gestito da `updateItem`).
- **Note interne** (`src/components/OrderForm.tsx:591`) è **non controllato**: `defaultValue={order?.note ?? ""}`, il valore viene letto solo al submit tramite `FormData` (funzione `v("note")` a riga 170).
- **Cosa ricordare…** (`src/components/ReminderForm.tsx:24-29`) è **non controllato**: `<Input name="title" ... />` dentro un `<form action={formAction}>` con `useActionState`, nessuno state React collegato.
- Jest gira con `testEnvironment: "node"` (vedere `jest.config.ts`) — **nessun DOM disponibile nei test**, coerente con l'assenza di test automatici per componenti in questo progetto. Solo la funzione pura `appendDictatedText` sarà testata; il componente `VoiceDictationButton` e i tre punti di integrazione andranno verificati manualmente (vedere sezione finale del piano).
- Il campo controllato ha un rischio reale di bug se non gestito con attenzione: la sessione di ascolto vocale resta aperta per più frasi (modalità `continuous`), e ogni frase riconosciuta arriva in un evento separato. Se l'aggiornamento dello state accoda leggendo `item.testoDaScrivere` catturato nella closure al momento del click sul microfono, la seconda frase sovrascriverebbe la prima (closure "stale"). Per questo `updateItem` va esteso per accettare anche una funzione di aggiornamento `(prev) => string`, non solo un valore diretto — vedere Task 3.

---

### Task 1: Funzione pura `appendDictatedText`

**Files:**
- Create: `src/lib/dictation.ts`
- Test: `src/lib/__tests__/dictation.test.ts`

- [x] **Step 1: Scrivi il test che fallisce**

Crea `src/lib/__tests__/dictation.test.ts`:

```ts
import { appendDictatedText } from "../dictation"

describe("appendDictatedText", () => {
  it("returns the chunk when the current text is empty", () => {
    expect(appendDictatedText("", "ciao mondo")).toBe("ciao mondo")
  })

  it("appends the chunk to existing text with a single space", () => {
    expect(appendDictatedText("Testo esistente", "aggiunta")).toBe("Testo esistente aggiunta")
  })

  it("trims trailing whitespace from the existing text before appending", () => {
    expect(appendDictatedText("Testo esistente   ", "aggiunta")).toBe("Testo esistente aggiunta")
  })

  it("trims the chunk before appending", () => {
    expect(appendDictatedText("Testo esistente", "  aggiunta  ")).toBe("Testo esistente aggiunta")
  })

  it("returns the current text unchanged when the chunk is empty or whitespace-only", () => {
    expect(appendDictatedText("Testo esistente", "")).toBe("Testo esistente")
    expect(appendDictatedText("Testo esistente", "   ")).toBe("Testo esistente")
  })

  it("returns an empty string when both current text and chunk are empty", () => {
    expect(appendDictatedText("", "")).toBe("")
  })
})
```

- [x] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx jest src/lib/__tests__/dictation.test.ts`
Expected: FAIL — `Cannot find module '../dictation'`

- [x] **Step 3: Scrivi l'implementazione minima**

Crea `src/lib/dictation.ts`:

```ts
export function appendDictatedText(current: string, chunk: string): string {
  const trimmedChunk = chunk.trim()
  if (!trimmedChunk) return current

  const trimmedCurrent = current.trimEnd()
  if (!trimmedCurrent) return trimmedChunk

  return `${trimmedCurrent} ${trimmedChunk}`
}
```

- [x] **Step 4: Esegui il test e verifica che passi**

Run: `npx jest src/lib/__tests__/dictation.test.ts`
Expected: PASS — 6 test verdi

- [x] **Step 5: Commit**

```bash
git add src/lib/dictation.ts src/lib/__tests__/dictation.test.ts
git commit -m "$(cat <<'EOF'
feat: aggiunge appendDictatedText per accodare testo dettato

Funzione pura che decide come unire il testo gia' presente in un
campo con un nuovo frammento dettato via voce, gestendo spazi e
frammenti vuoti. Primo passo della dettatura vocale sui campi di
testo libero.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Componente `VoiceDictationButton`

**Files:**
- Create: `src/components/VoiceDictationButton.tsx`

Nessun test automatico per questo componente (richiede API browser reali, `testEnvironment: "node"` in Jest non ha DOM) — verificato manualmente nel Task 6.

- [x] **Step 1: Crea il componente**

Crea `src/components/VoiceDictationButton.tsx`:

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { Mic, MicOff } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SpeechRecognitionResultEvent {
  resultIndex: number
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

interface SpeechRecognitionErrorEvent {
  error: string
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionLike
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

interface VoiceDictationButtonProps {
  onTranscript: (chunk: string) => void
  className?: string
}

export function VoiceDictationButton({ onTranscript, className }: VoiceDictationButtonProps) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const onTranscriptRef = useRef(onTranscript)
  onTranscriptRef.current = onTranscript

  useEffect(() => {
    setSupported(getSpeechRecognitionConstructor() !== null)
  }, [])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  function stop() {
    recognitionRef.current?.stop()
  }

  function start() {
    const Constructor = getSpeechRecognitionConstructor()
    if (!Constructor) return

    const recognition = new Constructor()
    recognition.lang = "it-IT"
    recognition.continuous = true
    recognition.interimResults = false

    recognition.onresult = (event) => {
      // In modalita' continuous ogni evento porta solo le frasi nuove
      // riconosciute da resultIndex in poi: leggere l'intero event.results
      // ogni volta duplicherebbe le frasi gia' accodate in precedenza.
      const chunks: string[] = []
      for (let i = event.resultIndex; i < event.results.length; i++) {
        chunks.push(event.results[i][0].transcript)
      }
      const transcript = chunks.join(" ").trim()
      if (transcript) onTranscriptRef.current(transcript)
    }
    recognition.onerror = (event) => {
      if (event.error === "not-allowed") setPermissionDenied(true)
      setListening(false)
    }
    recognition.onend = () => setListening(false)

    recognitionRef.current = recognition
    setPermissionDenied(false)
    setListening(true)
    recognition.start()
  }

  if (!supported) return null

  return (
    <div className="inline-flex flex-col items-start gap-0.5">
      <button
        type="button"
        onClick={() => (listening ? stop() : start())}
        aria-label={listening ? "Ferma dettatura" : "Avvia dettatura"}
        aria-pressed={listening}
        className={cn(
          buttonVariants({ variant: listening ? "destructive" : "outline", size: "icon-sm" }),
          className
        )}
      >
        {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
      </button>
      {permissionDenied && <span className="text-xs text-destructive">Permesso microfono negato</span>}
    </div>
  )
}
```

Nota sul `onTranscriptRef`: la sessione di ascolto (`recognition.onresult`) resta attiva per più frasi consecutive; usare un ref per `onTranscript` invece di chiuderlo direttamente nella closure di `start()` garantisce che, se il componente si ri-renderizza con una nuova funzione `onTranscript` mentre si sta ancora ascoltando, venga comunque chiamata la versione più recente.

- [x] **Step 2: Verifica i tipi**

Run: `npx tsc --noEmit`
Expected: nessun errore relativo a `VoiceDictationButton.tsx`

- [x] **Step 3: Commit**

```bash
git add src/components/VoiceDictationButton.tsx
git commit -m "$(cat <<'EOF'
feat: aggiunge il componente VoiceDictationButton

Pulsante microfono riutilizzabile che usa la Web Speech API nativa
del browser (gratuita) per trascrivere la dettatura vocale in testo,
frase per frase. Si nasconde da solo sui browser che non supportano
l'API (es. Firefox). Non ancora collegato a nessun campo del form.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Collega la dettatura al campo "Testo da scrivere" (riga articolo)

**Files:**
- Modify: `src/components/OrderForm.tsx`

- [x] **Step 1: Aggiungi gli import necessari**

In `src/components/OrderForm.tsx`, trova l'import esistente:

```ts
import { computeOrderSummary, type OrderItemInput } from "@/lib/orderItems"
```

Aggiungi subito dopo:

```ts
import { appendDictatedText } from "@/lib/dictation"
import { VoiceDictationButton } from "@/components/VoiceDictationButton"
```

- [x] **Step 2: Estendi `updateItem` per accettare un aggiornamento funzionale**

Trova (circa riga 145-147):

```ts
  function updateItem(id: number, field: keyof Omit<ItemRow, "id">, value: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)))
  }
```

Sostituisci con:

```ts
  function updateItem(
    id: number,
    field: keyof Omit<ItemRow, "id">,
    value: string | ((prev: string) => string)
  ) {
    // Il valore puo' essere una funzione: serve per la dettatura vocale, dove
    // ogni frase riconosciuta deve accodarsi al testo piu' recente e non a
    // quello catturato nella closure al momento in cui l'ascolto e' partito.
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? { ...it, [field]: typeof value === "function" ? value(it[field]) : value }
          : it
      )
    )
  }
```

- [x] **Step 3: Aggiungi il pulsante accanto al campo "Testo da scrivere"**

Trova (circa riga 417-423):

```tsx
              <Textarea
                rows={2}
                autoComplete="off"
                value={item.testoDaScrivere}
                onChange={(e) => updateItem(item.id, "testoDaScrivere", e.target.value)}
                placeholder="Testo da scrivere / incidere / stampare"
              />
```

Sostituisci con:

```tsx
              <div className="flex items-start gap-2">
                <Textarea
                  rows={2}
                  autoComplete="off"
                  value={item.testoDaScrivere}
                  onChange={(e) => updateItem(item.id, "testoDaScrivere", e.target.value)}
                  placeholder="Testo da scrivere / incidere / stampare"
                  className="flex-1"
                />
                <VoiceDictationButton
                  onTranscript={(chunk) =>
                    updateItem(item.id, "testoDaScrivere", (prev) => appendDictatedText(prev, chunk))
                  }
                />
              </div>
```

- [x] **Step 4: Verifica i tipi e la suite esistente**

Run: `npx tsc --noEmit`
Expected: nessun errore

Run: `npx jest --roots=src`
Expected: tutti i test esistenti ancora verdi (nessun test copre `OrderForm.tsx` direttamente, nessuna regressione attesa)

- [x] **Step 5: Commit**

```bash
git add src/components/OrderForm.tsx
git commit -m "$(cat <<'EOF'
feat: aggiunge la dettatura vocale al campo Testo da scrivere

Ogni riga articolo ha ora un pulsante microfono accanto al campo
"Testo da scrivere / incidere / stampare". updateItem accetta anche
un aggiornamento funzionale per evitare di perdere frasi quando la
dettatura riconosce piu' frasi nella stessa sessione di ascolto.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Collega la dettatura al campo "Note interne"

**Files:**
- Modify: `src/components/OrderForm.tsx`

- [x] **Step 1: Aggiungi un ref per il campo Note**

Trova (circa riga 137):

```ts
  const nextItemId = useRef(items.length)
```

Aggiungi subito dopo:

```ts
  const noteRef = useRef<HTMLTextAreaElement>(null)
```

- [x] **Step 2: Collega il pulsante al campo, leggendo/scrivendo il ref**

Il campo "Note interne" non e' controllato da React state (il valore viene letto solo al submit tramite `FormData`), quindi la dettatura scrive direttamente sul DOM tramite il ref invece di passare da uno state.

Trova (circa riga 590-592):

```tsx
        <div>
          <Textarea id="note" name="note" rows={2} aria-label="Note interne" defaultValue={order?.note ?? ""} />
        </div>
```

Sostituisci con:

```tsx
        <div className="flex items-start gap-2">
          <Textarea
            id="note"
            name="note"
            rows={2}
            aria-label="Note interne"
            defaultValue={order?.note ?? ""}
            ref={noteRef}
            className="flex-1"
          />
          <VoiceDictationButton
            onTranscript={(chunk) => {
              if (!noteRef.current) return
              noteRef.current.value = appendDictatedText(noteRef.current.value, chunk)
            }}
          />
        </div>
```

- [x] **Step 3: Verifica i tipi e la suite esistente**

Run: `npx tsc --noEmit`
Expected: nessun errore

Run: `npx jest --roots=src`
Expected: tutti i test esistenti ancora verdi

- [x] **Step 4: Commit**

```bash
git add src/components/OrderForm.tsx
git commit -m "$(cat <<'EOF'
feat: aggiunge la dettatura vocale al campo Note interne

Il campo non e' controllato da React state (valore letto solo al
submit via FormData), quindi la dettatura scrive direttamente sul
DOM tramite un ref invece che tramite uno state.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Collega la dettatura al campo "Cosa ricordare…" (Agenda)

**Files:**
- Modify: `src/components/ReminderForm.tsx`

- [x] **Step 1: Aggiungi gli import necessari**

Trova la riga 3:

```ts
import { useActionState, useEffect } from "react"
```

Sostituisci con:

```ts
import { useActionState, useEffect, useRef } from "react"
```

Trova la riga 8 (`import { ErrorMessage } from "@/components/ErrorMessage"`) e aggiungi subito dopo:

```ts
import { appendDictatedText } from "@/lib/dictation"
import { VoiceDictationButton } from "@/components/VoiceDictationButton"
```

- [x] **Step 2: Aggiungi il ref per il campo**

Trova (riga 11-12):

```ts
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(addReminderAction, { error: null })
```

Aggiungi subito dopo:

```ts
  const titleInputRef = useRef<HTMLInputElement>(null)
```

- [x] **Step 3: Collega il pulsante al campo**

Il campo "Cosa ricordare…" e' dentro un `<form>` con `key={state.ts ?? 0}` che si rimonta dopo ogni invio per pulire i campi non controllati — il ref si riaggancia da solo al nuovo elemento quando questo accade, nessuna gestione aggiuntiva necessaria.

Trova (riga 23-30):

```tsx
      <div className="flex-1 min-w-40">
        <Input
          name="title"
          required
          placeholder="Cosa ricordare…"
          autoComplete="off"
        />
      </div>
```

Sostituisci con:

```tsx
      <div className="flex-1 min-w-40 flex items-center gap-2">
        <Input
          ref={titleInputRef}
          name="title"
          required
          placeholder="Cosa ricordare…"
          autoComplete="off"
          className="flex-1"
        />
        <VoiceDictationButton
          onTranscript={(chunk) => {
            if (!titleInputRef.current) return
            titleInputRef.current.value = appendDictatedText(titleInputRef.current.value, chunk)
          }}
        />
      </div>
```

- [x] **Step 4: Verifica i tipi e la suite esistente**

Run: `npx tsc --noEmit`
Expected: nessun errore

Run: `npx jest --roots=src`
Expected: tutti i test esistenti ancora verdi

- [x] **Step 5: Commit**

```bash
git add src/components/ReminderForm.tsx
git commit -m "$(cat <<'EOF'
feat: aggiunge la dettatura vocale al campo Cosa ricordare

Stesso pattern gia' usato per Note interne: campo non controllato,
il ref si riaggancia da solo al remount del form dopo ogni invio.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Verifica automatica finale

**Files:** nessuno (solo comandi di verifica)

- [x] **Step 1: Suite completa**

Run: `npx jest --roots=src`
Expected: PASS — tutti i test esistenti piu' i 6 nuovi di `dictation.test.ts` (146 + 6 = 152 test attesi, verificare il conteggio esatto stampato dal comando invece di fidarsi di questo numero)

Risultato reale: 17 suite / 152 test verdi.

- [x] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: nessun errore

Risultato reale: pulito.

- [x] **Step 3: Build di produzione**

Run: `npm run build`
Expected: build completata senza errori (verifica che il nuovo componente client non rompa il bundling)

Risultato reale: build completata senza errori.

Non committare nulla in questo task se i tre comandi sopra passano senza modifiche al codice: è solo una verifica. Se un comando fallisce, risolvi il problema nel file coinvolto e ripeti la verifica prima di procedere.

---

## Dopo l'implementazione (fuori da questo piano)

Questi comandi automatici **non possono verificare che la dettatura funzioni davvero**: `SpeechRecognition` richiede un microfono reale e l'ambiente qui non ne ha uno. Prima di considerare la funzione pronta all'uso e prima di aggiornare `CLAUDE.md`, va fatta una verifica manuale reale, coerente con come sono state verificate le altre feature UI-only di questo progetto:

1. Aprire `/orders/new` su Chrome desktop, cliccare il microfono su "Note interne" e su "Testo da scrivere" di una riga articolo, dettare una frase breve, controllare che il testo compaia accodato correttamente.
2. Aprire `/agenda`, cliccare il microfono su "Cosa ricordare…", dettare, controllare il testo e poi salvare il promemoria per confermare che il valore dettato venga davvero inviato (dato che il campo non e' controllato da React state).
3. Ripetere gli stessi controlli su un tablet Android (stesso dispositivo gia' usato per verificare la stampa etichetta).
4. Negare il permesso del microfono quando richiesto dal browser e controllare che compaia il messaggio "Permesso microfono negato".
5. Se disponibile un browser senza supporto (es. Firefox), controllare che il pulsante non compaia affatto.

Solo dopo questa verifica manuale, aggiungere una riga a `CLAUDE.md` (tabella "Decisioni chiave e motivazioni" + bullet "Testing") con la data reale e l'esito, seguendo lo stesso stile usato per le feature precedenti — non prima, per non descrivere nel documento uno stato non ancora confermato.
