import { computeOrderSummary, type OrderItemInput } from "../orderItems"

describe("computeOrderSummary", () => {
  it("joins a single item's name as-is and multiplies quantity by unit price", () => {
    const items: OrderItemInput[] = [
      { cosa_ordinato: "Targa", testo_da_scrivere: null, quantita: 2, prezzo_unitario: 6 },
    ]
    expect(computeOrderSummary(items)).toEqual({ cosaOrdinato: "Targa", prezzo: 12 })
  })

  it("joins multiple item names with a comma and sums their line totals", () => {
    const items: OrderItemInput[] = [
      { cosa_ordinato: "Targa", testo_da_scrivere: "Studio Rossi", quantita: 2, prezzo_unitario: 6 },
      { cosa_ordinato: "Timbro", testo_da_scrivere: null, quantita: 1, prezzo_unitario: 10 },
    ]
    expect(computeOrderSummary(items)).toEqual({ cosaOrdinato: "Targa, Timbro", prezzo: 22 })
  })

  it("rounds the total to 2 decimals to avoid floating point drift", () => {
    const items: OrderItemInput[] = [
      { cosa_ordinato: "A", testo_da_scrivere: null, quantita: 1, prezzo_unitario: 0.1 },
      { cosa_ordinato: "B", testo_da_scrivere: null, quantita: 1, prezzo_unitario: 0.2 },
    ]
    expect(computeOrderSummary(items).prezzo).toBe(0.3)
  })

  it("treats a missing/zero quantity or price as contributing 0 to the total", () => {
    const items: OrderItemInput[] = [
      { cosa_ordinato: "Gratis", testo_da_scrivere: null, quantita: 1, prezzo_unitario: 0 },
    ]
    expect(computeOrderSummary(items)).toEqual({ cosaOrdinato: "Gratis", prezzo: 0 })
  })
})
