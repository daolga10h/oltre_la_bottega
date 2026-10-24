# Materiali: sconti a cascata sul prezzo di acquisto — Design

Data: 2026-10-24

## Problema

Il primo foglio con sconti (Munari, documento di trasporto) ha mostrato un limite: le righe hanno un prezzo
unitario di listino e una o più colonne di sconto (SC.1%, SC.2%, SC.3%), e l'importo netto è già scontato.
L'app leggeva il solo listino (22,02), quindi il controllo «quantità × prezzo = importo» segnava «Non torna»
su tutte le righe e, peggio, avrebbe salvato come costo il listino invece del costo vero (8,808).

## Decisioni

| Tema | Decisione |
|---|---|
| Cosa si salva | Il **netto**: listino meno gli sconti a cascata. È il costo vero, quello che servirà per i preventivi |
| Come si applicano | A cascata: ogni sconto sul prezzo già scontato (50 poi 20 = × 0,5 × 0,8). Esempio del foglio: 22,02 → 8,808 |
| Lettura | Lo strumento di lettura restituisce anche `sconti`: elenco di percentuali nell'ordine delle colonne. `prezzo` diventa esplicitamente il listino prima degli sconti. Uno sconto in euro non è previsto |
| Tabella di controllo | Tre colonne: Listino € (modificabile), Sconti % (modificabile, es. «50 + 20»), Netto € (calcolato, è ciò che si salva) |
| Controllo | «quantità × netto = importo» col netto **non arrotondato**, tolleranza di un centesimo: le 5 righe Munari tornano |
| Scrittura a mano | Separatori ammessi `+`, `/`, `;`, spazio; la virgola è il decimale; `%` ignorato; sconti a zero ignorati; valore non numerico o fuori da 0–100 = riga non valida |
| Salvataggio | Invariato: `saveMaterials` riceve già il prezzo netto, nessuna migration, nessun cambio al database |

## Dove

`src/lib/materiali.ts` (`netPrice`, `round3`, `parseDiscounts`, `formatDiscounts`, tipo `RigaLetta`),
`src/lib/documentoFornitore.ts` (`sconti` nella convalida), `src/lib/documentReader.ts` (prompt e schema),
`src/components/MaterialiImport.tsx` (colonne e calcolo). Le colonne Codice e Materiale della tabella sono state allargate
perché i codici lunghi (`CNR290/3R`) risultavano tagliati.

## Fuori scope

Sconti in euro, sconti sul totale del documento, IVA, salvataggio del listino accanto al netto.
