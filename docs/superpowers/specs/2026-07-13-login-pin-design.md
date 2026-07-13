# Login con PIN (oltre al magic link) — design

**Data**: 2026-07-13
**Stato**: approvato, in attesa di piano di implementazione

## Problema

L'app usa oggi solo il login via magic link (email). In uso reale su
2 tablet + 1 PC in bottega, i tablet non hanno un client di posta
configurato e l'utente non vuole in nessun caso dover aprire/consultare
la posta da quei dispositivi, nemmeno una tantum. Il magic link da solo
non è quindi praticabile per l'accesso quotidiano sui tablet.

Le sessioni Supabase, una volta ottenute, si rinnovano da sole in
background (refresh token, nessuna scadenza forzata configurata) — il
problema non è la frequenza del login, ma il fatto che la primissima
attivazione di un dispositivo richiederebbe comunque un passaggio dalla
posta su quel dispositivo.

## Cosa NON facciamo

- Non tocchiamo il magic link esistente: resta il metodo di accesso
  principale e diventa anche la via di recupero se il PIN viene
  dimenticato.
- Non introduciamo utenti multipli: resta un solo account Supabase per
  bottega (modello single-tenant già esistente), quindi **un solo PIN
  condiviso** per tutti i dispositivi — non un PIN per persona o per
  tablet.
- Non aggiungiamo l'impostazione PIN alla bottom nav (mobile): si
  imposta/cambia il PIN una tantum, dal PC — la voce "Impostazioni" va
  solo nel sidebar desktop.
- Non tocchiamo tabelle o endpoint: il PIN è la password Supabase
  dell'account esistente (`auth.users`), stesso meccanismo già
  disponibile lato Supabase Auth. Nessuna colonna nuova, nessuna route
  API nuova.
- Non modifichiamo `jwt_expiry`/i settaggi di sessione: non è il
  problema che stiamo risolvendo (vedi "Problema").

## Comportamento

### 1. Login con PIN (`src/app/(auth)/login/page.tsx`)

La pagina guadagna due modalità, scelte tramite due pulsanti tipo tab
in cima al form: **"Link via email"** (comportamento attuale, invariato)
e **"PIN"**.

Modalità PIN:
- Legge `localStorage["oltreBottegaEmail"]` (chiave già scritta oggi da
  `setup-pin`, oggi non riletta da nessuno). Se presente, mostra
  "Accesso come `email@esempio.it`" con un link "Cambia" per modificarla;
  se assente, mostra un campo email normale.
- Campo PIN: `Input` standard (`type="password"`, `inputMode="numeric"`,
  `maxLength={6}`) — stesso pattern dei form già presenti nell'app
  (`OrderForm`, ecc.), niente tastierino grafico dedicato per il login
  (quello resta solo in `setup-pin`, dove già esiste e non va rifatto).
- Submit → `supabase.auth.signInWithPassword({ email, password: pin })`.
- Errore → messaggio "PIN errato, riprova" (stesso stile errore già
  usato nel form email).
- Successo → stessa logica di redirect oggi nel route handler
  `src/app/auth/callback/route.ts`: legge l'utente, calcola
  `getShopName(user)` (già una funzione pura, riusabile lato client) e
  va a `/auth/setup-shop` se non ancora configurato, altrimenti
  `/dashboard`.

### 2. Voce "Impostazioni" nel sidebar (`src/components/nav/Sidebar.tsx`)

Nuova voce, sotto il gruppo "Gestione", icona `Settings` (lucide-react),
punta a una nuova pagina `/impostazioni` (route
`src/app/(dashboard)/impostazioni/page.tsx`, stesso pattern delle altre
pagine del gruppo dashboard — ha sidebar/bottom nav).

Contenuto della pagina: una card con un pulsante "Imposta PIN" (o
"Cambia PIN" se `user.user_metadata.pin_set` è già `true`) che porta a
`/setup-pin`. Nessuna logica propria oltre a questo — la pagina è solo
un punto di ingresso, dato che oggi `setup-pin` non è raggiungibile da
nessuna parte dell'interfaccia.

### 3. Piccola rifinitura a `setup-pin` (`src/app/(auth)/setup-pin/page.tsx`)

Il testo "Crea il tuo PIN" non ha senso quando si sta *cambiando* un
PIN già esistente. Al mount, se `user.user_metadata.pin_set` è `true`,
il titolo/sottotitolo diventano "Cambia il tuo PIN" / "Scegli le nuove
6 cifre" invece di "Crea…". Nessun altro cambiamento alla pagina (la
logica di salvataggio resta identica).

## Sicurezza

- Il PIN è a tutti gli effetti la password dell'account Supabase
  (`updateUser({ password: pin })`, già scritto in `setup-pin`). La
  lunghezza minima password lato Supabase è già configurata a 6
  caratteri — combacia esattamente, nessuna modifica di configurazione
  necessaria.
- Un PIN a 6 cifre numeriche è più debole di una password vera (meno
  combinazioni possibili). Per una singola bottega con dispositivi
  fisicamente controllati è un rischio accettato esplicitamente
  dall'utente — coerente con l'assenza di 2FA altrove nel prodotto —
  ma va scritto anche nella riga di CLAUDE.md quando la funzione verrà
  implementata, così resta tracciata come scelta consapevole.
- Nessuna nuova superficie server-side: sia il magic link sia il login
  con PIN passano dallo stesso client Supabase già usato ovunque
  nell'app (`@supabase/ssr`).

## Testing

- Verifica manuale end-to-end (non c'è logica pura significativa da
  isolare in unit test, è quasi tutta interazione diretta col client
  Supabase — stesso discorso vale già per il login a magic link
  esistente, mai stato testato a livello unitario):
  1. Login via magic link sul PC (comportamento invariato).
  2. Da "Impostazioni" → "Imposta PIN" → completare il flusso.
  3. Su un dispositivo diverso (o sessione pulita), aprire `/login`,
     scegliere "PIN", inserire email + PIN → deve entrare in
     `/dashboard` senza mai aver aperto una casella di posta su quel
     dispositivo.
  4. Ripetere l'accesso PIN una seconda volta sullo stesso dispositivo:
     l'email deve essere già precompilata (letta da `localStorage`).
  5. PIN errato → messaggio di errore, nessun accesso.
  6. Da "Impostazioni" con un PIN già impostato, verificare che il
     titolo dica "Cambia il tuo PIN" e non "Crea il tuo PIN".
- Flussi E2E Playwright esistenti (`e2e/flusso-*.spec.ts`) restano
  invariati: continuano ad autenticarsi via Admin API, non toccano
  questo flusso.

## Nota per l'implementazione

Quando questa funzione verrà implementata, aggiungere una riga alla
tabella "Decisioni chiave e motivazioni" di `CLAUDE.md` che aggiorna
(non cancella) quella attuale — "Auth = solo magic link via email,
niente PIN" — spiegando perché la scelta è stata rivista: non per
aggiungere un livello di sicurezza sopra il blocco schermo del tablet
(motivazione originale, ancora valida), ma per eliminare la necessità
di configurare la posta sui tablet, che nella scelta originale non era
un vincolo esplicito.

## Idea correlata, non in scope qui

Durante la discussione è emersa un'idea distinta: un campo libero
"Operatore" nel form ordine, per sapere chi ha preso l'ordine (oggi
riconoscibile dalla calligrafia sulla carta, segnale che sparisce
passando tutto a digitale con un PIN condiviso). Non fa parte di questo
design — da affrontare come brainstorming a sé in un secondo momento.