export const STATUS_LABELS: Record<string, string> = {
  preventivo: "Preventivo",
  bozza_grafica: "Bozza grafica",
  da_fare: "Da fare",
  in_lavorazione: "In lavorazione",
  pronto: "Pronto",
  consegnato: "Consegnato",
}

export const STATUS_ORDER = ["preventivo", "bozza_grafica", "da_fare", "in_lavorazione", "pronto", "consegnato"]

/**
 * Stato iniziale calcolato alla creazione di un ordine: se va inviato un
 * preventivo ha priorità, poi la bozza grafica, altrimenti l'ordine è preso
 * in carico ("da_fare") ma resta da programmare prima di passare in lavorazione.
 */
export function computeOrderStatus(preventivo: string, bozza: string): string {
  if (preventivo !== "non_inviare") return "preventivo"
  if (bozza !== "non_serve") return "bozza_grafica"
  return "da_fare"
}

export function computeSaldo(prezzo: number, acconto: number): number {
  return Math.max(0, prezzo - acconto)
}
