// Scene e didascalie del video dimostrativo automatico (npm run demo:video).
// Solo dati e calcoli, senza browser: lo script scripts/demo-video/run.ts li
// usa per le riprese. Design: docs/superpowers/specs/2026-09-26-video-automatico-design.md

/**
 * Contatto mostrato nell'ultima scritta del video. Da sostituire con il numero
 * WhatsApp della titolare prima del video definitivo.
 */
export const CONTATTO_WHATSAPP = "[numero WhatsApp]"

export type Didascalia = {
  /** Testo in italiano, al massimo circa 90 caratteri. */
  testo: string
  /**
   * Secondi in più oltre al tempo di lettura: il tempo in cui la scritta resta
   * in vista mentre sullo schermo succede qualcosa (digitazione, scorrimento...).
   */
  secondiExtra: number
}

export type Scena = {
  id: "apertura" | "oggi" | "nuovo-ordine" | "bacheca" | "avvisa" | "foglio" | "clienti" | "chiusura"
  didascalie: Didascalia[]
}

export const SCENE: Scena[] = [
  {
    id: "apertura",
    didascalie: [
      { testo: "Ciao, sono Olga. Ho una bottega e mi sono costruita un'app per non tenere più tutto a mente.", secondiExtra: 2 },
      { testo: "Ogni mattina apro questa pagina e so cosa devo fare oggi.", secondiExtra: 3 },
    ],
  },
  {
    id: "oggi",
    didascalie: [{ testo: "Consegne di oggi, lavori pronti da avvisare, promemoria.", secondiExtra: 12 }],
  },
  {
    id: "nuovo-ordine",
    didascalie: [
      { testo: "Un cliente che torna: i dati si compilano da soli.", secondiExtra: 12 },
      { testo: "Registro un lavoro in meno di un minuto.", secondiExtra: 14 },
    ],
  },
  {
    id: "bacheca",
    didascalie: [{ testo: "La Bacheca è la mia lavagna: ogni colonna è una fase.", secondiExtra: 12 }],
  },
  {
    id: "avvisa",
    didascalie: [{ testo: "Quando è pronto, il messaggio al cliente è già scritto.", secondiExtra: 12 }],
  },
  {
    id: "foglio",
    didascalie: [{ testo: "Con una stampante normale stampo il foglio da mettere con il lavoro.", secondiExtra: 9 }],
  },
  {
    id: "clienti",
    didascalie: [{ testo: "Quando un cliente torna, vedo subito tutto quello che ha già ordinato.", secondiExtra: 12 }],
  },
  {
    id: "chiusura",
    didascalie: [
      { testo: "Semplice, perché l'ho fatta per chi lavora in bottega.", secondiExtra: 1 },
      { testo: "Se non rinnovi, l'app continua a funzionare.", secondiExtra: 1 },
      { testo: `Scrivimi per una dimostrazione dal vivo · WhatsApp ${CONTATTO_WHATSAPP}`, secondiExtra: 5 },
    ],
  },
]

/** Secondi per leggere una scritta: circa 15 caratteri al secondo più 1,2 s di pausa, mai meno di 2,5 s. */
export function tempoLettura(testo: string): number {
  return Math.max(2.5, testo.length / 15 + 1.2)
}

/** Secondi in cui la scritta resta sullo schermo: lettura più il tempo dell'azione. */
export function tempoInScena(didascalia: Didascalia): number {
  return tempoLettura(didascalia.testo) + didascalia.secondiExtra
}

/** Durata pianificata del video in secondi (somma dei tempi di tutte le scritte). */
export function durataPianificata(scene: Scena[] = SCENE): number {
  return scene.flatMap((s) => s.didascalie).reduce((totale, d) => totale + tempoInScena(d), 0)
}
