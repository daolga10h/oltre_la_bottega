# Stampa etichetta da tablet — scelta stampante e design

**Data**: 2026-08-10
**Stato**: approvato, in attesa di piano di implementazione

## Problema

Oggi "Stampa etichetta" apre `window.print()` su una pagina dedicata già
esistente (`src/app/(print)/orders/[id]/print/`), pensata per una
stampante collegata al PC del negozio. L'app sarà usata anche da 2
tablet Android, e serve poter premere "Stampa etichetta" anche da lì,
ottenendo la stampa reale sulla stampante del negozio — senza installare
l'app del produttore della stampante sul tablet.

## Cosa NON facciamo

- Non costruiamo un bridge software personalizzato (agente sul PC, QZ
  Tray, coda lavori via Supabase Realtime) — opzione valutata e scartata
  per ora perché introduce codice/infrastruttura da mantenere non
  necessari con la scelta di stampante descritta sotto. Resta un piano B
  (vedi sezione omonima) se la soluzione scelta non funzionasse in
  pratica.
- Non usiamo Bluetooth/Web Bluetooth — richiederebbe comunque logica di
  comunicazione diretta browser↔stampante con supporto incerto su
  Chrome Android, e legherebbe la dashboard a un protocollo di stampa
  specifico.
- Non cambiamo la logica di "Stampa etichetta" nella dashboard: resta lo
  stesso bottone che chiama `window.print()` sulla pagina esistente.
- Non compriamo (per ora) una stampante ESC/POS/TSPL "generica
  universale" né modelli Wi-Fi di altre marche (testati: Dymo, Epson TM,
  Citizen, iDPRT/HPRT, Phomemo, marche cinesi generiche) — nessuna
  risulta supportare Mopria: richiedono tutte un'app propria del
  produttore per stampare da Android, il vincolo di partenza da evitare.

## Decisione

Stampante **Brother QL Wi-Fi** (QL-810W o QL-820NWB), collegata alla
rete Wi-Fi del negozio. Rullo continuo **DK-22205** (62mm) — termica
diretta, nessun nastro/inchiostro da comprare.

Perché Brother QL: è l'unico marchio per cui la documentazione ufficiale
del produttore confermi esplicitamente il supporto a **Mopria Print
Service** su modelli di stampanti per etichette (verificato sulle pagine
di supporto Brother). Tutte le altre marche verificate usano
tipicamente un'app propria per stampare da Android (vedi sopra).

Setup una tantum:
- PC: si aggiunge la stampante come stampante di rete Windows, come
  qualsiasi altra stampante nuova.
- Ogni tablet: si installa una volta l'app gratuita e generica **"Mopria
  Print Service"** dal Play Store — non l'app Brother.

Da quel momento "Stampa etichetta" funziona identico da PC e da tablet,
senza aprire nessun'altra app.

## Consumabili

- Rullo DK-22205, formato Brother (nessun chip/DRM) — rotoli compatibili
  di terze parti ampiamente disponibili, circa €4-9/rotolo se comprati
  in confezioni multiple su Amazon.it e altri negozi online; gli
  originali Brother costano di più (stima €15-25/rotolo).
- Circa 30 metri per rotolo → 500-750 etichette a seconda dell'altezza
  usata per etichetta, quindi pochi centesimi a etichetta.
- Trade-off accettato esplicitamente dall'utente: il rullo non è lo
  standard termico "universale" di una generica stampante ESC/POS, ma
  nemmeno bloccato in senso stretto — nessun DRM, alternative compatibili
  economiche disponibili da più venditori.

## Intervento di codice (minimo, dopo il primo test reale)

`src/app/(print)/orders/[id]/print/page.tsx` ha `@page { size: 62mm
auto }` mentre il contenuto in `PrintClient.tsx` è impostato a 58mm di
larghezza — disallineamento preesistente, non introdotto da questa
scelta. Con il rullo Brother da 62mm ha senso allineare entrambi a
62mm. Da verificare/applicare solo dopo aver visto la stampa reale sulla
stampante acquistata, non a scatola chiusa.

## Piano B (non implementato ora)

Se in negozio il Mopria Print Service non rilevasse bene la stampante su
qualche tablet:
- Condivisione stampante nativa di Windows (i tablet la scoprirebbero
  comunque via IPP, sempre tramite lo stesso Mopria Print Service già
  installato).
- Come ultima risorsa, un bridge software (agente sul PC + coda lavori),
  la soluzione scartata sopra per complessità.

Nessuna delle due richiede una stampante diversa da quella scelta in
questo design.

## Testing

Nessun test automatico applicabile (interazione con hardware fisico) —
stesso trattamento già riservato ad altre funzionalità hardware-
dipendenti nel progetto. Verifica manuale end-to-end quando la
stampante arriva:

1. Aggiungere la stampante in Windows (rete) e stampare un'etichetta da
   un ordine esistente dal PC.
2. Installare Mopria Print Service su un tablet Android, verificare che
   la stampante compaia nella lista di stampa di Chrome.
3. Premere "Stampa etichetta" da un ordine sul tablet → confermare che
   l'etichetta esce corretta (testo leggibile, QR code scansionabile,
   nessun taglio a metà).
4. Ripetere su entrambi i tablet del negozio.

## Nota per l'implementazione

Quando la stampante sarà acquistata e il setup verificato in negozio,
aggiungere una riga alla tabella "Decisioni chiave e motivazioni" di
`CLAUDE.md` (stampante Brother QL + Mopria Print Service, motivazione:
unica opzione verificata per la stampa da tablet senza app del
produttore) e aggiornare lo stato della Fase 3 della Roadmap.