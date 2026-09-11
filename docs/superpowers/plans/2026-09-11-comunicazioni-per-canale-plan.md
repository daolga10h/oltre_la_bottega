# Comunicazioni per canale d'arrivo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per gli ordini con `canale === "mail"`, ogni azione di contatto rapido nell'app (Avvisa cliente, Chiedi recensione, Chiedi saldo) usa solo email, mai WhatsApp — anche se il cliente ha un telefono salvato. Per tutti gli altri canali, nessun cambiamento.

**Architecture:** Tre modifiche indipendenti e localizzate, una per punto di contatto esistente. Nessun helper nuovo (`buildMailtoLink`/`buildWhatsAppLink` esistono già), nessuna migration, nessun nuovo server action.

**Tech Stack:** Next.js App Router (Server Components), TypeScript.

**Full design reference:** `docs/superpowers/specs/2026-09-11-comunicazioni-per-canale-design.md`

---

### Task 1: "Avvisa il cliente" (scheda ordine) rispetta il canale mail

**Files:**
- Modify: `src/app/(dashboard)/orders/[id]/page.tsx`

- [ ] **Step 1: Non calcolare il link WhatsApp quando il canale è "mail"**

Sostituire:
```tsx
        const waLink = buildWhatsAppLink(
          order.telefono,
          `Ciao ${order.nome}! Il tuo ordine (${order.cosa_ordinato}) è pronto per il ritiro da ${shopName}. Ti aspettiamo! 🙂`
        )
```
con:
```tsx
        const waLink = order.canale === "mail" ? null : buildWhatsAppLink(
          order.telefono,
          `Ciao ${order.nome}! Il tuo ordine (${order.cosa_ordinato}) è pronto per il ritiro da ${shopName}. Ti aspettiamo! 🙂`
        )
```

Nessun altro cambiamento: il resto del blocco (link email, JSX) resta identico — `waLink` sarà semplicemente `null` per un ordine "mail", e il bottone WhatsApp non verrà renderizzato per via del già esistente `{waLink && (...)}`.

- [ ] **Step 2: Eseguire il type checker**

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/orders/[id]/page.tsx"
git commit -m "feat: nasconde il link WhatsApp in \"Avvisa il cliente\" per ordini con canale mail"
```

---

### Task 2: "Chiedi su WhatsApp" in Recensioni diventa email per canale mail

**Files:**
- Modify: `src/app/(dashboard)/recensioni/page.tsx`

- [ ] **Step 1: Aggiungere gli import necessari**

Sostituire:
```tsx
import { formatDate, buildWhatsAppLink } from "@/lib/utils"
```
con:
```tsx
import { formatDate, buildWhatsAppLink, buildMailtoLink } from "@/lib/utils"
```

Sostituire:
```tsx
import { MessageCircle } from "lucide-react"
```
con:
```tsx
import { MessageCircle, Mail } from "lucide-react"
```

- [ ] **Step 2: Sostituire il bottone con la logica per canale**

Sostituire:
```tsx
                        {(() => {
                          const waLink = buildWhatsAppLink(
                            o.telefono,
                            `Ciao ${o.nome}! Qui è ${shopName} 🙂 Se hai un minuto, ci farebbe molto piacere ricevere una tua recensione. Grazie mille!`
                          )
                          return waLink ? (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                buttonVariants({ variant: "outline", size: "sm" }),
                                "w-full text-xs inline-flex items-center justify-center gap-1"
                              )}
                            >
                              <MessageCircle className="w-3 h-3" />Chiedi su WhatsApp
                            </a>
                          ) : null
                        })()}
```
con:
```tsx
                        {(() => {
                          const messaggio = `Ciao ${o.nome}! Qui è ${shopName} 🙂 Se hai un minuto, ci farebbe molto piacere ricevere una tua recensione. Grazie mille!`
                          if (o.canale === "mail") {
                            const mailLink = buildMailtoLink(o.email_cliente, "La tua opinione conta per noi", messaggio)
                            return mailLink ? (
                              <a
                                href={mailLink}
                                className={cn(
                                  buttonVariants({ variant: "outline", size: "sm" }),
                                  "w-full text-xs inline-flex items-center justify-center gap-1"
                                )}
                              >
                                <Mail className="w-3 h-3" />Chiedi via email
                              </a>
                            ) : null
                          }
                          const waLink = buildWhatsAppLink(o.telefono, messaggio)
                          return waLink ? (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                buttonVariants({ variant: "outline", size: "sm" }),
                                "w-full text-xs inline-flex items-center justify-center gap-1"
                              )}
                            >
                              <MessageCircle className="w-3 h-3" />Chiedi su WhatsApp
                            </a>
                          ) : null
                        })()}
```

- [ ] **Step 3: Eseguire il type checker**

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/recensioni/page.tsx"
git commit -m "feat: sostituisce il bottone WhatsApp con email per canale mail in Recensioni"
```

---

### Task 3: "Chiedi su WhatsApp" in Da incassare diventa email per canale mail

**Files:**
- Modify: `src/app/(dashboard)/pagamenti/page.tsx`

- [ ] **Step 1: Aggiungere gli import necessari**

Sostituire:
```tsx
import { formatDate, formatEUR, buildClientDisplayName, buildWhatsAppLink, cn } from "@/lib/utils"
```
con:
```tsx
import { formatDate, formatEUR, buildClientDisplayName, buildWhatsAppLink, buildMailtoLink, cn } from "@/lib/utils"
```

Sostituire:
```tsx
import { MessageCircle } from "lucide-react"
```
con:
```tsx
import { MessageCircle, Mail } from "lucide-react"
```

- [ ] **Step 2: Calcolare `waLink`/`mailLink` in base al canale e aggiungere il bottone email**

Sostituire:
```tsx
                const clientName = buildClientDisplayName(o.nome, o.cognome, o.azienda)
                const waLink = buildWhatsAppLink(
                  o.telefono,
                  `Ciao ${o.nome}! Qui è ${shopName} 🙂 Ti ricordiamo che il saldo di €${formatEUR(o.saldo)} per il tuo ordine è ancora da saldare. Grazie!`
                )
```
con:
```tsx
                const clientName = buildClientDisplayName(o.nome, o.cognome, o.azienda)
                const messaggio = `Ciao ${o.nome}! Qui è ${shopName} 🙂 Ti ricordiamo che il saldo di €${formatEUR(o.saldo)} per il tuo ordine è ancora da saldare. Grazie!`
                const waLink = o.canale === "mail" ? null : buildWhatsAppLink(o.telefono, messaggio)
                const mailLink = o.canale === "mail" ? buildMailtoLink(o.email_cliente, `Saldo in sospeso — ${shopName}`, messaggio) : null
```

Poi sostituire:
```tsx
                        {waLink && (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                              "w-full text-xs inline-flex items-center justify-center gap-1"
                            )}
                          >
                            <MessageCircle className="w-3 h-3" />Chiedi su WhatsApp
                          </a>
                        )}
                        <Link
                          href={`/orders/${o.id}`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full text-xs")}
                        >
                          Scheda
                        </Link>
```
con:
```tsx
                        {waLink && (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                              "w-full text-xs inline-flex items-center justify-center gap-1"
                            )}
                          >
                            <MessageCircle className="w-3 h-3" />Chiedi su WhatsApp
                          </a>
                        )}
                        {mailLink && (
                          <a
                            href={mailLink}
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                              "w-full text-xs inline-flex items-center justify-center gap-1"
                            )}
                          >
                            <Mail className="w-3 h-3" />Chiedi via email
                          </a>
                        )}
                        <Link
                          href={`/orders/${o.id}`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full text-xs")}
                        >
                          Scheda
                        </Link>
```

- [ ] **Step 3: Eseguire il type checker**

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/pagamenti/page.tsx"
git commit -m "feat: sostituisce il bottone WhatsApp con email per canale mail in Da incassare"
```

---

### Task 4: Verifica finale e aggiornamento `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Eseguire l'intera suite di test unitari**

Run: `npx jest --roots=src`
Expected: PASS, stesso numero di suite/test di prima (nessun test aggiunto o rimosso)

- [ ] **Step 2: Eseguire il type checker sull'intero progetto**

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 3: Verifica manuale nel browser**

Run: `npm run dev`, poi:
1. Creare un ordine con canale "mail", telefono ed email entrambi presenti, portarlo a "Pronto" — in scheda ordine, "Avvisa il cliente" deve mostrare solo il bottone Email, non WhatsApp
2. Segnare lo stesso ordine come consegnato con "Chiedere recensione" attivo — in `/recensioni` deve comparire "Chiedi via email" (non "Chiedi su WhatsApp"), che apre un client di posta con oggetto "La tua opinione conta per noi" e il messaggio corretto
3. Creare un ordine con canale "mail", saldo residuo dopo la consegna — in `/pagamenti` deve comparire "Chiedi via email" (non "Chiedi su WhatsApp"), oggetto "Saldo in sospeso — {nome bottega}"
4. Creare un ordine con canale "mail" ma senza email salvata (solo telefono) — in tutti e tre i punti non deve comparire nessun bottone di contatto rapido
5. Creare un ordine con un canale diverso da "mail" (es. "telefono"), con telefono ed email entrambi presenti — controllare che il comportamento sia identico a prima di questa modifica: "Avvisa il cliente" mostra entrambi i link, Recensioni e Da incassare mostrano "Chiedi su WhatsApp"
6. Fermare il server di sviluppo (Ctrl+C)

- [ ] **Step 4: Aggiornare `CLAUDE.md`**

Aggiungere questa riga alla tabella "Decisioni chiave e motivazioni", dopo la riga su "Pagina stampabile 'Riepilogo'" (l'ultima riga della tabella):

```markdown
| Le comunicazioni rispettano il canale "mail" (2026-09-11) | Richiesta esplicita dell'utente: un ordine arrivato per email (`canale: "mail"`) deve ricevere ogni comunicazione via email, mai WhatsApp — anche se il cliente ha anche un telefono salvato. Non è una generalizzazione della regola opposta già in vigore per "Avvisa il cliente" (mostrare sempre entrambi i link indipendentemente dal canale, per evitare falsi negativi quando il canale non riflette i contatti realmente disponibili) — è una restrizione più specifica, richiesta solo per questo canale preciso. Applicata in tre punti già esistenti, nessuna migration, nessun nuovo helper (`buildMailtoLink`/`buildWhatsAppLink` già esistenti): "Avvisa il cliente" in scheda ordine (il link WhatsApp non viene più calcolato per canale mail), "Chiedi su WhatsApp" in Recensioni e in "Da incassare" (diventa "Chiedi via email" per canale mail, stesso testo del messaggio). Se un ordine ha canale "mail" ma manca l'email salvata, non compare nessun bottone di contatto in nessuno dei tre punti — nessun ripiego automatico su WhatsApp, per non violare silenziosamente la regola. Design in `docs/superpowers/specs/2026-09-11-comunicazioni-per-canale-design.md`, piano in `docs/superpowers/plans/2026-09-11-comunicazioni-per-canale-plan.md` |
```

Poi aggiungere questo bullet alla sezione `## Testing`, dopo il bullet "Feature (2026-09-11): pagina stampabile 'Riepilogo'":

```markdown
- **Feature (2026-09-11)**: le comunicazioni rispettano il canale "mail" — vedere riga corrispondente in Decisioni chiave. Modifiche localizzate in tre punti esistenti: `orders/[id]/page.tsx` ("Avvisa il cliente", il link WhatsApp non viene calcolato per canale mail), `recensioni/page.tsx` e `pagamenti/page.tsx` (il bottone "Chiedi su WhatsApp" diventa "Chiedi via email" per canale mail, via `buildMailtoLink` già esistente). Nessuna migration, nessun nuovo server action, nessuna infrastruttura di test per pagine in questo codebase — verificato manualmente nel browser: canale mail con telefono+email mostra solo email in tutti e tre i punti, canale mail senza email non mostra nessun bottone, ogni altro canale resta invariato. Design in `docs/superpowers/specs/2026-09-11-comunicazioni-per-canale-design.md`, piano in `docs/superpowers/plans/2026-09-11-comunicazioni-per-canale-plan.md`.
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: documenta le comunicazioni per canale mail in CLAUDE.md"
```
