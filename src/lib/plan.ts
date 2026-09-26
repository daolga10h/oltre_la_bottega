import { STATUS_ORDER } from "@/lib/orderConstants"

/**
 * Livello dell'installazione. Ogni cliente ha la propria istanza, quindi il
 * livello è una variabile d'ambiente, non un dato nel database.
 *
 * - "completo": tutto ciò che l'app sa fare (il livello della mia bottega).
 * - "base": la versione semplificata da vendere; nasconde le funzioni avanzate.
 */
export type Plan = "base" | "completo"

/**
 * Funzioni presenti solo nel livello completo. Chi le usa chiede
 * `hasFeature(...)` e non deve mai conoscere i nomi dei livelli.
 */
export type Feature =
  | "multi_riga"
  | "ente"
  | "materiale"
  | "bozza_grafica"
  | "campi_avanzati" // tipo lavorazione, dettagli grafici, file cliente, foto oggetto
  | "elenco_ordini" // voce di menu "Ordini": nel base si lavora dalla Bacheca
  | "operatore"
  | "da_incassare"
  | "riepilogo"
  | "etichetta_termica"
  | "calcolatrice"

const OFF_IN_BASE: ReadonlySet<Feature> = new Set<Feature>([
  "multi_riga",
  "ente",
  "materiale",
  "bozza_grafica",
  "campi_avanzati",
  "elenco_ordini",
  "operatore",
  "da_incassare",
  "riepilogo",
  "etichetta_termica",
  "calcolatrice",
])

/** Valore mancante o non riconosciuto → "completo": l'installazione esistente non deve rompersi. */
export function parsePlan(value: string | undefined | null): Plan {
  return value?.trim().toLowerCase() === "base" ? "base" : "completo"
}

export function getPlan(): Plan {
  // Deve restare un accesso letterale a process.env.NEXT_PUBLIC_PLAN: Next lo
  // sostituisce con il valore fisso a build-time anche nei componenti client.
  return parsePlan(process.env.NEXT_PUBLIC_PLAN)
}

export function hasFeature(feature: Feature, plan: Plan = getPlan()): boolean {
  return plan === "completo" || !OFF_IN_BASE.has(feature)
}

/** Stati dell'ordine disponibili nel livello, nell'ordine del percorso. */
export function statusOrderForPlan(plan: Plan): string[] {
  return hasFeature("bozza_grafica", plan)
    ? [...STATUS_ORDER]
    : STATUS_ORDER.filter((s) => s !== "bozza_grafica")
}

export type PrintFormat = "etichetta" | "foglio"

/**
 * Nel base esiste solo il foglio lavoro (stampante normale), anche se si apre
 * a mano l'indirizzo dell'etichetta. Nel completo l'etichetta resta il
 * formato predefinito, il foglio si chiede con `?formato=foglio`.
 */
export function resolvePrintFormat(requested: string | undefined, plan: Plan): PrintFormat {
  if (!hasFeature("etichetta_termica", plan)) return "foglio"
  return requested === "foglio" ? "foglio" : "etichetta"
}
