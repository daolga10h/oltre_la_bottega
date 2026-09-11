# Ordini in attesa di pagamento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nuova pagina `/pagamenti` che elenca gli ordini consegnati con saldo ancora da incassare, con una voce di menu dedicata "Da incassare" in sidebar e bottom nav.

**Architecture:** Pagina server component che riusa `getOrders({ status: "consegnato" })` e filtra in memoria su `saldo > 0`, stessa struttura già in uso in `/recensioni`. Nessuna migration, nessun nuovo server action, nessuna modifica a Bacheca/Ordini/Dashboard.

**Tech Stack:** Next.js App Router (Server Component), TypeScript, Tailwind CSS, lucide-react.

**Full design reference:** `docs/superpowers/specs/2026-09-10-pagamenti-in-sospeso-design.md`

---

### Task 1: Creare la pagina `/pagamenti`

**Files:**
- Create: `src/app/(dashboard)/pagamenti/page.tsx`

Nessun test automatico (nessuna infrastruttura di test per pagine in questo codebase, stessa convenzione già seguita per `/recensioni`) — verificato manualmente al Task 3.

- [ ] **Step 1: Creare il file della pagina**

```tsx
import { getOrders } from "@/actions/orders"
import { toUserMessage } from "@/lib/errors"
import { ErrorMessage } from "@/components/ErrorMessage"
import { formatDate, formatEUR, buildClientDisplayName, buildWhatsAppLink, cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { getShopName } from "@/lib/shop-name"
import { MessageCircle } from "lucide-react"
import Link from "next/link"

export default async function PagamentiPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const shopName = getShopName(user)

  let orders: Awaited<ReturnType<typeof getOrders>> = []
  let errorMsg: string | null = null

  try {
    const all = await getOrders({ status: "consegnato" })
    orders = all
      .filter((o) => o.saldo > 0)
      .sort((a, b) => {
        const da = a.data_consegnato ? new Date(a.data_consegnato).getTime() : 0
        const db = b.data_consegnato ? new Date(b.data_consegnato).getTime() : 0
        return da - db
      })
  } catch (err) {
    errorMsg = toUserMessage(err)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">In attesa di pagamento</h1>

      {errorMsg && <ErrorMessage message={errorMsg} />}

      {orders.length === 0 && !errorMsg && (
        <p className="text-muted-foreground text-sm">Nessun pagamento in sospeso.</p>
      )}

      {orders.length > 0 && (
        <div className="bg-card rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-background">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Data consegnato</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Saldo da incassare</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const clientName = buildClientDisplayName(o.nome, o.cognome, o.azienda)
                const waLink = buildWhatsAppLink(
                  o.telefono,
                  `Ciao ${o.nome}! Qui è ${shopName} 🙂 Ti ricordiamo che il saldo di €${formatEUR(o.saldo)} per il tuo ordine è ancora da saldare. Grazie!`
                )
                return (
                  <tr key={o.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <Link href={`/orders/${o.id}`} className="font-bold hover:underline">
                        {clientName}
                      </Link>
                      {o.referente && (
                        <p className="text-xs text-muted-foreground">Ref. {o.referente}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {o.data_consegnato ? formatDate(o.data_consegnato) : "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gold">€{formatEUR(o.saldo)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
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
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Eseguire il type checker**

Run: `npx tsc --noEmit`
Expected: nessun errore riferito a `src/app/(dashboard)/pagamenti/page.tsx`

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/pagamenti/page.tsx"
git commit -m "feat: aggiunge la pagina /pagamenti per gli ordini in attesa di pagamento"
```

---

### Task 2: Aggiungere la voce di menu "Da incassare"

**Files:**
- Modify: `src/components/nav/Sidebar.tsx`
- Modify: `src/components/nav/BottomNav.tsx`

- [ ] **Step 1: Aggiungere la voce in `Sidebar.tsx`**

Sostituire l'import delle icone:
```typescript
import { LayoutDashboard, ShoppingBag, Users, Calendar, LayoutGrid, Star, Settings } from "lucide-react"
```
con:
```typescript
import { LayoutDashboard, ShoppingBag, Users, Calendar, LayoutGrid, Star, Settings, Euro } from "lucide-react"
```

Sostituire `managementLinks`:
```typescript
const managementLinks = [
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/recensioni", label: "Recensioni", icon: Star },
  { href: "/customers", label: "Clienti", icon: Users },
  { href: "/impostazioni", label: "Impostazioni", icon: Settings },
]
```
con:
```typescript
const managementLinks = [
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/recensioni", label: "Recensioni", icon: Star },
  { href: "/pagamenti", label: "Da incassare", icon: Euro },
  { href: "/customers", label: "Clienti", icon: Users },
  { href: "/impostazioni", label: "Impostazioni", icon: Settings },
]
```

- [ ] **Step 2: Aggiungere la voce in `BottomNav.tsx`**

Sostituire l'import delle icone:
```typescript
import { LayoutDashboard, ShoppingBag, Users, Calendar, LayoutGrid, Star } from "lucide-react"
```
con:
```typescript
import { LayoutDashboard, ShoppingBag, Users, Calendar, LayoutGrid, Star, Euro } from "lucide-react"
```

Sostituire `links`:
```typescript
const links = [
  { href: "/dashboard", label: "Oggi", icon: LayoutDashboard },
  { href: "/kanban", label: "Bacheca", icon: LayoutGrid },
  { href: "/orders", label: "Ordini", icon: ShoppingBag },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/recensioni", label: "Recensioni", icon: Star },
  { href: "/customers", label: "Clienti", icon: Users },
]
```
con:
```typescript
const links = [
  { href: "/dashboard", label: "Oggi", icon: LayoutDashboard },
  { href: "/kanban", label: "Bacheca", icon: LayoutGrid },
  { href: "/orders", label: "Ordini", icon: ShoppingBag },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/recensioni", label: "Recensioni", icon: Star },
  { href: "/pagamenti", label: "Da incassare", icon: Euro },
  { href: "/customers", label: "Clienti", icon: Users },
]
```

- [ ] **Step 3: Eseguire il type checker**

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 4: Commit**

```bash
git add src/components/nav/Sidebar.tsx src/components/nav/BottomNav.tsx
git commit -m "feat: aggiunge la voce di menu \"Da incassare\" in sidebar e bottom nav"
```

---

### Task 3: Verifica finale e aggiornamento `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Eseguire l'intera suite di test unitari**

Run: `npx jest --roots=src`
Expected: PASS, stesso numero di suite/test di prima (nessun test aggiunto o rimosso — nessuna infrastruttura di test per pagine/nav in questo codebase)

- [ ] **Step 2: Eseguire il type checker sull'intero progetto**

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 3: Verifica manuale nel browser**

Run: `npm run dev`, poi:
1. Aprire `/pagamenti` con l'app senza ordini consegnati con saldo residuo — controllare che appaia "Nessun pagamento in sospeso."
2. Creare un ordine, segnarlo "Consegnato" (via Bacheca o scheda) lasciando un acconto inferiore al prezzo (saldo > 0) — controllare che l'ordine compaia in `/pagamenti` con nome cliente, data di consegna effettiva, saldo corretto in euro
3. Controllare che il bottone "Chiedi su WhatsApp" apra `wa.me` con messaggio precompilato corretto (nome cliente, nome bottega, importo) se il telefono è presente
4. Cliccare "Scheda", andare in "Modifica", alzare l'acconto fino a pareggiare il prezzo, salvare — tornare su `/pagamenti` e controllare che l'ordine sia sparito
5. Creare un secondo ordine ente (con "È un ente/azienda" attivo e un Referente) consegnato con saldo residuo — controllare che in `/pagamenti` compaia il nome dell'ente e la riga "Ref. {referente}" sotto
6. Creare due ordini consegnati con saldo residuo e date di consegna diverse — controllare che il più vecchio compaia in cima alla lista
7. Controllare che la voce di menu "Da incassare" (icona Euro) compaia sia nella sidebar desktop sia nella barra in basso su una finestra ridotta/mobile, e che porti a `/pagamenti`
8. Fermare il server di sviluppo (Ctrl+C)

- [ ] **Step 4: Aggiornare `CLAUDE.md`**

Aggiungere questa riga alla tabella "Decisioni chiave e motivazioni", dopo la riga su "Niente pipeline recensione per gli ordini ente" (l'ultima riga della tabella):

```markdown
| Pagina dedicata "Da incassare" (`/pagamenti`) per gli ordini consegnati con saldo residuo (2026-09-10/11) | Alcuni ordini non si chiudono davvero con la consegna — restano da incassare, ma oggi un ordine "consegnato" sparisce da Ordini/Bacheca senza lasciare traccia del saldo pendente da nessuna parte. Nessuna migration: un ordine è "da incassare" quando `status === "consegnato"` e `saldo > 0` (campi già esistenti), derivato al volo e mai salvato — sparisce da solo quando il saldo torna a zero. Stessa struttura già rodata di `/recensioni` (tabella, bottone "Chiedi su WhatsApp" con messaggio precompilato, link "Scheda"), ordinata dai consegnati più vecchi. Prima idea scartata: una sesta colonna nella Bacheca — avrebbe reso le colonne più strette e avrebbe richiesto anche un redesign della navigazione (menu laterale spostato in alto) solo per far spazio, cambiamento grande rimandato a un ipotetico progetto separato in backlog. Nuova voce di menu "Da incassare" (icona Euro) sia in sidebar sia in bottom nav (7 voci), senza contatore — si consulta quando serve, non richiama l'attenzione ogni volta. Design in `docs/superpowers/specs/2026-09-10-pagamenti-in-sospeso-design.md`, piano in `docs/superpowers/plans/2026-09-10-pagamenti-in-sospeso-plan.md` |
```

Poi aggiungere questo bullet alla sezione `## Testing`, dopo il bullet "Feature (2026-09-10): backup email da settimanale a giornaliero":

```markdown
- **Feature (2026-09-10/11)**: pagina "Da incassare" per gli ordini in attesa di pagamento — vedere riga corrispondente in Decisioni chiave. Nuova pagina `src/app/(dashboard)/pagamenti/page.tsx` (query `getOrders({ status: "consegnato" })` filtrata in memoria su `saldo > 0`, ordinata per `data_consegnato` crescente), nuova voce di menu in `Sidebar.tsx`/`BottomNav.tsx`. Nessuna migration, nessun nuovo server action, nessuna infrastruttura di test per pagine in questo codebase (stessa convenzione di `/recensioni`) — verificato manualmente nel browser: ordine consegnato con saldo residuo compare nell'elenco con dati corretti, link WhatsApp precompilato, sparisce dopo aver azzerato il saldo, ordinamento per data di consegna effettiva, ordine ente mostra la riga "Ref.". Design in `docs/superpowers/specs/2026-09-10-pagamenti-in-sospeso-design.md`, piano in `docs/superpowers/plans/2026-09-10-pagamenti-in-sospeso-plan.md`.
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: documenta la pagina /pagamenti in CLAUDE.md"
```
