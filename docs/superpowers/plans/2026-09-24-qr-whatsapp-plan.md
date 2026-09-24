# QR WhatsApp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nei riquadri "Avvisa il cliente" e "Invia anteprima" della scheda ordine, un bottone "QR" mostra il QR del link `wa.me` (da inquadrare col telefono) e un bottone "Fatto" segna l'invio.

**Architecture:** Un nuovo componente client `WhatsAppQr` (stato locale aperto/fatto, QR via `qrcode.react` già presente) inserito da `NotifyReadyLinks` e `SendPreviewLinks`, che gli passano il proprio `waLink` e il proprio `handleClick` come `onDone`. Nessuna modifica a `page.tsx`, nessun server action nuovo.

**Tech Stack:** React client components, `qrcode.react` (già dipendenza), `lucide-react`, componente `Button` di `@/components/ui/button`.

Spec: `docs/superpowers/specs/2026-09-24-qr-whatsapp-design.md`.

Nota: nessuna unità pura testabile con Jest e nessuna infrastruttura di test per componenti in questo codebase (convenzione consolidata): "test" per i task 1-2 = `npx tsc --noEmit` + `npx jest --roots=src` invariati; verifica reale nel task 3.

---

### Task 1: Componente `WhatsAppQr`

**Files:**
- Create: `src/components/WhatsAppQr.tsx`

- [ ] **Step 1: Creare il componente**

```tsx
"use client"

import { useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import { QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"

interface WhatsAppQrProps {
  waLink: string | null
  onDone: () => void
}

export function WhatsAppQr({ waLink, onDone }: WhatsAppQrProps) {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)

  if (!waLink) return null

  function handleDone() {
    setDone(true)
    onDone()
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="bg-card" onClick={() => setOpen((o) => !o)}>
        <QrCode className="w-3.5 h-3.5" />QR
      </Button>
      {open && (
        <div className="basis-full flex flex-wrap items-center gap-4 pt-2">
          <div className="bg-white p-3 rounded-lg border border-border">
            <QRCodeSVG value={waLink} size={132} />
          </div>
          <div className="space-y-2">
            <p className="text-xs text-bark">
              Inquadralo col telefono: si apre la chat del cliente in WhatsApp con il messaggio già scritto.
            </p>
            <Button type="button" size="sm" disabled={done} onClick={handleDone}>
              Fatto
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
```

I due `useState` stanno prima del `return null` (regola degli hook). `handleDone` disattiva il bottone dopo il primo click per evitare doppie voci in cronologia.

- [ ] **Step 2: Verificare tipi e test**

Run: `npx tsc --noEmit` → nessun errore (in particolare: `QrCode` esiste in `lucide-react`; se non esiste in questa versione, usare `QrCode` → `ScanLine` e riportarlo nel report).
Run: `npx jest --roots=src` → tutte verdi (152).

- [ ] **Step 3: Commit**

```bash
git add src/components/WhatsAppQr.tsx
git commit -m "feat: aggiunge il componente WhatsAppQr"
```

---

### Task 2: Inserire `WhatsAppQr` nei due riquadri

**Files:**
- Modify: `src/components/NotifyReadyLinks.tsx`
- Modify: `src/components/SendPreviewLinks.tsx`

- [ ] **Step 1: `NotifyReadyLinks.tsx`**

Dopo `import { QuickContactLink } from "@/components/QuickContactLink"` aggiungere:

```tsx
import { WhatsAppQr } from "@/components/WhatsAppQr"
```

Nel JSX, subito dopo la riga `<QuickContactLink href={mailLink} icon={Mail} label="Email" variant="toolbar" onClick={handleClick} />` aggiungere:

```tsx
      <WhatsAppQr waLink={waLink} onDone={handleClick} />
```

- [ ] **Step 2: `SendPreviewLinks.tsx`**

Stesse due modifiche identiche (stesso import; stessa riga `<WhatsAppQr waLink={waLink} onDone={handleClick} />` dopo il `QuickContactLink` Email).

- [ ] **Step 3: Verificare**

Run: `npx tsc --noEmit` → pulito. Run: `npx jest --roots=src` → tutte verdi.
Run: `npx eslint src/components/WhatsAppQr.tsx src/components/NotifyReadyLinks.tsx src/components/SendPreviewLinks.tsx` → nessun errore/avviso.

- [ ] **Step 4: Commit**

```bash
git add src/components/NotifyReadyLinks.tsx src/components/SendPreviewLinks.tsx
git commit -m "feat: mostra il QR WhatsApp in Avvisa il cliente e Invia anteprima"
```

---

### Task 3: Verifica end-to-end e documentazione

**Files:**
- Create then delete: `e2e/tmp-qr-whatsapp.spec.ts` (mai committato)
- Modify: `CLAUDE.md`

- [ ] **Step 1: Script Playwright temporaneo**

Stesso pattern di `e2e/flusso-d-consegna.spec.ts` (auth via `getTestAuthCookies()` da `e2e/helpers/auth.ts`). Ordini di prova inseriti direttamente con un client admin Supabase (service role) sul progetto reale e SEMPRE cancellati in `afterEach` con `deleteTestOrder`. Per ogni ordine inserire anche una riga `order_items` (`quantita: 1`, `prezzo_unitario: 10`, `posizione: 0`). Nomi univoci `E2E QR Test ${Date.now()}`. Casi:
1. **Avvisa il cliente**: ordine `status: "pronto"`, `msg_pronto_inviato: false`, telefono `3331234567`, email, `canale: "telefono"`. Sulla scheda: bottone "QR" visibile; click → compare un `<svg>` del QR e il bottone "Fatto"; dopo l'apertura del QR il riquadro "Avvisa il cliente:" è ancora presente e la riga in DB ha `msg_pronto_inviato = false` (il QR non segna nulla); click su "Fatto" → riquadro sparito, `msg_pronto_inviato = true`, in `order_events` esattamente 1 evento `msg_pronto_inviato`.
2. **Invia anteprima**: ordine `status: "bozza_grafica"`, `bozza_grafica: "da_fare"`, stessi contatti. "QR" visibile, aperto non cambia la bozza; "Fatto" → `bozza_grafica = "inviata"`, riquadro sparito, 1 evento "Bozza inviata al cliente".
3. **Doppio "Fatto"**: dopo il primo click il bottone "Fatto" è disabilitato (`toBeDisabled()`) prima del refresh, oppure, se il refresh è già avvenuto, il riquadro è sparito; in ogni caso in DB c'è 1 solo evento.
4. **Nessun QR**: (a) `canale: "mail"` con telefono+email → nel riquadro c'è solo "Email", nessun bottone "QR"; (b) telefono `null` con email → nessun "QR". Usare `status: "pronto"`, `msg_pronto_inviato: false`.

Avviare il dev server come nelle feature precedenti (`webServer` della config Playwright), eseguire con `npx playwright test e2e/tmp-qr-whatsapp.spec.ts --project=chromium`.

- [ ] **Step 2: Pulizia e controllo**

Cancellare `e2e/tmp-qr-whatsapp.spec.ts`. Con una query indipendente (client admin, `ilike("nome", "E2E QR Test%")` su `orders`) confermare **zero righe residue**; cancellare a mano quelle rimaste, se ce ne sono. `git status` deve mostrare solo file previsti.

- [ ] **Step 3: CLAUDE.md**

Aggiungere in fondo alla tabella "Decisioni chiave e motivazioni" (dopo la riga "Riquadro 'Invia anteprima'…") questa riga:

```markdown
| QR WhatsApp nei riquadri "Avvisa il cliente" e "Invia anteprima" (2026-09-24) | WhatsApp limita i dispositivi collegati allo stesso account (oggi telefono principale + 2 PC: uno in magazzino per le anteprime, uno al banco), quindi i tablet in bottega non possono avere WhatsApp collegato e chi lavora da un tablet doveva spostarsi a un PC — stesso tipo di dipendenza dal dispositivo già vista con la stampa. Scartata l'API ufficiale WhatsApp Business ("no api": verifica Meta, costo a messaggio, e in genere le risposte dei clienti non arriverebbero più nell'app WhatsApp Business). Soluzione: bottone "QR" accanto ai link, solo se esiste un link WhatsApp valido (telefono presente e canale diverso da "mail"); mostra il QR del medesimo link `wa.me` col messaggio già scritto, da inquadrare col telefono principale (che funziona ovunque senza occupare posti). **Segnatura solo con "Fatto"** (scelta esplicita dell'utente, un passaggio in più ma preciso: l'app non può sapere se il messaggio è stato mandato dopo la scansione); "Fatto" esegue la stessa azione dei link (`markMsgProntoInviato` / `updateBozzaGrafica(id, "inviata")`) e si disattiva dopo il primo click. I link WhatsApp/Email di oggi continuano a segnare da soli al click. Nuovo componente client `WhatsAppQr.tsx`, `qrcode.react` già nel progetto (usato dall'etichetta di stampa), nessuna dipendenza/migration/server action nuova. Il PDF/immagine dell'anteprima resta da allegare a mano. Design in `docs/superpowers/specs/2026-09-24-qr-whatsapp-design.md`, piano in `docs/superpowers/plans/2026-09-24-qr-whatsapp-plan.md` |
```

E un bullet in "Testing" (dopo il bullet "Feature (2026-09-24): riquadro 'Invia anteprima'…") che riassuma cosa è stato costruito e l'esito REALE della verifica del Step 1 (conteggi test, casi passati, cancellazione confermata a zero righe; se qualcosa non torna, scriverlo).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: documenta il QR WhatsApp e la sua verifica end-to-end"
```
