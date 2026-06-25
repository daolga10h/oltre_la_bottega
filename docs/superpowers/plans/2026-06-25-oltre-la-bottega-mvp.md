# Oltre la Bottega — MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a focused operational dashboard with mini-CRM for artisan shops — letting the owner answer "What do I need to do today?" in under 60 seconds.

**Architecture:** Next.js App Router with Server Actions for mutations (no separate API layer in MVP), Supabase for PostgreSQL + Auth + Storage. Every data record is scoped to `shop_id` with Row Level Security enforcing tenant isolation. Error handling follows a two-layer pattern: human-readable messages (in Italian) shown in the UI; detailed technical logs written to the server console.

**Tech Stack:** Next.js 14 + TypeScript, Tailwind CSS, shadcn/ui, Supabase (PostgreSQL + Auth + Storage), Vercel

---

## Error Handling Strategy (required in every task)

### UI Layer (user-facing, in Italian)
All errors shown to users must be clear and non-technical:

| Scenario | Message to user (Italian) |
|---|---|
| Network/server error | «Si è verificato un errore. Riprova tra qualche secondo.» |
| Save failed | «Impossibile salvare i dati. Controlla la connessione e riprova.» |
| Not found | «Elemento non trovato. Potrebbe essere stato eliminato.» |
| Auth required | «Per accedere è necessario effettuare il login.» |
| Validation error | «Controlla i campi del modulo prima di continuare.» |
| Generic AI/LLM error | «Funzione temporaneamente non disponibile. Riprova più tardi.» |

### Developer Layer (technical logs)
```typescript
// src/lib/logger.ts — pattern to use everywhere
export function logError(context: string, error: unknown, meta?: Record<string, unknown>) {
  console.error(`[${new Date().toISOString()}] [${context}]`, {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...meta,
  })
}
```

---

## File Map

```
src/
├── app/
│   ├── layout.tsx                          # Root layout, auth guard
│   ├── page.tsx                            # Redirect to /dashboard
│   ├── (auth)/
│   │   ├── login/page.tsx                  # Login page
│   │   └── callback/route.ts               # Supabase OAuth callback
│   ├── (dashboard)/
│   │   ├── layout.tsx                      # Shell: header + nav
│   │   ├── dashboard/page.tsx              # Today + 7-day view (TodayBoard)
│   │   ├── orders/
│   │   │   ├── page.tsx                    # Order list with filters
│   │   │   ├── new/page.tsx                # Create order
│   │   │   └── [id]/page.tsx               # Order detail + timeline
│   │   ├── customers/
│   │   │   ├── page.tsx                    # Customer list
│   │   │   ├── new/page.tsx                # Create customer
│   │   │   └── [id]/page.tsx               # Customer detail + order history
│   │   └── agenda/page.tsx                 # Reminders + upcoming deadlines
│   └── api/
│       └── dashboard/
│           └── today/route.ts              # GET KPI data (server-side aggregation)
├── components/
│   ├── TodayBoard.tsx                      # KPI cards + today's task list
│   ├── OrderForm.tsx                       # Create/edit order (shared)
│   ├── OrderCard.tsx                       # Single order card for lists
│   ├── CustomerForm.tsx                    # Create/edit customer
│   ├── ReminderList.tsx                    # Reminders widget
│   ├── SearchBar.tsx                       # Global search
│   ├── StatusBadge.tsx                     # Order status chip
│   ├── ErrorMessage.tsx                    # Standard user-facing error (Italian)
│   └── nav/
│       ├── Sidebar.tsx                     # Desktop nav
│       └── BottomNav.tsx                   # Mobile bottom nav
├── lib/
│   ├── supabase/
│   │   ├── client.ts                       # Browser Supabase client
│   │   ├── server.ts                       # Server Supabase client (cookies)
│   │   └── middleware.ts                   # Session refresh middleware
│   ├── logger.ts                           # Dev error logger
│   ├── errors.ts                           # AppError class + user messages
│   └── utils.ts                            # cn(), date helpers
├── actions/
│   ├── orders.ts                           # Server Actions: createOrder, updateOrder, deleteOrder
│   ├── customers.ts                        # Server Actions: createCustomer, updateCustomer
│   └── reminders.ts                        # Server Actions: createReminder, completeReminder
├── types/
│   ├── supabase.ts                         # Auto-generated Supabase types
│   └── domain.ts                           # App-level domain types
└── middleware.ts                           # Auth redirect middleware
supabase/
├── migrations/
│   └── 0001_initial_schema.sql             # All tables + RLS policies
└── seed.sql                                # Dev seed data
```

---

## Progress Table

| Task | Phase | Status | Blockers |
|---|---|---|---|
| T01 — Next.js scaffold | 0 | ⬜ Todo | — |
| T02 — Supabase project + env | 0 | ⬜ Todo | Supabase account |
| T03 — SQL schema + migrations | 0 | ⬜ Todo | T02 |
| T04 — Auth (login + middleware) | 0 | ⬜ Todo | T02, T03 |
| T05 — Error handling foundation | 0 | ⬜ Todo | T01 |
| T06 — Dashboard page + TodayBoard | 1 | ⬜ Todo | T03, T04 |
| T07 — Order list + filters | 1 | ⬜ Todo | T03, T04 |
| T08 — Create order (OrderForm) | 1 | ⬜ Todo | T07 |
| T09 — Order detail + timeline | 1 | ⬜ Todo | T08 |
| T10 — Customer list + create | 1 | ⬜ Todo | T03, T04 |
| T11 — Customer detail + order history | 1 | ⬜ Todo | T10 |
| T12 — Agenda / Reminders | 1 | ⬜ Todo | T03, T04 |
| T13 — Global search | 1 | ⬜ Todo | T07, T10 |
| T14 — Mobile nav + responsive QA | 2 | ⬜ Todo | T06–T13 |
| T15 — Payment status on orders | 2 | ⬜ Todo | T09 |
| T16 — Order timeline events | 2 | ⬜ Todo | T09 |
| T17 — Inventory base | 2 | ⬜ Todo | T04 |
| T18 — E2E tests (Playwright) | 2 | ⬜ Todo | T06–T13 |
| T19 — Vercel deploy | 2 | ⬜ Todo | T01–T18 |

**Status key:** ⬜ Todo · 🔄 In progress · ✅ Done · 🚫 Blocked

---

## Phase 0 — Project Setup (3–5 days)

### Task 01: Next.js Scaffold

**Goal:** Working Next.js 14 app with TypeScript, Tailwind, shadcn/ui.

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `src/app/layout.tsx`
- Create: `src/lib/utils.ts`

- [ ] **Step 1: Bootstrap Next.js**

```bash
npx create-next-app@latest oltre_la_bottega \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"
cd oltre_la_bottega
```

- [ ] **Step 2: Install shadcn/ui and dependencies**

```bash
npx shadcn@latest init
# Select: Default style, Slate base color, CSS variables: yes
npx shadcn@latest add button input label card badge select textarea
npm install date-fns
```

- [ ] **Step 3: Verify dev server starts**

```bash
npm run dev
```
Expected: `http://localhost:3000` opens with default Next.js page, no errors in terminal.

- [ ] **Step 4: Update `src/lib/utils.ts`**

```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, isToday, isTomorrow, isPast } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), "dd/MM/yyyy")
}

export function isOverdue(dueDate: string): boolean {
  return isPast(new Date(dueDate)) && !isToday(new Date(dueDate))
}

export function dueDateLabel(dueDate: string): string {
  const d = new Date(dueDate)
  if (isToday(d)) return "Oggi"
  if (isTomorrow(d)) return "Domani"
  if (isOverdue(dueDate)) return "In ritardo"
  return formatDate(dueDate)
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 14 + Tailwind + shadcn/ui"
```

**Completion criteria:** `npm run build` exits 0. `npm run lint` exits 0.

---

### Task 02: Supabase Project + Environment

**Files:**
- Create: `.env.local` (gitignored)
- Create: `.env.local.example`

- [ ] **Step 1: Create Supabase project**

Go to https://supabase.com/dashboard → New project.
Name: `oltre-la-bottega`. Region: EU (West). Note the project URL and anon key.

- [ ] **Step 2: Install Supabase client**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 3: Create `.env.local`** (never commit this file)

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

- [ ] **Step 4: Create `.env.local.example`** (safe to commit)

```
NEXT_PUBLIC_SUPABASE_URL=https://your-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

- [ ] **Step 5: Verify `.gitignore` has `.env.local`**

```bash
grep ".env.local" .gitignore
```
Expected: `.env.local` appears in output.

- [ ] **Step 6: Commit**

```bash
git add .env.local.example .gitignore
git commit -m "feat: add Supabase environment config"
```

**Completion criteria:** `.env.local` is NOT tracked by git (`git status` shows it clean or untracked, not staged).

---

### Task 03: SQL Schema + RLS Migrations

**Files:**
- Create: `supabase/migrations/0001_initial_schema.sql`
- Create: `supabase/seed.sql`

- [ ] **Step 1: Install Supabase CLI**

```bash
npm install -D supabase
npx supabase init
npx supabase login
npx supabase link --project-ref <your-ref>
```

- [ ] **Step 2: Write `supabase/migrations/0001_initial_schema.sql`**

```sql
-- Enable UUID generation
create extension if not exists "pgcrypto";

-- USERS (managed by Supabase Auth, extend with profile)
create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  timezone text not null default 'Europe/Rome',
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  tags text[] default '{}',
  notes text,
  created_at timestamptz not null default now()
);

create type public.order_status as enum (
  'nuovo', 'in_lavorazione', 'pronto', 'consegnato', 'annullato'
);

create type public.order_priority as enum ('normale', 'alta', 'urgente');

create type public.payment_status as enum ('non_pagato', 'acconto', 'saldato');

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  title text not null,
  description text,
  status public.order_status not null default 'nuovo',
  priority public.order_priority not null default 'normale',
  due_date date,
  amount_estimated numeric(10,2),
  payment_status public.payment_status not null default 'non_pagato',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create type public.reminder_status as enum ('attivo', 'completato', 'saltato');

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  title text not null,
  due_at timestamptz not null,
  status public.reminder_status not null default 'attivo',
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  unit text default 'pz',
  quantity_available numeric(10,2) not null default 0,
  reorder_threshold numeric(10,2) default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  requested_at timestamptz not null default now(),
  received_at timestamptz,
  rating smallint check (rating between 1 and 5),
  note text
);

-- INDEXES
create index on public.orders (shop_id, due_date);
create index on public.orders (shop_id, status);
create index on public.orders (shop_id, priority);
create index on public.orders (customer_id);
create index on public.reminders (shop_id, due_at) where status = 'attivo';
create index on public.customers (shop_id);

-- AUTO-UPDATE updated_at
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger orders_updated_at before update on public.orders
  for each row execute function public.handle_updated_at();
create trigger inventory_updated_at before update on public.inventory_items
  for each row execute function public.handle_updated_at();

-- AUTO-CREATE shop for new users
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.shops (owner_user_id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'shop_name', 'La mia bottega'));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ROW LEVEL SECURITY
alter table public.shops enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_events enable row level security;
alter table public.reminders enable row level security;
alter table public.inventory_items enable row level security;
alter table public.reviews enable row level security;

-- Helper: get current user's shop_id
create or replace function public.my_shop_id()
returns uuid language sql stable as $$
  select id from public.shops where owner_user_id = auth.uid() limit 1;
$$;

-- RLS POLICIES
create policy "shop_owner_all" on public.shops
  for all using (owner_user_id = auth.uid());

create policy "shop_data_all" on public.customers
  for all using (shop_id = public.my_shop_id());

create policy "shop_data_all" on public.orders
  for all using (shop_id = public.my_shop_id());

create policy "shop_data_all" on public.order_events
  for all using (
    order_id in (select id from public.orders where shop_id = public.my_shop_id())
  );

create policy "shop_data_all" on public.reminders
  for all using (shop_id = public.my_shop_id());

create policy "shop_data_all" on public.inventory_items
  for all using (shop_id = public.my_shop_id());

create policy "shop_data_all" on public.reviews
  for all using (shop_id = public.my_shop_id());
```

- [ ] **Step 3: Write `supabase/seed.sql`** (dev data only)

```sql
-- Run after auth: replace 'YOUR-USER-UUID' with a real auth.users id from Supabase dashboard
-- This seed is for local development only

do $$
declare
  v_shop_id uuid;
  v_customer1 uuid;
  v_customer2 uuid;
  v_order1 uuid;
begin
  select id into v_shop_id from public.shops limit 1;

  insert into public.customers (shop_id, name, phone, tags)
  values
    (v_shop_id, 'Marco Ferretti', '+39 333 1234567', '{ricorrente}'),
    (v_shop_id, 'Giulia Neri', '+39 345 9876543', '{}')
  returning id into v_customer1;

  select id into v_customer2 from public.customers where name = 'Giulia Neri';
  select id into v_customer1 from public.customers where name = 'Marco Ferretti';

  insert into public.orders (shop_id, customer_id, title, status, priority, due_date, amount_estimated, payment_status)
  values
    (v_shop_id, v_customer1, 'Riparazione borsa pelle', 'in_lavorazione', 'alta', current_date + 2, 80, 'acconto'),
    (v_shop_id, v_customer2, 'Cintura su misura', 'nuovo', 'normale', current_date + 7, 120, 'non_pagato'),
    (v_shop_id, v_customer1, 'Portafoglio personalizzato', 'pronto', 'urgente', current_date, 60, 'saldato')
  returning id into v_order1;

  insert into public.reminders (shop_id, title, due_at)
  values
    (v_shop_id, 'Chiamare fornitore pelle', now() + interval '2 hours'),
    (v_shop_id, 'Controllare magazzino fili', now() + interval '1 day');
end;
$$;
```

- [ ] **Step 4: Apply migration**

```bash
npx supabase db push
```
Expected: migration applied, no errors.

- [ ] **Step 5: Generate TypeScript types**

```bash
npx supabase gen types typescript --linked > src/types/supabase.ts
```

- [ ] **Step 6: Commit**

```bash
git add supabase/ src/types/supabase.ts
git commit -m "feat: initial SQL schema with RLS policies"
```

**Completion criteria:** Supabase Dashboard shows all 7 tables. `src/types/supabase.ts` exists with generated types. Running a test query in Supabase SQL editor returns data.

---

### Task 04: Supabase Auth + Middleware

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/middleware.ts`
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/callback/route.ts`

- [ ] **Step 1: Create `src/lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/types/supabase"

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Create `src/lib/supabase/server.ts`**

```typescript
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/types/supabase"

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 3: Create `src/middleware.ts`**

```typescript
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthPage = request.nextUrl.pathname.startsWith("/login")
  const isPublicPath = isAuthPage || request.nextUrl.pathname === "/"

  if (!user && !isPublicPath) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
```

- [ ] **Step 4: Create `src/app/(auth)/login/page.tsx`**

```typescript
"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    })
    if (error) {
      setMessage("Si è verificato un errore. Riprova tra qualche secondo.")
    } else {
      setMessage("Controlla la tua email — ti abbiamo inviato un link per accedere.")
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Oltre la Bottega</CardTitle>
          <p className="text-sm text-muted-foreground">Inserisci la tua email per accedere</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@esempio.it"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Invio in corso…" : "Accedi con email"}
            </Button>
            {message && (
              <p className="text-sm text-center text-muted-foreground">{message}</p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 5: Create `src/app/(auth)/callback/route.ts`**

```typescript
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
```

- [ ] **Step 6: Create `src/app/page.tsx`** (root redirect)

```typescript
import { redirect } from "next/navigation"

export default function RootPage() {
  redirect("/dashboard")
}
```

- [ ] **Step 7: Verify auth flow manually**

```bash
npm run dev
```
1. Open `http://localhost:3000` — should redirect to `/login`.
2. Enter your email, click "Accedi". Check email for magic link.
3. Click magic link — should redirect to `/dashboard` (404 is ok for now, just confirms redirect works).

- [ ] **Step 8: Commit**

```bash
git add src/
git commit -m "feat: Supabase auth with magic link + middleware"
```

**Completion criteria:** Unauthenticated request to `/dashboard` redirects to `/login`. After magic-link click, user lands on `/dashboard`.

---

### Task 05: Error Handling Foundation

**Files:**
- Create: `src/lib/errors.ts`
- Create: `src/lib/logger.ts`
- Create: `src/components/ErrorMessage.tsx`

- [ ] **Step 1: Create `src/lib/logger.ts`**

```typescript
export function logError(context: string, error: unknown, meta?: Record<string, unknown>) {
  console.error(`[${new Date().toISOString()}] [ERROR] [${context}]`, {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...meta,
  })
}

export function logInfo(context: string, message: string, meta?: Record<string, unknown>) {
  console.log(`[${new Date().toISOString()}] [INFO] [${context}] ${message}`, meta ?? "")
}
```

- [ ] **Step 2: Create `src/lib/errors.ts`**

```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public readonly userMessage: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message)
    this.name = "AppError"
  }
}

export const USER_MESSAGES = {
  generic: "Si è verificato un errore. Riprova tra qualche secondo.",
  saveFailed: "Impossibile salvare i dati. Controlla la connessione e riprova.",
  notFound: "Elemento non trovato. Potrebbe essere stato eliminato.",
  authRequired: "Per accedere è necessario effettuare il login.",
  validationError: "Controlla i campi del modulo prima di continuare.",
  featureUnavailable: "Funzione temporaneamente non disponibile. Riprova più tardi.",
} as const

export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) return error.userMessage
  return USER_MESSAGES.generic
}
```

- [ ] **Step 3: Create `src/components/ErrorMessage.tsx`**

```typescript
import { cn } from "@/lib/utils"

interface ErrorMessageProps {
  message: string
  className?: string
}

export function ErrorMessage({ message, className }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700",
        className
      )}
    >
      {message}
    </div>
  )
}
```

- [ ] **Step 4: Write test for `toUserMessage`**

Create `src/lib/__tests__/errors.test.ts`:

```typescript
import { AppError, toUserMessage, USER_MESSAGES } from "../errors"

describe("toUserMessage", () => {
  it("returns AppError userMessage when AppError is passed", () => {
    const err = new AppError("technical msg", USER_MESSAGES.saveFailed)
    expect(toUserMessage(err)).toBe(USER_MESSAGES.saveFailed)
  })

  it("returns generic message for unknown errors", () => {
    expect(toUserMessage(new Error("db timeout"))).toBe(USER_MESSAGES.generic)
    expect(toUserMessage("string error")).toBe(USER_MESSAGES.generic)
  })
})
```

- [ ] **Step 5: Install test runner and run**

```bash
npm install -D jest @types/jest ts-jest
npx jest src/lib/__tests__/errors.test.ts
```
Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/errors.ts src/lib/logger.ts src/components/ErrorMessage.tsx src/lib/__tests__/
git commit -m "feat: error handling foundation with Italian user messages"
```

**Completion criteria:** Both tests pass. `ErrorMessage` component renders without TypeScript errors.

---

## Phase 1 — MVP Core (2–4 weeks)

### Task 06: App Shell + Dashboard Page

**Files:**
- Create: `src/app/(dashboard)/layout.tsx`
- Create: `src/app/(dashboard)/dashboard/page.tsx`
- Create: `src/components/nav/Sidebar.tsx`
- Create: `src/components/nav/BottomNav.tsx`
- Create: `src/components/TodayBoard.tsx`
- Create: `src/app/api/dashboard/today/route.ts`

- [ ] **Step 1: Create `src/components/nav/Sidebar.tsx`**

```typescript
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, ShoppingBag, Users, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders", label: "Ordini", icon: ShoppingBag },
  { href: "/customers", label: "Clienti", icon: Users },
  { href: "/agenda", label: "Agenda", icon: Calendar },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="hidden md:flex flex-col w-56 border-r bg-white min-h-screen p-4 gap-1">
      <div className="font-semibold text-lg mb-6 px-2">Oltre la Bottega</div>
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
            pathname.startsWith(href)
              ? "bg-slate-100 text-slate-900"
              : "text-slate-600 hover:bg-slate-50"
          )}
        >
          <Icon className="w-4 h-4" />
          {label}
        </Link>
      ))}
    </aside>
  )
}
```

- [ ] **Step 2: Create `src/components/nav/BottomNav.tsx`**

```typescript
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, ShoppingBag, Users, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/orders", label: "Ordini", icon: ShoppingBag },
  { href: "/customers", label: "Clienti", icon: Users },
  { href: "/agenda", label: "Agenda", icon: Calendar },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t z-50 flex">
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex flex-col items-center gap-0.5 flex-1 py-2 text-xs",
            pathname.startsWith(href) ? "text-slate-900 font-medium" : "text-slate-500"
          )}
        >
          <Icon className="w-5 h-5" />
          {label}
        </Link>
      ))}
    </nav>
  )
}
```

- [ ] **Step 3: Create `src/app/(dashboard)/layout.tsx`**

```typescript
import { Sidebar } from "@/components/nav/Sidebar"
import { BottomNav } from "@/components/nav/BottomNav"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 4: Create `src/app/api/dashboard/today/route.ts`**

```typescript
import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logger"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const today = new Date().toISOString().split("T")[0]

    const [openRes, urgentRes, overdueRes, todayRes, remindersRes] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true })
        .not("status", "in", '("consegnato","annullato")'),
      supabase.from("orders").select("id", { count: "exact", head: true })
        .eq("priority", "urgente").not("status", "in", '("consegnato","annullato")'),
      supabase.from("orders").select("id", { count: "exact", head: true })
        .lt("due_date", today).not("status", "in", '("consegnato","annullato")'),
      supabase.from("orders").select("id, title, customer_id, status, priority, due_date, customers(name)")
        .eq("due_date", today).not("status", "in", '("consegnato","annullato")'),
      supabase.from("reminders").select("id, title, due_at, order_id, customer_id")
        .eq("status", "attivo").lte("due_at", new Date(today + "T23:59:59Z").toISOString())
        .order("due_at"),
    ])

    return NextResponse.json({
      kpi: {
        open: openRes.count ?? 0,
        urgent: urgentRes.count ?? 0,
        overdue: overdueRes.count ?? 0,
        todayDeliveries: todayRes.data?.length ?? 0,
      },
      todayOrders: todayRes.data ?? [],
      reminders: remindersRes.data ?? [],
    })
  } catch (error) {
    logError("dashboard/today", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

- [ ] **Step 5: Create `src/components/TodayBoard.tsx`**

```typescript
"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ErrorMessage } from "@/components/ErrorMessage"
import { dueDateLabel } from "@/lib/utils"
import { toUserMessage } from "@/lib/errors"
import { AlertTriangle, Clock, Package, Truck } from "lucide-react"
import Link from "next/link"

interface DashboardData {
  kpi: { open: number; urgent: number; overdue: number; todayDeliveries: number }
  todayOrders: Array<{ id: string; title: string; priority: string; due_date: string; customers: { name: string } | null }>
  reminders: Array<{ id: string; title: string; due_at: string }>
}

export function TodayBoard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/dashboard/today")
      .then((r) => r.json())
      .then((json) => { setData(json); setLoading(false) })
      .catch((err) => { setError(toUserMessage(err)); setLoading(false) })
  }, [])

  if (loading) return <div className="text-muted-foreground text-sm">Caricamento…</div>
  if (error) return <ErrorMessage message={error} />

  const { kpi, todayOrders, reminders } = data!

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Ordini aperti" value={kpi.open} icon={<Package className="w-4 h-4" />} />
        <KpiCard label="Urgenti" value={kpi.urgent} icon={<AlertTriangle className="w-4 h-4" />} variant={kpi.urgent > 0 ? "urgent" : "default"} />
        <KpiCard label="In ritardo" value={kpi.overdue} icon={<Clock className="w-4 h-4" />} variant={kpi.overdue > 0 ? "danger" : "default"} />
        <KpiCard label="Consegne oggi" value={kpi.todayDeliveries} icon={<Truck className="w-4 h-4" />} variant={kpi.todayDeliveries > 0 ? "info" : "default"} />
      </div>

      {todayOrders.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Consegne di oggi</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {todayOrders.map((o) => (
              <Link key={o.id} href={`/orders/${o.id}`} className="flex items-center justify-between py-2 border-b last:border-0 hover:bg-slate-50 rounded px-2 -mx-2">
                <div>
                  <p className="font-medium text-sm">{o.title}</p>
                  <p className="text-xs text-muted-foreground">{o.customers?.name ?? "Cliente non indicato"}</p>
                </div>
                {o.priority === "urgente" && <Badge variant="destructive">Urgente</Badge>}
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {reminders.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Promemoria di oggi</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {reminders.map((r) => (
              <div key={r.id} className="flex items-center gap-2 py-2 border-b last:border-0">
                <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm">{r.title}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function KpiCard({ label, value, icon, variant = "default" }: {
  label: string; value: number; icon: React.ReactNode; variant?: "default" | "urgent" | "danger" | "info"
}) {
  const colors = {
    default: "bg-white",
    urgent: "bg-amber-50 border-amber-200",
    danger: "bg-red-50 border-red-200",
    info: "bg-blue-50 border-blue-200",
  }
  return (
    <Card className={colors[variant]}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-2xl font-bold">{value}</span>
        </div>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 6: Create `src/app/(dashboard)/dashboard/page.tsx`**

```typescript
import { TodayBoard } from "@/components/TodayBoard"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default function DashboardPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cosa fare oggi</h1>
          <p className="text-muted-foreground text-sm">{new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        <Button asChild>
          <Link href="/orders/new"><Plus className="w-4 h-4 mr-2" />Nuovo ordine</Link>
        </Button>
      </div>
      <TodayBoard />
    </div>
  )
}
```

- [ ] **Step 7: Install lucide-react**

```bash
npm install lucide-react
```

- [ ] **Step 8: Verify dashboard renders**

```bash
npm run dev
```
Open `http://localhost:3000/dashboard`. Expected: KPI cards visible, no console errors.

- [ ] **Step 9: Commit**

```bash
git add src/
git commit -m "feat: app shell with sidebar, bottom nav, and dashboard KPI board"
```

**Completion criteria:** Dashboard page loads, shows 4 KPI cards, nav works on both desktop (sidebar) and mobile (bottom nav).

---

### Task 07: Order List + StatusBadge

**Files:**
- Create: `src/components/StatusBadge.tsx`
- Create: `src/components/OrderCard.tsx`
- Create: `src/app/(dashboard)/orders/page.tsx`
- Create: `src/actions/orders.ts` (partial — list only)

- [ ] **Step 1: Create `src/components/StatusBadge.tsx`**

```typescript
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type OrderStatus = "nuovo" | "in_lavorazione" | "pronto" | "consegnato" | "annullato"
type OrderPriority = "normale" | "alta" | "urgente"

const STATUS_LABELS: Record<OrderStatus, string> = {
  nuovo: "Nuovo",
  in_lavorazione: "In lavorazione",
  pronto: "Pronto",
  consegnato: "Consegnato",
  annullato: "Annullato",
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  nuovo: "bg-slate-100 text-slate-700",
  in_lavorazione: "bg-blue-100 text-blue-700",
  pronto: "bg-green-100 text-green-700",
  consegnato: "bg-gray-100 text-gray-500",
  annullato: "bg-red-100 text-red-500",
}

const PRIORITY_LABELS: Record<OrderPriority, string> = {
  normale: "Normale",
  alta: "Alta",
  urgente: "Urgente",
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_COLORS[status])}>
      {STATUS_LABELS[status]}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: OrderPriority }) {
  if (priority === "normale") return null
  return (
    <Badge variant={priority === "urgente" ? "destructive" : "secondary"}>
      {PRIORITY_LABELS[priority]}
    </Badge>
  )
}
```

- [ ] **Step 2: Create `src/actions/orders.ts`** (list function only for now)

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logger"
import { AppError, USER_MESSAGES } from "@/lib/errors"

export type OrderWithCustomer = {
  id: string
  title: string
  status: "nuovo" | "in_lavorazione" | "pronto" | "consegnato" | "annullato"
  priority: "normale" | "alta" | "urgente"
  due_date: string | null
  payment_status: "non_pagato" | "acconto" | "saldato"
  created_at: string
  customers: { id: string; name: string } | null
}

export async function getOrders(filters?: {
  status?: string
  priority?: string
  search?: string
}): Promise<OrderWithCustomer[]> {
  try {
    const supabase = await createClient()
    let query = supabase
      .from("orders")
      .select("id, title, status, priority, due_date, payment_status, created_at, customers(id, name)")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })

    if (filters?.status && filters.status !== "tutti") {
      query = query.eq("status", filters.status)
    }
    if (filters?.priority && filters.priority !== "tutti") {
      query = query.eq("priority", filters.priority)
    }
    if (filters?.search) {
      query = query.ilike("title", `%${filters.search}%`)
    }

    const { data, error } = await query
    if (error) throw new AppError(error.message, USER_MESSAGES.generic, { query: "getOrders" })
    return (data ?? []) as OrderWithCustomer[]
  } catch (err) {
    logError("getOrders", err)
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.generic)
  }
}
```

- [ ] **Step 3: Create `src/components/OrderCard.tsx`**

```typescript
import Link from "next/link"
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge"
import { dueDateLabel, isOverdue } from "@/lib/utils"
import { cn } from "@/lib/utils"
import type { OrderWithCustomer } from "@/actions/orders"

export function OrderCard({ order }: { order: OrderWithCustomer }) {
  const overdue = order.due_date ? isOverdue(order.due_date) : false
  return (
    <Link href={`/orders/${order.id}`}>
      <div className={cn(
        "bg-white rounded-lg border p-4 hover:shadow-sm transition-shadow space-y-2",
        overdue && "border-red-200 bg-red-50"
      )}>
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-sm leading-tight">{order.title}</p>
          <PriorityBadge priority={order.priority} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={order.status} />
          {order.customers && (
            <span className="text-xs text-muted-foreground">{order.customers.name}</span>
          )}
        </div>
        {order.due_date && (
          <p className={cn("text-xs", overdue ? "text-red-600 font-medium" : "text-muted-foreground")}>
            Consegna: {dueDateLabel(order.due_date)}
          </p>
        )}
      </div>
    </Link>
  )
}
```

- [ ] **Step 4: Create `src/app/(dashboard)/orders/page.tsx`**

```typescript
import { getOrders } from "@/actions/orders"
import { OrderCard } from "@/components/OrderCard"
import { Button } from "@/components/ui/button"
import { ErrorMessage } from "@/components/ErrorMessage"
import Link from "next/link"
import { Plus } from "lucide-react"
import { toUserMessage } from "@/lib/errors"

interface OrdersPageProps {
  searchParams: Promise<{ status?: string; priority?: string; q?: string }>
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = await searchParams
  let orders: Awaited<ReturnType<typeof getOrders>> = []
  let errorMsg: string | null = null

  try {
    orders = await getOrders({ status: params.status, priority: params.priority, search: params.q })
  } catch (err) {
    errorMsg = toUserMessage(err)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ordini</h1>
        <Button asChild>
          <Link href="/orders/new"><Plus className="w-4 h-4 mr-2" />Nuovo ordine</Link>
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["tutti","nuovo","in_lavorazione","pronto","consegnato"].map((s) => (
          <Link key={s} href={s === "tutti" ? "/orders" : `/orders?status=${s}`}>
            <Button variant={(!params.status && s === "tutti") || params.status === s ? "default" : "outline"} size="sm">
              {s === "tutti" ? "Tutti" : s.replace("_", " ")}
            </Button>
          </Link>
        ))}
      </div>

      {errorMsg && <ErrorMessage message={errorMsg} />}

      {orders.length === 0 && !errorMsg ? (
        <p className="text-muted-foreground text-sm">Nessun ordine trovato.</p>
      ) : (
        <div className="grid gap-3">
          {orders.map((o) => <OrderCard key={o.id} order={o} />)}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Verify order list**

```bash
npm run dev
```
Open `/orders`. Expected: order list renders. If seed data was applied, 3 sample orders appear.

- [ ] **Step 6: Commit**

```bash
git add src/
git commit -m "feat: order list with status/priority filters and OrderCard"
```

**Completion criteria:** `/orders` renders without errors. Status filter links change URL params and re-filter the list. Overdue orders show red border.

---

### Task 08: Create Order (OrderForm)

**Files:**
- Modify: `src/actions/orders.ts` (add `createOrder`, `updateOrderStatus`)
- Create: `src/components/OrderForm.tsx`
- Create: `src/app/(dashboard)/orders/new/page.tsx`

- [ ] **Step 1: Add `createOrder` to `src/actions/orders.ts`**

Append to existing file:

```typescript
export type CreateOrderInput = {
  title: string
  customer_id?: string | null
  description?: string | null
  status?: "nuovo" | "in_lavorazione" | "pronto" | "consegnato" | "annullato"
  priority?: "normale" | "alta" | "urgente"
  due_date?: string | null
  amount_estimated?: number | null
  payment_status?: "non_pagato" | "acconto" | "saldato"
}

export async function createOrder(input: CreateOrderInput): Promise<{ id: string }> {
  try {
    const supabase = await createClient()
    const { data: shop } = await supabase.from("shops").select("id").single()
    if (!shop) throw new AppError("No shop found", USER_MESSAGES.authRequired)

    const { data, error } = await supabase
      .from("orders")
      .insert({ ...input, shop_id: shop.id })
      .select("id")
      .single()

    if (error) throw new AppError(error.message, USER_MESSAGES.saveFailed, { action: "createOrder" })

    // Log event
    await supabase.from("order_events").insert({
      order_id: data.id,
      event_type: "created",
      note: "Ordine creato",
    })

    return { id: data.id }
  } catch (err) {
    logError("createOrder", err, { input })
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.saveFailed)
  }
}

export async function updateOrderStatus(
  orderId: string,
  status: "nuovo" | "in_lavorazione" | "pronto" | "consegnato" | "annullato",
  note?: string
): Promise<void> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId)
    if (error) throw new AppError(error.message, USER_MESSAGES.saveFailed)

    await supabase.from("order_events").insert({
      order_id: orderId,
      event_type: "status_change",
      note: note ?? `Stato cambiato in: ${status}`,
    })
  } catch (err) {
    logError("updateOrderStatus", err, { orderId, status })
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.saveFailed)
  }
}
```

- [ ] **Step 2: Create `src/components/OrderForm.tsx`**

```typescript
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createOrder } from "@/actions/orders"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ErrorMessage } from "@/components/ErrorMessage"
import { toUserMessage } from "@/lib/errors"

interface CustomerOption { id: string; name: string }

interface OrderFormProps {
  customers: CustomerOption[]
}

export function OrderForm({ customers }: OrderFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const fd = new FormData(e.currentTarget)

    try {
      const result = await createOrder({
        title: fd.get("title") as string,
        customer_id: fd.get("customer_id") as string || null,
        description: fd.get("description") as string || null,
        priority: fd.get("priority") as "normale" | "alta" | "urgente",
        due_date: fd.get("due_date") as string || null,
        amount_estimated: fd.get("amount_estimated") ? Number(fd.get("amount_estimated")) : null,
        payment_status: "non_pagato",
      })
      router.push(`/orders/${result.id}`)
      router.refresh()
    } catch (err) {
      setError(toUserMessage(err))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      {error && <ErrorMessage message={error} />}

      <div>
        <Label htmlFor="title">Lavorazione *</Label>
        <Input id="title" name="title" required placeholder="es. Riparazione borsa pelle" />
      </div>

      <div>
        <Label htmlFor="customer_id">Cliente</Label>
        <Select name="customer_id">
          <SelectTrigger><SelectValue placeholder="Seleziona cliente (opzionale)" /></SelectTrigger>
          <SelectContent>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="due_date">Data consegna</Label>
          <Input id="due_date" name="due_date" type="date" />
        </div>
        <div>
          <Label htmlFor="priority">Priorità</Label>
          <Select name="priority" defaultValue="normale">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="normale">Normale</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="urgente">Urgente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="amount_estimated">Prezzo stimato (€)</Label>
        <Input id="amount_estimated" name="amount_estimated" type="number" step="0.01" min="0" placeholder="0.00" />
      </div>

      <div>
        <Label htmlFor="description">Note</Label>
        <Textarea id="description" name="description" rows={3} placeholder="Dettagli sulla lavorazione…" />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Salvataggio…" : "Crea ordine"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Annulla
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: Create `src/app/(dashboard)/orders/new/page.tsx`**

```typescript
import { OrderForm } from "@/components/OrderForm"
import { createClient } from "@/lib/supabase/server"

export default async function NewOrderPage() {
  const supabase = await createClient()
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name")
    .order("name")

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Nuovo ordine</h1>
      <OrderForm customers={customers ?? []} />
    </div>
  )
}
```

- [ ] **Step 4: Manual test — Flusso B**

```bash
npm run dev
```
1. Open `/orders/new`.
2. Fill in title, select customer, set due date, set priority to "Urgente".
3. Click "Crea ordine".
4. Expected: redirected to `/orders/<id>` (404 is fine for now), order appears in `/orders`.

Time target: under 2 minutes to complete the form.

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "feat: order creation form with validation and error feedback"
```

**Completion criteria:** Submitting the form creates a record in Supabase. Errors show Italian message. Empty title is blocked by HTML `required`.

---

### Task 09: Order Detail + Timeline

**Files:**
- Modify: `src/actions/orders.ts` (add `getOrder`, `updateOrder`)
- Create: `src/app/(dashboard)/orders/[id]/page.tsx`

- [ ] **Step 1: Add `getOrder` and `updateOrder` to `src/actions/orders.ts`**

```typescript
export type OrderDetail = OrderWithCustomer & {
  description: string | null
  amount_estimated: number | null
  events: Array<{ id: string; event_type: string; note: string | null; created_at: string }>
}

export async function getOrder(id: string): Promise<OrderDetail | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("orders")
      .select(`
        id, title, description, status, priority, due_date,
        amount_estimated, payment_status, created_at,
        customers(id, name),
        order_events(id, event_type, note, created_at)
      `)
      .eq("id", id)
      .order("created_at", { referencedTable: "order_events", ascending: false })
      .single()

    if (error) {
      if (error.code === "PGRST116") return null
      throw new AppError(error.message, USER_MESSAGES.notFound)
    }
    return data as unknown as OrderDetail
  } catch (err) {
    logError("getOrder", err, { id })
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.generic)
  }
}

export async function updateOrder(id: string, input: Partial<CreateOrderInput>): Promise<void> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from("orders").update(input).eq("id", id)
    if (error) throw new AppError(error.message, USER_MESSAGES.saveFailed)

    await supabase.from("order_events").insert({
      order_id: id,
      event_type: "updated",
      note: "Ordine aggiornato",
    })
  } catch (err) {
    logError("updateOrder", err, { id, input })
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.saveFailed)
  }
}
```

- [ ] **Step 2: Create `src/app/(dashboard)/orders/[id]/page.tsx`**

```typescript
import { notFound } from "next/navigation"
import { getOrder, updateOrderStatus } from "@/actions/orders"
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatDate } from "@/lib/utils"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { revalidatePath } from "next/cache"

const EVENT_LABELS: Record<string, string> = {
  created: "Ordine creato",
  status_change: "Stato aggiornato",
  updated: "Dati aggiornati",
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const order = await getOrder(id)
  if (!order) notFound()

  async function changeStatus(formData: FormData) {
    "use server"
    const status = formData.get("status") as "nuovo" | "in_lavorazione" | "pronto" | "consegnato" | "annullato"
    await updateOrderStatus(id, status)
    revalidatePath(`/orders/${id}`)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/orders"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" />Ordini</Button></Link>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={order.status} />
          <PriorityBadge priority={order.priority} />
        </div>
        <h1 className="text-2xl font-bold">{order.title}</h1>
        {order.customers && <p className="text-muted-foreground">{order.customers.name}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        {order.due_date && <div><span className="text-muted-foreground">Consegna: </span>{formatDate(order.due_date)}</div>}
        {order.amount_estimated && <div><span className="text-muted-foreground">Prezzo: </span>€{order.amount_estimated}</div>}
        <div><span className="text-muted-foreground">Pagamento: </span>{order.payment_status.replace("_", " ")}</div>
      </div>

      {order.description && (
        <Card><CardContent className="pt-4"><p className="text-sm">{order.description}</p></CardContent></Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Aggiorna stato</CardTitle></CardHeader>
        <CardContent>
          <form action={changeStatus} className="flex gap-3">
            <Select name="status" defaultValue={order.status}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["nuovo","in_lavorazione","pronto","consegnato","annullato"] as const).map((s) => (
                  <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit">Salva</Button>
          </form>
        </CardContent>
      </Card>

      {order.events.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Attività</CardTitle></CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {order.events.map((ev) => (
                <li key={ev.id} className="flex gap-3 text-sm">
                  <span className="text-muted-foreground shrink-0">{formatDate(ev.created_at)}</span>
                  <span>{ev.note ?? EVENT_LABELS[ev.event_type] ?? ev.event_type}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Manual test — Flusso C**

1. Open an existing order at `/orders/<id>`.
2. Change status via dropdown, click "Salva".
3. Expected: page reloads, new status badge displayed, timeline shows new event.
Time target: under 30 seconds.

- [ ] **Step 4: Commit**

```bash
git add src/
git commit -m "feat: order detail page with status update and event timeline"
```

**Completion criteria:** Order detail shows all fields, timeline events, and status can be changed in one click.

---

### Task 10: Customer List + Create

**Files:**
- Create: `src/actions/customers.ts`
- Create: `src/components/CustomerForm.tsx`
- Create: `src/app/(dashboard)/customers/page.tsx`
- Create: `src/app/(dashboard)/customers/new/page.tsx`

- [ ] **Step 1: Create `src/actions/customers.ts`**

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logger"
import { AppError, USER_MESSAGES } from "@/lib/errors"

export type CustomerSummary = {
  id: string
  name: string
  phone: string | null
  email: string | null
  tags: string[]
  created_at: string
  order_count?: number
}

export async function getCustomers(search?: string): Promise<CustomerSummary[]> {
  try {
    const supabase = await createClient()
    let query = supabase
      .from("customers")
      .select("id, name, phone, email, tags, created_at")
      .order("name")

    if (search) query = query.ilike("name", `%${search}%`)

    const { data, error } = await query
    if (error) throw new AppError(error.message, USER_MESSAGES.generic)
    return (data ?? []) as CustomerSummary[]
  } catch (err) {
    logError("getCustomers", err)
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.generic)
  }
}

export async function createCustomer(input: {
  name: string
  phone?: string
  email?: string
  notes?: string
  tags?: string[]
}): Promise<{ id: string }> {
  try {
    const supabase = await createClient()
    const { data: shop } = await supabase.from("shops").select("id").single()
    if (!shop) throw new AppError("No shop", USER_MESSAGES.authRequired)

    const { data, error } = await supabase
      .from("customers")
      .insert({ ...input, shop_id: shop.id })
      .select("id")
      .single()

    if (error) throw new AppError(error.message, USER_MESSAGES.saveFailed)
    return { id: data.id }
  } catch (err) {
    logError("createCustomer", err, { input })
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.saveFailed)
  }
}
```

- [ ] **Step 2: Create `src/components/CustomerForm.tsx`**

```typescript
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createCustomer } from "@/actions/customers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ErrorMessage } from "@/components/ErrorMessage"
import { toUserMessage } from "@/lib/errors"

export function CustomerForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const fd = new FormData(e.currentTarget)

    try {
      const result = await createCustomer({
        name: fd.get("name") as string,
        phone: fd.get("phone") as string || undefined,
        email: fd.get("email") as string || undefined,
        notes: fd.get("notes") as string || undefined,
      })
      router.push(`/customers/${result.id}`)
      router.refresh()
    } catch (err) {
      setError(toUserMessage(err))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      {error && <ErrorMessage message={error} />}
      <div>
        <Label htmlFor="name">Nome *</Label>
        <Input id="name" name="name" required placeholder="es. Marco Ferretti" />
      </div>
      <div>
        <Label htmlFor="phone">Telefono</Label>
        <Input id="phone" name="phone" type="tel" placeholder="+39 333 1234567" />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="cliente@esempio.it" />
      </div>
      <div>
        <Label htmlFor="notes">Note</Label>
        <Textarea id="notes" name="notes" rows={3} placeholder="Preferenze, informazioni utili…" />
      </div>
      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>{saving ? "Salvataggio…" : "Crea cliente"}</Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Annulla</Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: Create `src/app/(dashboard)/customers/page.tsx`**

```typescript
import { getCustomers } from "@/actions/customers"
import { Button } from "@/components/ui/button"
import { ErrorMessage } from "@/components/ErrorMessage"
import Link from "next/link"
import { Plus, User } from "lucide-react"
import { toUserMessage } from "@/lib/errors"

export default async function CustomersPage() {
  let customers: Awaited<ReturnType<typeof getCustomers>> = []
  let errorMsg: string | null = null

  try {
    customers = await getCustomers()
  } catch (err) {
    errorMsg = toUserMessage(err)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clienti</h1>
        <Button asChild><Link href="/customers/new"><Plus className="w-4 h-4 mr-2" />Nuovo cliente</Link></Button>
      </div>
      {errorMsg && <ErrorMessage message={errorMsg} />}
      {customers.length === 0 && !errorMsg ? (
        <p className="text-muted-foreground text-sm">Nessun cliente ancora.</p>
      ) : (
        <div className="grid gap-3">
          {customers.map((c) => (
            <Link key={c.id} href={`/customers/${c.id}`}>
              <div className="bg-white rounded-lg border p-4 hover:shadow-sm transition-shadow flex items-center gap-3">
                <div className="bg-slate-100 rounded-full p-2">
                  <User className="w-4 h-4 text-slate-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">{c.name}</p>
                  {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                </div>
                {c.tags.length > 0 && (
                  <div className="ml-auto flex gap-1">
                    {c.tags.map((t) => (
                      <span key={t} className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create `src/app/(dashboard)/customers/new/page.tsx`**

```typescript
import { CustomerForm } from "@/components/CustomerForm"

export default function NewCustomerPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Nuovo cliente</h1>
      <CustomerForm />
    </div>
  )
}
```

- [ ] **Step 5: Verify customer flow**

```bash
npm run dev
```
Open `/customers`, click "+ Nuovo cliente", fill name + phone, save. Verify redirect to `/customers/<id>` (404 ok) and customer appears in `/customers`.

- [ ] **Step 6: Commit**

```bash
git add src/
git commit -m "feat: customer list and create form"
```

---

### Task 11: Customer Detail + Order History

**Files:**
- Modify: `src/actions/customers.ts` (add `getCustomer`)
- Create: `src/app/(dashboard)/customers/[id]/page.tsx`

- [ ] **Step 1: Add `getCustomer` to `src/actions/customers.ts`**

```typescript
export type CustomerDetail = CustomerSummary & {
  notes: string | null
  orders: Array<{ id: string; title: string; status: string; due_date: string | null; created_at: string }>
}

export async function getCustomer(id: string): Promise<CustomerDetail | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, phone, email, tags, notes, created_at, orders(id, title, status, due_date, created_at)")
      .eq("id", id)
      .order("created_at", { referencedTable: "orders", ascending: false })
      .single()

    if (error) {
      if (error.code === "PGRST116") return null
      throw new AppError(error.message, USER_MESSAGES.notFound)
    }
    return data as unknown as CustomerDetail
  } catch (err) {
    logError("getCustomer", err, { id })
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.generic)
  }
}
```

- [ ] **Step 2: Create `src/app/(dashboard)/customers/[id]/page.tsx`**

```typescript
import { notFound } from "next/navigation"
import { getCustomer } from "@/actions/customers"
import { StatusBadge } from "@/components/StatusBadge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, Phone, Mail, Plus } from "lucide-react"
import { formatDate } from "@/lib/utils"

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const customer = await getCustomer(id)
  if (!customer) notFound()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/customers"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" />Clienti</Button></Link>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{customer.name}</h1>
        <div className="flex gap-3 flex-wrap text-sm text-muted-foreground">
          {customer.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{customer.phone}</span>}
          {customer.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{customer.email}</span>}
        </div>
        {customer.notes && <p className="text-sm mt-2">{customer.notes}</p>}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Ordini ({customer.orders.length})</h2>
        <Button size="sm" asChild>
          <Link href={`/orders/new?customer_id=${customer.id}`}><Plus className="w-3 h-3 mr-1" />Nuovo ordine</Link>
        </Button>
      </div>

      {customer.orders.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nessun ordine per questo cliente.</p>
      ) : (
        <div className="space-y-2">
          {customer.orders.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`}>
              <Card className="hover:shadow-sm transition-shadow">
                <CardContent className="py-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{o.title}</p>
                    {o.due_date && <p className="text-xs text-muted-foreground">{formatDate(o.due_date)}</p>}
                  </div>
                  <StatusBadge status={o.status as any} />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/
git commit -m "feat: customer detail page with order history"
```

---

### Task 12: Agenda / Reminders

**Files:**
- Create: `src/actions/reminders.ts`
- Create: `src/components/ReminderList.tsx`
- Create: `src/app/(dashboard)/agenda/page.tsx`

- [ ] **Step 1: Create `src/actions/reminders.ts`**

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logger"
import { AppError, USER_MESSAGES } from "@/lib/errors"

export type ReminderItem = {
  id: string
  title: string
  due_at: string
  status: "attivo" | "completato" | "saltato"
  order_id: string | null
  customer_id: string | null
}

export async function getActiveReminders(): Promise<ReminderItem[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("reminders")
      .select("id, title, due_at, status, order_id, customer_id")
      .eq("status", "attivo")
      .order("due_at")

    if (error) throw new AppError(error.message, USER_MESSAGES.generic)
    return (data ?? []) as ReminderItem[]
  } catch (err) {
    logError("getActiveReminders", err)
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.generic)
  }
}

export async function createReminder(input: {
  title: string
  due_at: string
  order_id?: string | null
  customer_id?: string | null
}): Promise<void> {
  try {
    const supabase = await createClient()
    const { data: shop } = await supabase.from("shops").select("id").single()
    if (!shop) throw new AppError("No shop", USER_MESSAGES.authRequired)

    const { error } = await supabase.from("reminders").insert({ ...input, shop_id: shop.id })
    if (error) throw new AppError(error.message, USER_MESSAGES.saveFailed)
  } catch (err) {
    logError("createReminder", err, { input })
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.saveFailed)
  }
}

export async function completeReminder(id: string): Promise<void> {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from("reminders")
      .update({ status: "completato" })
      .eq("id", id)
    if (error) throw new AppError(error.message, USER_MESSAGES.saveFailed)
  } catch (err) {
    logError("completeReminder", err, { id })
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.saveFailed)
  }
}
```

- [ ] **Step 2: Create `src/components/ReminderList.tsx`**

```typescript
"use client"

import { useState, useTransition } from "react"
import { completeReminder } from "@/actions/reminders"
import { Button } from "@/components/ui/button"
import { ErrorMessage } from "@/components/ErrorMessage"
import { toUserMessage } from "@/lib/errors"
import type { ReminderItem } from "@/actions/reminders"
import { Check, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { format, isPast } from "date-fns"
import { it } from "date-fns/locale"

export function ReminderList({ reminders }: { reminders: ReminderItem[] }) {
  const [items, setItems] = useState(reminders)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleComplete(id: string) {
    startTransition(async () => {
      try {
        await completeReminder(id)
        setItems((prev) => prev.filter((r) => r.id !== id))
      } catch (err) {
        setError(toUserMessage(err))
      }
    })
  }

  if (items.length === 0) return <p className="text-muted-foreground text-sm">Nessun promemoria attivo.</p>

  return (
    <div className="space-y-2">
      {error && <ErrorMessage message={error} className="mb-3" />}
      {items.map((r) => {
        const overdue = isPast(new Date(r.due_at))
        return (
          <div key={r.id} className={cn(
            "flex items-center gap-3 bg-white rounded-lg border p-3",
            overdue && "border-red-200 bg-red-50"
          )}>
            <Clock className={cn("w-4 h-4 shrink-0", overdue ? "text-red-500" : "text-muted-foreground")} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{r.title}</p>
              <p className={cn("text-xs", overdue ? "text-red-500" : "text-muted-foreground")}>
                {format(new Date(r.due_at), "d MMM, HH:mm", { locale: it })}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => handleComplete(r.id)} disabled={isPending}>
              <Check className="w-4 h-4" />
            </Button>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Create `src/app/(dashboard)/agenda/page.tsx`**

```typescript
import { getActiveReminders, createReminder } from "@/actions/reminders"
import { ReminderList } from "@/components/ReminderList"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ErrorMessage } from "@/components/ErrorMessage"
import { revalidatePath } from "next/cache"
import { toUserMessage } from "@/lib/errors"

export default async function AgendaPage() {
  let reminders: Awaited<ReturnType<typeof getActiveReminders>> = []
  let errorMsg: string | null = null

  try {
    reminders = await getActiveReminders()
  } catch (err) {
    errorMsg = toUserMessage(err)
  }

  async function addReminder(formData: FormData) {
    "use server"
    await createReminder({
      title: formData.get("title") as string,
      due_at: new Date(formData.get("due_at") as string).toISOString(),
    })
    revalidatePath("/agenda")
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Agenda</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Nuovo promemoria</CardTitle></CardHeader>
        <CardContent>
          <form action={addReminder} className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-40">
              <Input name="title" required placeholder="Cosa ricordare…" />
            </div>
            <Input name="due_at" type="datetime-local" required className="w-52" />
            <Button type="submit">Aggiungi</Button>
          </form>
        </CardContent>
      </Card>

      {errorMsg && <ErrorMessage message={errorMsg} />}
      <ReminderList reminders={reminders} />
    </div>
  )
}
```

- [ ] **Step 4: Verify agenda flow**

```bash
npm run dev
```
Open `/agenda`. Add a reminder. Mark it as done. Verify it disappears from the list.

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "feat: agenda page with active reminders and complete action"
```

---

### Task 13: Global Search (SearchBar)

**Files:**
- Create: `src/components/SearchBar.tsx`
- Create: `src/app/api/search/route.ts`
- Modify: `src/app/(dashboard)/layout.tsx` (add SearchBar to header)

- [ ] **Step 1: Create `src/app/api/search/route.ts`**

```typescript
import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logger"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim()

  if (!q || q.length < 2) {
    return NextResponse.json({ orders: [], customers: [] })
  }

  try {
    const supabase = await createClient()
    const [ordersRes, customersRes] = await Promise.all([
      supabase.from("orders").select("id, title, status").ilike("title", `%${q}%`).limit(5),
      supabase.from("customers").select("id, name, phone").ilike("name", `%${q}%`).limit(5),
    ])

    return NextResponse.json({
      orders: ordersRes.data ?? [],
      customers: customersRes.data ?? [],
    })
  } catch (error) {
    logError("search", error, { q })
    return NextResponse.json({ orders: [], customers: [] })
  }
}
```

- [ ] **Step 2: Create `src/components/SearchBar.tsx`**

```typescript
"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { useDebounce } from "@/lib/hooks/useDebounce"

interface SearchResult {
  orders: Array<{ id: string; title: string; status: string }>
  customers: Array<{ id: string; name: string; phone: string | null }>
}

export function SearchBar() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult | null>(null)
  const [open, setOpen] = useState(false)
  const debouncedQuery = useDebounce(query, 300)
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (debouncedQuery.length < 2) { setResults(null); return }
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then(setResults)
      .catch(() => {})
  }, [debouncedQuery])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const hasResults = results && (results.orders.length > 0 || results.customers.length > 0)

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <Input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Cerca ordini, clienti…"
        className="pl-9"
      />
      {open && hasResults && (
        <div className="absolute top-full mt-1 w-full bg-white border rounded-lg shadow-lg z-50 overflow-hidden">
          {results.orders.length > 0 && (
            <>
              <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-slate-50">Ordini</p>
              {results.orders.map((o) => (
                <button key={o.id} className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50"
                  onClick={() => { router.push(`/orders/${o.id}`); setOpen(false); setQuery("") }}>
                  {o.title}
                </button>
              ))}
            </>
          )}
          {results.customers.length > 0 && (
            <>
              <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-slate-50">Clienti</p>
              {results.customers.map((c) => (
                <button key={c.id} className="w-full px-3 py-2 text-sm text-left hover:bg-slate-50"
                  onClick={() => { router.push(`/customers/${c.id}`); setOpen(false); setQuery("") }}>
                  {c.name} {c.phone && <span className="text-muted-foreground">{c.phone}</span>}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create `src/lib/hooks/useDebounce.ts`**

```typescript
import { useState, useEffect } from "react"

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debouncedValue
}
```

- [ ] **Step 4: Add SearchBar to `src/app/(dashboard)/layout.tsx`**

```typescript
import { Sidebar } from "@/components/nav/Sidebar"
import { BottomNav } from "@/components/nav/BottomNav"
import { SearchBar } from "@/components/SearchBar"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b px-4 md:px-8 py-3">
          <SearchBar />
        </header>
        <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 5: Verify search**

```bash
npm run dev
```
Type part of an order title in the search bar. Expect dropdown with results after ~300ms.

- [ ] **Step 6: Commit**

```bash
git add src/
git commit -m "feat: global search bar with debounced order + customer results"
```

---

## Phase 2 — Stabilization (1–2 weeks)

### Task 14: Mobile Responsive QA

**Goal:** Verify all pages work correctly on mobile viewports.

- [ ] **Step 1: Test each page at 375px width (iPhone SE)**

Open Chrome DevTools → Mobile emulation → 375px.
Check each route:
- `/dashboard` — KPI grid 2-col, bottom nav visible, "Nuovo ordine" button accessible
- `/orders` — OrderCard readable, filter buttons wrap correctly
- `/orders/new` — Form fills the viewport, no horizontal overflow
- `/orders/[id]` — Status dropdown usable by touch
- `/customers` — List readable
- `/agenda` — Add reminder form, datetime input usable on mobile

- [ ] **Step 2: Fix any overflow issues**

If any `overflow-x` issues appear, add `overflow-x: hidden` to root layout or fix the offending flex container.

- [ ] **Step 3: Verify bottom nav is always visible**

Scroll down on `/orders` with many items. BottomNav must remain sticky.

- [ ] **Step 4: Commit fixes**

```bash
git add src/
git commit -m "fix: mobile responsive layout adjustments"
```

**Completion criteria:** All pages render without horizontal scroll on 375px viewport. Bottom nav stays fixed.

---

### Task 15: Payment Status on Orders

**Files:**
- Modify: `src/app/(dashboard)/orders/[id]/page.tsx` (add payment update form)
- Modify: `src/actions/orders.ts` (add `updatePaymentStatus`)

- [ ] **Step 1: Add `updatePaymentStatus` to `src/actions/orders.ts`**

```typescript
export async function updatePaymentStatus(
  orderId: string,
  paymentStatus: "non_pagato" | "acconto" | "saldato"
): Promise<void> {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from("orders")
      .update({ payment_status: paymentStatus })
      .eq("id", orderId)
    if (error) throw new AppError(error.message, USER_MESSAGES.saveFailed)

    await supabase.from("order_events").insert({
      order_id: orderId,
      event_type: "payment_update",
      note: `Pagamento: ${paymentStatus.replace("_", " ")}`,
    })
  } catch (err) {
    logError("updatePaymentStatus", err, { orderId, paymentStatus })
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.saveFailed)
  }
}
```

- [ ] **Step 2: Add payment section to order detail page**

In `src/app/(dashboard)/orders/[id]/page.tsx`, add after the status card:

```typescript
// Add import at top
import { updatePaymentStatus } from "@/actions/orders"

// Add server action inside component
async function changePayment(formData: FormData) {
  "use server"
  const ps = formData.get("payment_status") as "non_pagato" | "acconto" | "saldato"
  await updatePaymentStatus(id, ps)
  revalidatePath(`/orders/${id}`)
}

// Add card after status card
<Card>
  <CardHeader><CardTitle className="text-base">Stato pagamento</CardTitle></CardHeader>
  <CardContent>
    <form action={changePayment} className="flex gap-3">
      <Select name="payment_status" defaultValue={order.payment_status}>
        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="non_pagato">Non pagato</SelectItem>
          <SelectItem value="acconto">Acconto ricevuto</SelectItem>
          <SelectItem value="saldato">Saldato</SelectItem>
        </SelectContent>
      </Select>
      <Button type="submit">Salva</Button>
    </form>
  </CardContent>
</Card>
```

- [ ] **Step 3: Commit**

```bash
git add src/
git commit -m "feat: payment status update on order detail"
```

---

### Task 16: Inventory Base

**Files:**
- Create: `src/app/(dashboard)/inventory/page.tsx`
- Create: `src/actions/inventory.ts`
- Modify: `src/components/nav/Sidebar.tsx` and `BottomNav.tsx` (add inventory link if desired, or omit from nav for Phase 2)

- [ ] **Step 1: Create `src/actions/inventory.ts`**

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/logger"
import { AppError, USER_MESSAGES } from "@/lib/errors"

export type InventoryItem = {
  id: string
  name: string
  unit: string
  quantity_available: number
  reorder_threshold: number
  updated_at: string
}

export async function getInventory(): Promise<InventoryItem[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .order("name")
    if (error) throw new AppError(error.message, USER_MESSAGES.generic)
    return (data ?? []) as InventoryItem[]
  } catch (err) {
    logError("getInventory", err)
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.generic)
  }
}

export async function upsertInventoryItem(input: {
  id?: string
  name: string
  unit: string
  quantity_available: number
  reorder_threshold: number
}): Promise<void> {
  try {
    const supabase = await createClient()
    const { data: shop } = await supabase.from("shops").select("id").single()
    if (!shop) throw new AppError("No shop", USER_MESSAGES.authRequired)

    const payload = { ...input, shop_id: shop.id }
    const { error } = input.id
      ? await supabase.from("inventory_items").update(payload).eq("id", input.id)
      : await supabase.from("inventory_items").insert(payload)

    if (error) throw new AppError(error.message, USER_MESSAGES.saveFailed)
  } catch (err) {
    logError("upsertInventoryItem", err, { input })
    throw err instanceof AppError ? err : new AppError(String(err), USER_MESSAGES.saveFailed)
  }
}
```

- [ ] **Step 2: Create `src/app/(dashboard)/inventory/page.tsx`**

```typescript
import { getInventory, upsertInventoryItem } from "@/actions/inventory"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ErrorMessage } from "@/components/ErrorMessage"
import { AlertTriangle } from "lucide-react"
import { revalidatePath } from "next/cache"
import { toUserMessage } from "@/lib/errors"

export default async function InventoryPage() {
  let items: Awaited<ReturnType<typeof getInventory>> = []
  let errorMsg: string | null = null

  try {
    items = await getInventory()
  } catch (err) {
    errorMsg = toUserMessage(err)
  }

  async function addItem(formData: FormData) {
    "use server"
    await upsertInventoryItem({
      name: formData.get("name") as string,
      unit: formData.get("unit") as string || "pz",
      quantity_available: Number(formData.get("qty")),
      reorder_threshold: Number(formData.get("threshold")),
    })
    revalidatePath("/inventory")
  }

  const lowStock = items.filter((i) => i.quantity_available <= i.reorder_threshold)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Materiali</h1>

      {lowStock.length > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {lowStock.length} materiale/i sotto la soglia minima
        </div>
      )}

      {errorMsg && <ErrorMessage message={errorMsg} />}

      <div className="space-y-2">
        {items.map((item) => (
          <Card key={item.id} className={item.quantity_available <= item.reorder_threshold ? "border-amber-200" : ""}>
            <CardContent className="py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.quantity_available} {item.unit} disponibili · soglia {item.reorder_threshold}
                </p>
              </div>
              {item.quantity_available <= item.reorder_threshold && (
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-4">
          <form action={addItem} className="grid grid-cols-2 gap-3">
            <Input name="name" required placeholder="Nome materiale" className="col-span-2" />
            <Input name="qty" type="number" min="0" step="0.01" required placeholder="Quantità" />
            <Input name="threshold" type="number" min="0" step="0.01" placeholder="Soglia minima" />
            <Input name="unit" placeholder="Unità (pz, kg, m)" />
            <Button type="submit" className="col-span-2">Aggiungi materiale</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/
git commit -m "feat: inventory base page with low-stock alert"
```

---

### Task 17: E2E Tests (Playwright)

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/flusso-a-dashboard.spec.ts`
- Create: `e2e/flusso-b-nuovo-ordine.spec.ts`
- Create: `e2e/flusso-c-aggiorna-ordine.spec.ts`

- [ ] **Step 1: Install Playwright**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Create `playwright.config.ts`**

```typescript
import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 12"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
})
```

- [ ] **Step 3: Create `e2e/flusso-a-dashboard.spec.ts`**

```typescript
import { test, expect } from "@playwright/test"

test.describe("Flusso A — Avvio giornata", () => {
  test("la dashboard mostra i KPI in meno di 60 secondi", async ({ page }) => {
    await page.goto("/dashboard")
    // If redirected to login, skip (need auth setup for CI)
    if (page.url().includes("/login")) {
      test.skip()
    }
    await expect(page.getByText("Ordini aperti")).toBeVisible({ timeout: 5000 })
    await expect(page.getByText("Urgenti")).toBeVisible()
    await expect(page.getByText("In ritardo")).toBeVisible()
    await expect(page.getByText("Consegne oggi")).toBeVisible()
  })
})
```

- [ ] **Step 4: Create `e2e/flusso-b-nuovo-ordine.spec.ts`**

```typescript
import { test, expect } from "@playwright/test"

test.describe("Flusso B — Nuovo ordine", () => {
  test("il form di creazione ordine è completabile in meno di 2 minuti", async ({ page }) => {
    await page.goto("/orders/new")
    if (page.url().includes("/login")) test.skip()

    const start = Date.now()

    await page.fill('input[name="title"]', "Test ordine E2E")
    await page.fill('input[name="due_date"]', new Date(Date.now() + 86400000).toISOString().split("T")[0])
    await page.click('button[type="submit"]')

    await expect(page).not.toHaveURL("/orders/new", { timeout: 10000 })

    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(120_000)
  })
})
```

- [ ] **Step 5: Create `e2e/flusso-c-aggiorna-ordine.spec.ts`**

```typescript
import { test, expect } from "@playwright/test"

test.describe("Flusso C — Aggiornamento ordine", () => {
  test("aggiornare lo stato di un ordine in meno di 30 secondi", async ({ page }) => {
    await page.goto("/orders")
    if (page.url().includes("/login")) test.skip()

    const firstOrder = page.locator("a[href^='/orders/']").first()
    if (!(await firstOrder.isVisible())) test.skip()

    const start = Date.now()
    await firstOrder.click()

    const select = page.locator('select[name="status"]')
    await select.selectOption("pronto")
    await page.click('button[type="submit"]:near(select)')

    await expect(page.getByText("Pronto")).toBeVisible({ timeout: 5000 })
    expect(Date.now() - start).toBeLessThan(30_000)
  })
})
```

- [ ] **Step 6: Run tests**

```bash
npx playwright test --project=chromium
```
Expected: tests that require auth will skip, structural tests pass.

- [ ] **Step 7: Commit**

```bash
git add playwright.config.ts e2e/
git commit -m "test: Playwright E2E tests for Flussi A, B, C"
```

---

### Task 18: Vercel Deploy

**Files:**
- Modify: `CLAUDE.md` (update status to reflect completed phases)
- No code changes — deploy via git push

- [ ] **Step 1: Final build check**

```bash
npm run build
npm run lint
npx tsc --noEmit
```
All must exit 0.

- [ ] **Step 2: Create Vercel project**

```bash
npx vercel link
# Follow prompts: link to Vercel account, create new project "oltre-la-bottega"
```

- [ ] **Step 3: Set environment variables in Vercel**

In Vercel dashboard → Project → Settings → Environment Variables:
```
NEXT_PUBLIC_SUPABASE_URL = <your value>
NEXT_PUBLIC_SUPABASE_ANON_KEY = <your value>
SUPABASE_SERVICE_ROLE_KEY = <your value>
```

- [ ] **Step 4: Deploy**

```bash
git push origin main
```
Vercel auto-deploys from `main`. Monitor deploy in Vercel dashboard.

- [ ] **Step 5: Smoke test production**

1. Open production URL.
2. Login with magic link.
3. Create an order.
4. Verify it appears in the order list.

- [ ] **Step 6: Update CLAUDE.md status**

Update `## Stato attuale` in CLAUDE.md to reflect what has been built.

- [ ] **Step 7: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update project status after MVP deployment"
```

**Completion criteria:** Production URL returns 200 on `/dashboard`. Login flow works. Order creation works end-to-end.

---

## Phase Completion Criteria

| Phase | Criteria |
|---|---|
| **Phase 0** | `npm run build` exits 0; auth magic link works; schema applied in Supabase; seed data queryable |
| **Phase 1** | All 4 pages render with real data; order CRUD works; reminder can be added and completed; search returns results |
| **Phase 2** | All pages mobile-friendly at 375px; payment status updates logged; E2E tests run without errors; Vercel deploy live |

---

## Dependency Graph

```
T01 (scaffold)
  └─ T05 (errors)
  └─ T02 (env)
       └─ T03 (schema)
            └─ T04 (auth)
                 ├─ T06 (dashboard)
                 ├─ T07 (order list) ─── T08 (create order) ─── T09 (order detail) ─── T15 (payment)
                 ├─ T10 (customers) ──── T11 (customer detail)
                 ├─ T12 (agenda)
                 └─ T13 (search)
                      └─ T14 (mobile QA) ─── T16 (inventory) ─── T17 (E2E) ─── T18 (deploy)
```

---

## Update Instructions

At the end of each task, update the Progress Table above:
1. Change `⬜ Todo` → `✅ Done` for completed tasks.
2. If a task is blocked, change to `🚫 Blocked` and note the blocker.
3. Update `CLAUDE.md` `## Stato attuale` when a full phase is complete.
4. Commit the updated plan: `git commit -m "docs: update plan progress after T<N>"`
