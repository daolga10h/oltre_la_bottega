export type OrderItemInput = {
  cosa_ordinato: string
  testo_da_scrivere: string | null
  quantita: number
  prezzo_unitario: number
}

export function computeOrderSummary(items: OrderItemInput[]): { cosaOrdinato: string; prezzo: number } {
  const cosaOrdinato = items.map((item) => item.cosa_ordinato).join(", ")
  const rawTotal = items.reduce((sum, item) => sum + item.quantita * item.prezzo_unitario, 0)
  const prezzo = Math.round(rawTotal * 100) / 100
  return { cosaOrdinato, prezzo }
}
